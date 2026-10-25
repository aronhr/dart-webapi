const { newState, afterDart } = require('./base');

const TARGETS = [20, 19, 18, 17, 16, 15, 25];

const closedAll = (p) => TARGETS.every((t) => p.marks[t] >= 3);

const cricket = {
    id: 'cricket',
    name: 'Cricket',
    defaults: { mode: 'standard', legs: 1 },
    validate: (o) => ({
        mode: o.mode === 'cutthroat' ? 'cutthroat' : 'standard',
        legs: Math.min(Math.max(+o.legs || 1, 1), 7),
    }),
    title: () => 'Cricket',
    subtitle: (o) => (o.mode === 'cutthroat' ? 'Cut-throat' : 'Standard'),
    targets: TARGETS,

    init(ids) {
        return newState(ids, () => ({ marks: Object.fromEntries(TARGETS.map((t) => [t, 0])), points: 0, totalMarks: 0 }));
    },

    dart(st, d, o) {
        const p = st.players[st.cur];
        st.turn.push(d);
        const fx = [];
        if (TARGETS.includes(d.n)) {
            const before = p.marks[d.n];
            const extra = Math.max(before + d.m - 3, 0);
            p.marks[d.n] = Math.min(before + d.m, 3);
            p.totalMarks += d.m;
            if (before < 3 && p.marks[d.n] === 3) fx.push({ type: 'closed', p: st.cur, n: d.n });
            if (extra) {
                const open = st.players.filter((q) => q !== p && q.marks[d.n] < 3);
                if (o.mode === 'cutthroat') open.forEach((q) => { q.points += extra * d.n; });
                else if (open.length) p.points += extra * d.n;
            }
        }
        // A player wins once everything is closed and they lead on points (or trail, in cut-throat).
        for (const [i, q] of st.players.entries()) {
            if (!closedAll(q)) continue;
            const others = st.players.filter((r) => r !== q);
            const leads = o.mode === 'cutthroat'
                ? others.every((r) => q.points <= r.points)
                : others.every((r) => q.points >= r.points);
            if (leads) {
                st.done = true;
                st.winner = i;
                break;
            }
        }
        afterDart(st, cricket);
        return fx;
    },

    closeTurn(st, rec) {
        const marks = rec.darts.reduce((a, d) => a + (TARGETS.includes(d.n) ? d.m : 0), 0);
        return { marks };
    },

    view(st) {
        return st.players.map((p, i) => {
            const mine = st.turns.filter((t) => t.p === i);
            return { marks: p.marks, points: p.points, lastTurn: mine.length ? mine[mine.length - 1] : null };
        });
    },

    stats(st) {
        return st.players.map((p, i) => {
            const turns = st.turns.filter((t) => t.p === i);
            const darts = turns.reduce((a, t) => a + t.darts.length, 0) + (i === st.cur ? st.turn.length : 0);
            return { darts, marks: p.totalMarks, rounds: turns.length + (i === st.cur && st.turn.length ? 1 : 0) };
        });
    },

    turnFx(rec) {
        if (rec.marks >= 9) return [{ type: 'whitehorse', p: rec.p, value: rec.marks }];
        if (rec.marks >= 6) return [{ type: 'marks', p: rec.p, value: rec.marks }];
        return [];
    },
};

module.exports = cricket;
