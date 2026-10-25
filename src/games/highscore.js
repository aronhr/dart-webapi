const { newState, afterDart, dartScore } = require('./base');

const highscore = {
    id: 'highscore',
    name: 'High Score',
    defaults: { rounds: 7, legs: 1 },
    validate: (o) => ({
        rounds: [3, 5, 7, 10, 15].includes(+o.rounds) ? +o.rounds : 7,
        legs: Math.min(Math.max(+o.legs || 1, 1), 7),
    }),
    title: () => 'High Score',
    subtitle: (o) => `${o.rounds} rounds · most points wins`,

    init(ids, o) {
        return { ...newState(ids, () => ({ score: 0 })), maxRounds: o.rounds };
    },

    dart(st, d) {
        const p = st.players[st.cur];
        st.turn.push(d);
        p.score += dartScore(d);
        afterDart(st, highscore);
        return [];
    },

    closeTurn(st, rec) {
        return { scored: rec.darts.reduce((a, d) => a + dartScore(d), 0) };
    },

    afterRound(st) {
        if (st.round > st.maxRounds) {
            st.round = st.maxRounds;
            st.done = true;
            const best = Math.max(...st.players.map((p) => p.score));
            st.winner = st.players.findIndex((p) => p.score === best);
        }
    },

    view(st) {
        return st.players.map((p, i) => {
            const mine = st.turns.filter((t) => t.p === i);
            return {
                score: p.score,
                turnScore: i === st.cur ? st.turn.reduce((a, d) => a + dartScore(d), 0) : 0,
                lastTurn: mine.length ? mine[mine.length - 1] : null,
            };
        });
    },

    stats(st) {
        return st.players.map((p, i) => {
            const turns = st.turns.filter((t) => t.p === i);
            return {
                darts: turns.reduce((a, t) => a + t.darts.length, 0) + (i === st.cur ? st.turn.length : 0),
                points: p.score,
                high: turns.reduce((a, t) => Math.max(a, t.scored), 0),
                t180: turns.filter((t) => t.scored === 180).length,
            };
        });
    },

    turnFx(rec) {
        if (rec.scored === 180) return [{ type: '180', p: rec.p }];
        if (rec.scored >= 100) return [{ type: 'ton', p: rec.p, value: rec.scored }];
        return [];
    },
};

module.exports = highscore;
