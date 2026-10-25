// Finds Cast devices on the LAN and keeps the scoreboard open on the chosen TV.
//
// The TV runs DashCast (a public receiver that just shows a web page). With force: true
// it navigates the whole receiver to our /display page, which then talks to us over socket.io.

const { Bonjour } = require('bonjour-service');
const { EventEmitter } = require('events');
const { CastClient, NS } = require('./castv2');

const DASHCAST_APP_ID = '84912283';
const DASHCAST_NS = 'urn:x-cast:com.madmod.dashcast';
const BACKDROP_IDS = ['E8C28D3C', '00000000-0000-0000-0000-000000000000']; // idle screens / ambient mode

const log = (...a) => console.log('[cast]', ...a);

class CastManager extends EventEmitter {
    constructor({ isDisplayConnected }) {
        super();
        this.isDisplayConnected = isDisplayConnected; // (room, deviceId) => bool
        this.devices = new Map();
        this.sessions = new Map(); // room -> { deviceId, url, state, error, client, launchedAt, retries }
    }

    startDiscovery() {
        this.bonjour = new Bonjour();
        this.browser = this.bonjour.find({ type: 'googlecast' });
        this.browser.on('up', (svc) => this.onService(svc));
        this.browser.on('down', (svc) => {
            const id = svc.txt?.id;
            if (id && this.devices.has(id)) {
                this.devices.get(id).online = false;
                this.emit('change');
            }
        });
        // mDNS answers get lost now and then (and TVs drop off when asleep) – keep asking.
        this.rescan = setInterval(() => this.browser.update(), 30000);
        this.watchdog = setInterval(() => this.check(), 10000);
    }

    onService(svc) {
        const t = svc.txt || {};
        if (!t.id || t.md === 'Google Cast Group') return;
        const host = (svc.addresses || []).find((a) => a.includes('.')) || svc.referer?.address;
        if (!host) return;
        const ca = parseInt(t.ca || '0', 10);
        const prev = this.devices.get(t.id);
        const dev = { id: t.id, name: t.fn || svc.name, model: t.md || '', host, port: svc.port || 8009, video: (ca & 1) === 1, online: true };
        this.devices.set(t.id, dev);
        if (!prev || prev.host !== dev.host || prev.name !== dev.name || !prev.online) {
            log(`found ${dev.name} (${dev.model}) at ${dev.host}${dev.video ? '' : ' [audio only]'}`);
            this.emit('change');
        }
    }

    list() {
        return [...this.devices.values()]
            .sort((a, b) => (b.video - a.video) || a.name.localeCompare(b.name))
            .map(({ id, name, model, video, online }) => ({ id, name, model, video, online }));
    }

    status(room) {
        const s = this.sessions.get(room);
        if (!s) return null;
        const dev = this.devices.get(s.deviceId);
        return { deviceId: s.deviceId, name: dev?.name ?? 'TV', state: s.state, error: s.error || null };
    }

    setState(room, s, state, error = null) {
        if (s.state === state && s.error === error) return;
        s.state = state;
        s.error = error;
        log(`${room}: ${state}${error ? ` (${error})` : ''}`);
        this.emit('change');
    }

    async connect(s) {
        const dev = this.devices.get(s.deviceId);
        if (!dev) throw new Error('TV not found on the network – is it turned on?');
        if (s.client && !s.client.closed) return s.client;
        const client = new CastClient(dev.host, dev.port);
        await client.connect();
        client.on('status', (st) => this.onReceiverStatus(s, st));
        client.on('close', () => { if (s.client === client) s.client = null; });
        s.client = client;
        return client;
    }

    onReceiverStatus(s, status) {
        const app = status?.applications?.find((a) => a.appId === DASHCAST_APP_ID);
        if (s.state === 'casting' && !app) {
            // Someone pressed back/home or cast something else to the TV: respect that.
            this.setState(s.room, s, 'stopped');
            s.client?.close();
        }
    }

