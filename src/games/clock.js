const { newState, afterDart } = require('./base');

const sequence = (o) => [...Array(20).keys()].map((i) => i + 1).concat(o.bull ? [25] : []);

const clock = {
    id: 'clock',
    name: 'Around the Clock',
    defaults: { bull: true, skip: false, legs: 1 },
    validate: (o) => ({ bull: o.bull !== false, skip: !!o.skip, legs: Math.min(Math.max(+o.legs || 1, 1), 7) }),
    title: () => 'Around the Clock',
    subtitle: (o) => [o.bull ? '1 – 20 + Bull' : '1 – 20', o.skip ? 'Doubles & trebles skip ahead' : null].filter(Boolean).join(' · '),

    init(ids) {
        return newState(ids, () => ({ pos: 0, hits: 0 }));
    },

    dart(st, d, o) {
        const seq = sequence(o);
        const p = st.players[st.cur];
        st.turn.push(d);
        const fx = [];
        if (d.n !== 0 && d.n === seq[p.pos]) {
            const step = o.skip && d.n !== 25 ? d.m : 1;
            p.pos = Math.min(p.pos + step, seq.length);
            p.hits += 1;
            if (p.pos >= seq.length) {
                st.done = true;
                st.winner = st.cur;
            }
        }
        afterDart(st, clock);
        return fx;
    },

    closeTurn(st, rec) {
        const p = st.players[rec.p];
        return { pos: p.pos };
    },

    view(st, o) {
        const seq = sequence(o);
        return st.players.map((p, i) => {
            const mine = st.turns.filter((t) => t.p === i);
            return {
                target: seq[p.pos] ?? null,
                progress: p.pos,
                total: seq.length,
                lastTurn: mine.length ? mine[mine.length - 1] : null,
            };
        });
    },

    stats(st) {
        return st.players.map((p, i) => {
            const darts = st.turns.filter((t) => t.p === i).reduce((a, t) => a + t.darts.length, 0) + (i === st.cur ? st.turn.length : 0);
            return { darts, hits: p.hits };
        });
    },

    turnFx: () => [],
};

module.exports = clock;
