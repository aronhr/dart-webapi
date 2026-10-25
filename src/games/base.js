// Shared turn mechanics for all games.
//
// A dart is { n, m }: n = 0 (miss), 1-20 or 25 (bull), m = 1/2/3.
// 25 can only be single (outer bull, 25) or double (bullseye, 50).

const isValidDart = (d) =>
    d && Number.isInteger(d.n) && Number.isInteger(d.m) &&
    ((d.n >= 1 && d.n <= 20 && d.m >= 1 && d.m <= 3) ||
        (d.n === 25 && (d.m === 1 || d.m === 2)) ||
        (d.n === 0 && d.m === 1));

const dartScore = (d) => d.n * d.m;

const dartLabel = (d) => {
    if (d.n === 0) return 'Miss';
    if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
    return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n;
};

const newState = (playerIds, makePlayer) => ({
    players: playerIds.map((id) => ({ id, ...makePlayer(id) })),
    cur: 0,
    round: 1,
    turn: [],        // darts in the current turn
    turns: [],       // finished turns: { p, darts, ...game specific }
    done: false,
    winner: null,
});

// Called by games after each dart. `result.bust` or a finished game ends the turn early.
const afterDart = (st, game, result = {}) => {
    if (st.done || result.bust || st.turn.length >= 3) {
        const rec = { p: st.cur, darts: st.turn, round: st.round, ...(result.rec || {}) };
        if (game.closeTurn) Object.assign(rec, game.closeTurn(st, rec, result));
        st.turns.push(rec);
        st.turn = [];
        if (!st.done) {
            st.cur = (st.cur + 1) % st.players.length;
            if (st.cur === 0) st.round += 1;
            if (game.afterRound && st.cur === 0) game.afterRound(st);
        }
    }
};

module.exports = { isValidDart, dartScore, dartLabel, newState, afterDart };