    async start(room, deviceId, url) {
        const old = this.sessions.get(room);
        if (old && old.deviceId !== deviceId) await this.stop(room);
        const s = this.sessions.get(room) || { room, retries: 0 };
        Object.assign(s, { deviceId, url, retries: 0 });
        this.sessions.set(room, s);
        await this.launch(s);
    }

    async launch(s) {
        this.setState(s.room, s, 'connecting');
        try {
            const client = await this.connect(s);
            // Once DashCast has navigated to our page its own code is gone and it can't take a new URL,
            // so start it from scratch every time.
            const app = await client.launch(DASHCAST_APP_ID, { fresh: true });
            s.sessionId = app.sessionId;
            const url = `${s.url}${s.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
            const ns = app.namespaces?.find((x) => x.name.includes('dashcast'))?.name || DASHCAST_NS;
            client.send(app.transportId, ns, { url, force: true, reload: false, reload_time: 0 });
            s.launchedAt = Date.now();
            this.setState(s.room, s, 'casting');
        } catch (e) {
            s.client?.close();
            this.setState(s.room, s, 'error', e.message);
            throw e;
        }
    }

    async stop(room) {
        const s = this.sessions.get(room);
        if (!s) return;
        this.sessions.delete(room);
        try {
            const client = await this.connect(s);
            const status = await client.getStatus();
            const app = status.applications?.find((a) => a.appId === DASHCAST_APP_ID);
            if (app) await client.stop(app.sessionId);
        } catch (e) {
            log(`stop ${room}: ${e.message}`);
        } finally {
            s.client?.close();
            this.emit('change');
        }
    }

    // After a server restart: re-attach to a TV that is still showing our page.
    async resume(room, deviceId, url) {
        const s = { room, deviceId, url, retries: 0, state: 'stopped' };
        this.sessions.set(room, s);
        const waitFor = Date.now() + 30000;
        while (!this.devices.has(deviceId) && Date.now() < waitFor) await new Promise((r) => setTimeout(r, 1000));
        try {
            const client = await this.connect(s);
            const status = await client.getStatus();
            if (status.applications?.some((a) => a.appId === DASHCAST_APP_ID)) {
                s.launchedAt = Date.now();
                this.setState(room, s, 'casting');
            } else {
                client.close();
                this.sessions.delete(room);
                this.emit('change');
            }
        } catch {
            this.sessions.delete(room);
            this.emit('change');
        }
    }

    // Keeps the page alive: if the TV still runs DashCast but our page isn't connected, reload it.
    async check() {
        for (const s of this.sessions.values()) {
            if (s.state !== 'casting' || s.busy) continue;
            const since = Date.now() - (s.launchedAt || 0);
            if (this.isDisplayConnected(s.room, s.deviceId)) {
                s.retries = 0;
                continue;
            }
            if (since < 30000) continue; // page still loading
            s.busy = true;
            try {
                const client = await this.connect(s);
                const status = await client.getStatus();
                const running = status.applications?.find((a) => a.appId === DASHCAST_APP_ID);
                if (!running) {
                    const idle = !status.applications?.length || status.applications.every((a) => BACKDROP_IDS.includes(a.appId));
                    this.setState(s.room, s, 'stopped', idle ? null : 'Another app took over the TV');
                } else if (s.retries < 5) {
                    s.retries += 1;
                    log(`${s.room}: page not connected, reloading (try ${s.retries})`);
                    await this.launch(s);
                } else {
                    this.setState(s.room, s, 'error', 'The TV opened the page but it never connected');
                }
            } catch (e) {
                this.setState(s.room, s, 'error', e.message);
            } finally {
                s.busy = false;
            }
        }
    }

    close() {
        clearInterval(this.rescan);
        clearInterval(this.watchdog);
        for (const s of this.sessions.values()) s.client?.close();
        this.bonjour?.destroy();
    }
}

module.exports = { CastManager, NS };
