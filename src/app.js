require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const store = require('./store');
const { CastManager } = require('./cast/manager');

const PORT = process.env.PORT || 8687;
// Address the TV uses to load the scoreboard – must be reachable from the LAN.
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
// Built frontend (dart-webapp `nuxt generate` output).
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, '..', 'public');

const indexFile = path.join(WEB_DIR, 'index.html');
const build = fs.existsSync(indexFile) ? String(Math.floor(fs.statSync(indexFile).mtimeMs)) : 'dev';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 10000, pingTimeout: 8000 });

let rooms;
const cast = new CastManager({ isDisplayConnected: (...a) => rooms?.isDisplayConnected(...a) });
rooms = require('./rooms')(io, { cast, publicUrl: PUBLIC_URL, build });

// The TV page reports its browser and any errors here (shows up in `docker logs dart`).
app.post('/api/clientlog', express.text({ type: '*/*', limit: '8kb' }), (req, res) => {
    console.log(`client ${req.ip.replace('::ffff:', '')}: ${String(req.body).slice(0, 600)}`);
    res.status(204).end();
});

app.get('/api/health', (req, res) => res.json({ ok: true, build, devices: cast.list().length }));

app.use(express.static(WEB_DIR, {
    setHeaders: (res, file) => {
        // Hashed assets can be cached forever, pages never (so the TV always gets the latest build).
        res.setHeader('Cache-Control', file.includes(`${path.sep}_nuxt${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
}));
app.get(/^\/(?!api|socket\.io).*/, (req, res, next) => {
    const page = ['200.html', 'index.html'].map((f) => path.join(WEB_DIR, f)).find((f) => fs.existsSync(f));
    if (!page) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(page);
});

cast.startDiscovery();

server.listen(PORT, () => console.log(`Dart server on :${PORT} (public ${PUBLIC_URL}, build ${build})`));

const shutdown = () => {
    store.flush();
    cast.close();
    process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
