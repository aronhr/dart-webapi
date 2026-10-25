// Socket.IO protocol. The server owns all state; clients send commands and render snapshots.
//
// client -> server   hello {room, role, cast?}, players:add/update/remove, setup:set, match:start,
//                    dart {n, m}, undo, turn:end, match:rematch, match:end, cast:start {deviceId}, cast:stop
// server -> client   snapshot (whole room state after every change), fx (effects to animate)

const crypto = require('crypto');
const store = require('./store');
const games = require('./games');

const ROOM_RE = /^[a-z0-9-]{1,24}$/;
const COLORS = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6'];

const newId = () => crypto.randomBytes(5).toString('hex');

const room = (name) => {
    const rooms = store.db.rooms;
    if (!rooms[name]) {
        rooms[name] = { setup: { game: 'x01', options: games.games.x01.defaults, players: [] }, match: null, cast: null };
    }
    return rooms[name];
};

module.exports = (io, { cast, publicUrl, build }) => {
    const displayUrl = (name, deviceId) => `${publicUrl}/display?room=${encodeURIComponent(name)}&cast=${encodeURIComponent(deviceId)}&v=${build}`;

    const sockets = (name) => [...(io.sockets.adapter.rooms.get(name) || [])].map((id) => io.sockets.sockets.get(id)).filter(Boolean);

    const isDisplayConnected = (name, deviceId) => sockets(name).some((s) => s.data.role === 'display' && s.data.cast === deviceId);

    const snapshot = (name) => {
        const r = room(name);
        const all = sockets(name);
        return {
            room: name,
            build,
            setup: r.setup,
            setupInfo: games.describe(r.setup.game, r.setup.options),
            match: r.match ? games.view(r.match, store.db.players) : null,
            players: Object.values(store.db.players).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || a.name.localeCompare(b.name)),
            games: games.catalog(),
            cast: { status: cast.status(name), devices: cast.list() },
            displays: all.filter((s) => s.data.role === 'display').length,
            controllerUrl: `${publicUrl}/?room=${encodeURIComponent(name)}`,
            history: store.db.history.filter((h) => h.room === name).slice(0, 10),
        };
    };

    const broadcast = (name) => io.to(name).emit('snapshot', snapshot(name));
    const broadcastAll = () => Object.keys(store.db.rooms).forEach((name) => { if (io.sockets.adapter.rooms.has(name)) broadcast(name); });

    // Records finished matches in the history (and takes them out again if the last dart is undone).
    const syncHistory = (name) => {
        const m = room(name).match;
        if (!m) return;
        const v = games.view(m, store.db.players);
        if (v.winner !== null && !m.finishedAt) {
            m.finishedAt = Date.now();
            store.addHistory({
                id: m.id, room: name, game: m.game, title: v.title, subtitle: v.subtitle,
                winner: m.players[v.winner], startedAt: m.startedAt, finishedAt: m.finishedAt,
                players: v.players.map((p) => ({ id: p.id, name: p.name, color: p.color, legs: p.legs, stats: p.stats })),
            });
        } else if (v.winner === null && m.finishedAt) {
            delete m.finishedAt;
            store.db.history = store.db.history.filter((h) => h.id !== m.id);
        }
    };

    cast.on('change', () => {
        // Remember which TV each room is on so a server restart can re-attach to it.
        for (const [name, r] of Object.entries(store.db.rooms)) {
            const st = cast.status(name);
            r.cast = st && st.state === 'casting' ? { deviceId: st.deviceId } : null;
        }
        store.save();
        broadcastAll();
    });

    // Re-attach to TVs that were showing a scoreboard before a restart.
    for (const [name, r] of Object.entries(store.db.rooms)) {
        if (r.cast?.deviceId) cast.resume(name, r.cast.deviceId, displayUrl(name, r.cast.deviceId));
    }

    io.on('connection', (socket) => {
        const commands = {
            'players:add': ({ name }) => {
                name = String(name || '').trim().slice(0, 20);
                if (!name) throw new Error('Name is required');
                const existing = Object.values(store.db.players).find((p) => p.name.toLowerCase() === name.toLowerCase());
                if (existing) return { id: existing.id };
                const used = new Set(Object.values(store.db.players).map((p) => p.color));
                const color = COLORS.find((c) => !used.has(c)) || COLORS[Object.keys(store.db.players).length % COLORS.length];
                const id = newId();
                store.db.players[id] = { id, name, color, createdAt: Date.now() };
                return { id };
            },
            'players:update': ({ id, name, color }) => {
                const p = store.db.players[id];
                if (!p) throw new Error('Unknown player');
                if (name && String(name).trim()) p.name = String(name).trim().slice(0, 20);
                if (color && /^#[0-9a-f]{6}$/i.test(color)) p.color = color;
            },
            'players:remove': ({ id }) => {
                delete store.db.players[id];
                for (const r of Object.values(store.db.rooms)) r.setup.players = r.setup.players.filter((p) => p !== id);
            },
            'setup:set': ({ game, options, players }) => {
                const r = room(socket.data.room);
                if (game && games.games[game] && game !== r.setup.game) {
                    r.setup.game = game;
                    r.setup.options = { ...games.games[game].defaults, ...(r.setup.optionsByGame?.[game] || {}) };
                }
                if (options) r.setup.options = games.describe(r.setup.game, { ...r.setup.options, ...options }).options;
                r.setup.optionsByGame = { ...(r.setup.optionsByGame || {}), [r.setup.game]: r.setup.options };
                if (Array.isArray(players)) r.setup.players = players.filter((id) => store.db.players[id]).slice(0, 8);
            },
            'match:start': () => {
                const r = room(socket.data.room);
                if (!r.setup.players.length) throw new Error('Pick at least one player');
                const { options } = games.describe(r.setup.game, r.setup.options);
                r.match = { id: newId(), game: r.setup.game, options, players: [...r.setup.players], darts: [], startedAt: Date.now() };
                r.setup.players.forEach((id) => { store.db.players[id].lastPlayed = Date.now(); });
                emitFx(socket.data.room, [{ type: 'start' }]);
            },
            dart: ({ n, m }) => {
                const r = room(socket.data.room);
                if (!r.match) throw new Error('No match running');
                const fx = games.addDart(r.match, { n, m });
                syncHistory(socket.data.room);
                emitFx(socket.data.room, fx);
            },
            undo: () => {
                const r = room(socket.data.room);
                if (!r.match?.darts.length) return;
                r.match.darts.pop();
                syncHistory(socket.data.room);
                emitFx(socket.data.room, [{ type: 'undo' }]);
            },
            'turn:end': () => {
                const r = room(socket.data.room);
                if (!r.match) return;
                const fx = games.endTurn(r.match);
                syncHistory(socket.data.room);
                emitFx(socket.data.room, fx);
            },
            'match:rematch': () => {
                const r = room(socket.data.room);
                if (!r.match) return;
                // Same game, the starting player moves one seat along.
                const players = [...r.match.players.slice(1), r.match.players[0]];
                r.setup.players = players;
                r.match = { id: newId(), game: r.match.game, options: r.match.options, players, darts: [], startedAt: Date.now() };
                emitFx(socket.data.room, [{ type: 'start' }]);
            },
            'match:end': () => {
                room(socket.data.room).match = null;
            },
            'cast:start': async ({ deviceId }) => {
                const name = socket.data.room;
                await cast.start(name, deviceId, displayUrl(name, deviceId));
            },
            'cast:stop': async () => {
                await cast.stop(socket.data.room);
            },
        };

        const emitFx = (name, events) => {
            if (events.length) io.to(name).emit('fx', { at: Date.now(), events });
        };

        socket.on('hello', ({ room: name, role, cast: castId } = {}, ack) => {
            name = String(name || 'home').toLowerCase();
            if (!ROOM_RE.test(name)) return ack?.({ ok: false, error: 'Bad room name' });
            if (socket.data.room && socket.data.room !== name) socket.leave(socket.data.room);
            socket.data = { room: name, role: role === 'display' ? 'display' : 'controller', cast: castId || null };
            socket.join(name);
            console.log(`${socket.data.role} joined ${name} from ${socket.handshake.address}${castId ? ' (cast)' : ''}`);
            ack?.({ ok: true });
            broadcast(name);
        });

        for (const [event, fn] of Object.entries(commands)) {
            socket.on(event, async (payload, ack) => {
                if (typeof payload === 'function') [payload, ack] = [{}, payload];
                if (!socket.data.room) return ack?.({ ok: false, error: 'Not joined' });
                try {
                    const result = await fn(payload || {});
                    store.save();
                    ack?.({ ok: true, ...(result || {}) });
                } catch (e) {
                    ack?.({ ok: false, error: e.message });
                } finally {
                    broadcast(socket.data.room);
                }
            });
        }

        socket.on('disconnect', () => {
            if (socket.data.room) broadcast(socket.data.room);
        });
    });

    return { isDisplayConnected };
};
