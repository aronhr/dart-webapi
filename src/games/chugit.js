// Chug it: count down from 183 with no bust and no double out.
// First one to reach zero or below wins, everybody else chugs.
const { newState, afterDart, dartScore } = require('./base');

const START = 183;

const chugit = {
    id: 'chugit',
    name: 'Chug it',
    defaults: { legs: 1 },
    validate: (o) => ({ legs: Math.min(Math.max(+o.legs || 1, 1), 7) }),
    title: () => 'Chug it',
    subtitle: () => `${START} down · no bust`,

    init(ids) {
        return newState(ids, () => ({ score: START, start: START }));
    },

    dart(st, d) {
        const p = st.players[st.cur];
        if (st.turn.length === 0) p.turnStart = p.score;
        st.turn.push(d);
        p.score -= dartScore(d);
        if (p.score <= 0) {
            st.done = true;
            st.winner = st.cur;
        }
        afterDart(st, chugit);
        return [];
    },

    closeTurn(st, rec) {
        const p = st.players[rec.p];
        return { scored: p.turnStart - p.score };
    },

    view(st) {
        return st.players.map((p, i) => {
            const mine = st.turns.filter((t) => t.p === i);
            return {
                score: Math.max(p.score, 0),
                start: p.start,
                turnScore: i === st.cur && st.turn.length ? p.turnStart - p.score : 0,
                lastTurn: mine.length ? mine[mine.length - 1] : null,
            };
        });
    },

    stats(st) {
        return st.players.map((p, i) => {
            const turns = st.turns.filter((t) => t.p === i);
            return {
                darts: turns.reduce((a, t) => a + t.darts.length, 0) + (i === st.cur ? st.turn.length : 0),
                high: turns.reduce((a, t) => Math.max(a, t.scored), 0),
            };
        });
    },

    turnFx: (rec) => (rec.scored >= 100 ? [{ type: 'ton', p: rec.p, value: rec.scored }] : []),
};

module.exports = chugit;
