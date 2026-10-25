// Match layer: a match is just its settings plus the list of darts thrown.
// Every state is rebuilt by replaying those darts, so undo is always exact.

const { isValidDart, dartLabel } = require('./base');

const games = Object.fromEntries(
    [require('./x01'), require('./cricket'), require('./clock'), require('./chugit'), require('./highscore')]
        .map((g) => [g.id, g]),
);

const catalog = () => Object.values(games).map((g) => ({ id: g.id, name: g.name, defaults: g.defaults }));

const describe = (gameId, options) => {
    const g = games[gameId];
    const o = g.validate(options || {});
    return { title: g.title(o), subtitle: g.subtitle(o), options: o };
};

const replay = (match) => {
    const g = games[match.game];
    const o = match.options;
    const n = match.players.length;
    const wins = Array(n).fill(0);
    const legs = [];
    let fx = [];
    let winner = null;

    const startLeg = () => {
        const k = legs.length;
        const order = match.players.map((_, i) => (i + k) % n); // leg k starts with player k
        const leg = { order, state: g.init(order.map((i) => match.players[i]), o) };
        legs.push(leg);
        return leg;
    };

    let leg = startLeg();
    for (const d of match.darts) {
        if (winner !== null) break;
        if (leg.state.done) leg = startLeg();
        const turnsBefore = leg.state.turns.length;
        fx = g.dart(leg.state, d, o).map((e) => ({ ...e, p: leg.order[e.p] }));
        for (const rec of leg.state.turns.slice(turnsBefore)) {
            fx.push(...g.turnFx(rec).map((e) => ({ ...e, p: leg.order[e.p] })));
        }
        if (leg.state.done) {
            const w = leg.order[leg.state.winner];
            wins[w] += 1;
            if (wins[w] >= o.legs) {
                winner = w;
                fx.push({ type: 'match', p: w });
            } else {
                fx.push({ type: 'leg', p: w });
            }
        }
    }
    return { g, o, legs, leg, wins, winner, fx };
};

const sumStats = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
        out[k] = k === 'high' || k === 'bestCheckout' ? Math.max(out[k] || 0, v) : (out[k] || 0) + v;
    }
    return out;
};

// What the controller and the TV get to see.
const view = (match, playersById) => {
    const { g, o, legs, leg, wins, winner } = replay(match);
    const st = leg.state;
    const perLeg = g.view(st, o);
    const n = match.players.length;
    const stats = Array(n).fill(null).map(() => ({}));
    for (const l of legs) {
        g.stats(l.state).forEach((s, i) => { stats[l.order[i]] = sumStats(stats[l.order[i]], s); });
    }
    const players = match.players.map((id, i) => {
        const li = leg.order.indexOf(i);
        const s = stats[i];
        if (s.darts && s.points !== undefined) s.avg = Math.round((s.points / s.darts) * 300) / 100;
        if (s.first9Darts) s.first9 = Math.round((s.first9Points / s.first9Darts) * 300) / 100;
        if (s.rounds) s.mpr = Math.round((s.marks / s.rounds) * 100) / 100;
        const pv = perLeg[li];
        return {
            id,
            name: playersById[id]?.name ?? '?',
            color: playersById[id]?.color ?? '#888',
            legs: wins[i],
            ...pv,
            lastTurn: pv.lastTurn ? { ...pv.lastTurn, p: undefined, darts: pv.lastTurn.darts.map(dartLabel) } : null,
            stats: s,
        };
    });
    const legDone = st.done;
    return {
        id: match.id,
        game: match.game,
        ...describe(match.game, o),
        targets: g.targets,
        legNo: legs.length,
        players,
        current: legDone ? null : leg.order[st.cur],
        next: legDone && winner === null ? legs.length % n : null,
        round: st.round,
        maxRounds: st.maxRounds ?? null,
        turn: st.turn.map(dartLabel),
        legWinner: legDone ? leg.order[st.winner] : null,
        winner,
        dartCount: match.darts.length,
        startedAt: match.startedAt,
    };
};

const addDart = (match, d) => {
    if (!isValidDart(d)) throw new Error('Invalid dart');
    const before = replay(match);
    if (before.winner !== null) throw new Error('The match is over');
    match.darts.push({ n: d.n, m: d.m });
    return replay(match).fx;
};

// Fill the rest of the turn with misses (e.g. darts that bounced out or weren't entered).
const endTurn = (match) => {
    const { leg, winner } = replay(match);
    if (winner !== null || leg.state.done) return [];
    const left = 3 - leg.state.turn.length;
    let fx = [];
    for (let i = 0; i < left; i++) fx = addDart(match, { n: 0, m: 1 });
    return fx;
};

module.exports = { games, catalog, describe, replay, view, addDart, endTurn };
