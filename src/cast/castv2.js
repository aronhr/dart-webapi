// Minimal Google Cast v2 client: TLS socket on :8009, length-prefixed protobuf CastMessages.
// Only what we need: connect, heartbeat, launch an app, send JSON to it, stop it.

const tls = require('tls');
const { EventEmitter } = require('events');

const NS = {
    connection: 'urn:x-cast:com.google.cast.tp.connection',
    heartbeat: 'urn:x-cast:com.google.cast.tp.heartbeat',
    receiver: 'urn:x-cast:com.google.cast.receiver',
};

// --- tiny protobuf encoder/decoder for CastMessage ------------------------------------------
const varint = (n) => {
    const out = [];
    while (n > 127) { out.push((n & 127) | 128); n >>>= 7; }
    out.push(n);
    return Buffer.from(out);
};
const field = (no, type, value) => {
    if (type === 0) return Buffer.concat([varint((no << 3) | 0), varint(value)]);
    const buf = Buffer.from(value, 'utf8');
    return Buffer.concat([varint((no << 3) | 2), varint(buf.length), buf]);
};
const encode = ({ source, destination, namespace, data }) => Buffer.concat([
    field(1, 0, 0),                 // protocol_version CASTV2_1_0
    field(2, 2, source),
    field(3, 2, destination),
    field(4, 2, namespace),
    field(5, 0, 0),                 // payload_type STRING
    field(6, 2, JSON.stringify(data)),
]);
const decode = (buf) => {
    const msg = {};
    let i = 0;
    const readVarint = () => {
        let n = 0, shift = 0, b;
        do { b = buf[i++]; n |= (b & 127) << shift; shift += 7; } while (b & 128);
        return n >>> 0;
    };
    while (i < buf.length) {
        const key = readVarint();
        const no = key >> 3, type = key & 7;
        if (type === 0) { readVarint(); continue; }
        if (type !== 2) break;
        const len = readVarint();
        const val = buf.subarray(i, i + len);
        i += len;
        if (no === 2) msg.source = val.toString();
        else if (no === 3) msg.destination = val.toString();
        else if (no === 4) msg.namespace = val.toString();
        else if (no === 6) msg.payload = val.toString();
    }
    return msg;
};

// --- client ---------------------------------------------------------------------------------
class CastClient extends EventEmitter {
    constructor(host, port = 8009) {
        super();
        this.host = host;
        this.port = port;
        this.sender = `sender-${Math.random().toString(36).slice(2, 8)}`;
        this.reqId = 1;
        this.pending = new Map();
        this.buf = Buffer.alloc(0);
        this.closed = false;
    }

    connect(timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.close(); reject(new Error('Connection timed out')); }, timeoutMs);
            this.sock = tls.connect({ host: this.host, port: this.port, rejectUnauthorized: false }, () => {
                clearTimeout(timer);
                this.send('receiver-0', NS.connection, { type: 'CONNECT' });
                this.hb = setInterval(() => this.send('receiver-0', NS.heartbeat, { type: 'PING' }), 5000);
                resolve(this);
            });
            this.sock.on('data', (d) => this.onData(d));
            this.sock.on('error', (e) => { clearTimeout(timer); this.lastError = e; reject(e); this.close(); });
            this.sock.on('close', () => this.close());
        });
    }

    onData(chunk) {
        this.buf = Buffer.concat([this.buf, chunk]);
        while (this.buf.length >= 4) {
            const len = this.buf.readUInt32BE(0);
            if (this.buf.length < 4 + len) break;
            const msg = decode(this.buf.subarray(4, 4 + len));
            this.buf = this.buf.subarray(4 + len);
            let data;
            try { data = JSON.parse(msg.payload); } catch { continue; }
            if (msg.namespace === NS.heartbeat && data.type === 'PING') {
                this.send(msg.source, NS.heartbeat, { type: 'PONG' });
                continue;
            }
            if (data.requestId && this.pending.has(data.requestId)) {
                const { resolve, timer } = this.pending.get(data.requestId);
                clearTimeout(timer);
                this.pending.delete(data.requestId);
                resolve(data);
            }
            if (msg.namespace === NS.connection && data.type === 'CLOSE' && msg.source === 'receiver-0') this.close();
            this.emit('message', { ...msg, data });
            if (data.type === 'RECEIVER_STATUS') this.emit('status', data.status);
        }
    }

    send(destination, namespace, data) {
        if (this.closed || !this.sock) return;
        const body = encode({ source: this.sender, destination, namespace, data });
        const len = Buffer.alloc(4);
        len.writeUInt32BE(body.length);
        this.sock.write(Buffer.concat([len, body]));
    }

    request(destination, namespace, data, timeoutMs = 10000) {
        const requestId = this.reqId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(requestId); reject(new Error(`${data.type} timed out`)); }, timeoutMs);
            this.pending.set(requestId, { resolve, timer });
            this.send(destination, namespace, { ...data, requestId });
        });
    }

    async getStatus() {
        return (await this.request('receiver-0', NS.receiver, { type: 'GET_STATUS' })).status;
    }

    // Launches an app and connects to it. Returns the running application entry.
    // `fresh` restarts it if it is already running.
    async launch(appId, { fresh = false } = {}) {
        let status = await this.getStatus();
        let app = status.applications?.find((a) => a.appId === appId);
        if (app && fresh) {
            await this.stop(app.sessionId);
            app = null;
        }
        if (!app) {
            const res = await this.request('receiver-0', NS.receiver, { type: 'LAUNCH', appId }, 20000);
            if (res.type === 'LAUNCH_ERROR') throw new Error(`Launch failed: ${res.reason}`);
            status = res.status;
            app = status?.applications?.find((a) => a.appId === appId);
            if (!app) throw new Error('App did not start');
        }
        this.send(app.transportId, NS.connection, { type: 'CONNECT' });
        return app;
    }

    async stop(sessionId) {
        return this.request('receiver-0', NS.receiver, { type: 'STOP', sessionId });
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        clearInterval(this.hb);
        for (const { timer } of this.pending.values()) clearTimeout(timer);
        this.pending.clear();
        this.sock?.destroy();
        this.emit('close');
    }
}

module.exports = { CastClient, NS };
