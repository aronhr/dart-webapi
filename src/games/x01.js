const { newState, afterDart, dartScore } = require('./base');
const { suggestCheckout } = require('./checkout');

const finishOk = (d, out) => out === 'single' || d.m === 2 || (out === 'master' && d.m === 3);

const x01 = {
    id: 'x01',
    name: 'X01',
    defaults: { start: 501, out: 'double', in: 'single', legs: 1 },
    validate(o) {
        return {
            start: [101, 170, 301, 501, 701, 901].includes(+o.start) ? +o.start : 501,
            out: ['double', 'single', 'master'].includes(o.out) ? o.out : 'double',
            in: o.in === 'double' ? 'double' : 'single',
            legs: Math.min(Math.max(+o.legs || 1, 1), 7),
        };
    },
    title: (o) => `${o.start}`,
    subtitle(o) {
        const parts = [];
        if (o.in === 'double') parts.push('Double in');
        parts.push(o.out === 'double' ? 'Double out' : o.out === 'master' ? 'Master out' : 'Straight out');
        return parts.join(' · ');
    },

    init(ids, o) {
        return newState(ids, () => ({ score: o.start, opened: o.in !== 'double' }));
    },

    dart(st, d, o) {
        const p = st.players[st.cur];
        if (st.turn.length === 0) {
            p.turnStart = p.score;
            p.openedAtStart = p.opened;
        }
        st.turn.push(d);
        let pts = dartScore(d);
        if (!p.opened) {
            if (d.m === 2) p.opened = true;
            else pts = 0;
        }
        const rest = p.score - pts;
        const bust = rest < 0 || (o.out !== 'single' && rest === 1) || (rest === 0 && !finishOk(d, o.out));
        const fx = [];
        if (bust) {
            p.score = p.turnStart;
            p.opened = p.openedAtStart;
            fx.push({ type: 'bust', p: st.cur });
        } else {
            p.score = rest;
            if (rest === 0) {
                st.done = true;
                st.winner = st.cur;
            }
        }
        afterDart(st, x01, { bust });
        return fx;
    },

    closeTurn(st, rec, result) {
        const p = st.players[rec.p];
        const scored = result.bust ? 0 : p.turnStart - p.score;
        return { scored, bust: !!result.bust, checkout: st.done && st.winner === rec.p ? scored : 0, left: p.score };
    },

    view(st, o) {
        const dartsLeft = 3 - st.turn.length;
        return st.players.map((p, i) => {
            const mine = st.turns.filter((t) => t.p === i);
            const scoredNow = i === st.cur && st.turn.length ? p.turnStart - p.score : 0;
            const darts = i === st.cur ? dartsLeft : 3;
            return {
                score: p.score,
                opened: p.opened,
                turnScore: scoredNow,
                lastTurn: mine.length ? mine[mine.length - 1] : null,
                checkout: p.opened && !st.done ? suggestCheckout(p.score, darts, o.out) : null,
            };
        });
    },

    // Per-leg stats, summed by the match layer.
    stats(st) {
        return st.players.map((p, i) => {
            const darts = st.turns.filter((t) => t.p === i).reduce((a, t) => a + t.darts.length, 0) +
                (i === st.cur ? st.turn.length : 0);
            const turns = st.turns.filter((t) => t.p === i);
            const points = turns.reduce((a, t) => a + t.scored, 0) +
                (i === st.cur && st.turn.length ? p.turnStart - p.score : 0);
            const first9 = turns.slice(0, 3);
            return {
                darts,
                points,
                first9Darts: first9.reduce((a, t) => a + t.darts.length, 0),
                first9Points: first9.reduce((a, t) => a + t.scored, 0),
                high: turns.reduce((a, t) => Math.max(a, t.scored), 0),
                t180: turns.filter((t) => t.scored === 180).length,
                t140: turns.filter((t) => t.scored >= 140).length,
                t100: turns.filter((t) => t.scored >= 100).length,
                bestCheckout: turns.reduce((a, t) => Math.max(a, t.checkout || 0), 0),
            };
        });
    },

    // Effects worth celebrating when a turn closes.
    turnFx(rec) {
        if (rec.bust) return [];
        if (rec.checkout) return [{ type: 'checkout', p: rec.p, value: rec.checkout }];
        if (rec.scored === 180) return [{ type: '180', p: rec.p }];
        if (rec.scored >= 100) return [{ type: 'ton', p: rec.p, value: rec.scored }];
        return [];
    },
};

module.exports = x01;
