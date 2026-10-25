// Tiny JSON file store: saved players, each room's setup/match and finished matches.
// Writes are debounced and atomic (write to tmp + rename) so a crash never corrupts it.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'db.json');
const HISTORY_MAX = 300;

const empty = () => ({ players: {}, rooms: {}, history: [] });

let db = empty();
try {
    db = { ...empty(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch (e) {
    if (e.code !== 'ENOENT') console.error('Could not read db.json, starting fresh:', e.message);
}

let timer = null;
const flush = () => {
    clearTimeout(timer);
    timer = null;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db));
    fs.renameSync(`${FILE}.tmp`, FILE);
};
const save = () => {
    if (!timer) timer = setTimeout(flush, 300);
};

const addHistory = (entry) => {
    db.history.unshift(entry);
    db.history.length = Math.min(db.history.length, HISTORY_MAX);
    save();
};

module.exports = { get db() { return db; }, save, flush, addHistory };
