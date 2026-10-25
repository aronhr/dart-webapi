// Checkout suggestions for X01, precomputed for every score / darts left / out rule.

const singles = [];
for (let n = 1; n <= 20; n++) singles.push({ n, m: 1 }, { n, m: 2 }, { n, m: 3 });
singles.push({ n: 25, m: 1 }, { n: 25, m: 2 });

// Lower is better. Favour the doubles players usually practise.
const DOUBLE_RANK = [20, 16, 8, 18, 12, 10, 4, 14, 6, 2, 25, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];

const label = (d) => (d.n === 25 ? (d.m === 2 ? 'Bull' : '25') : (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.n);

// Cost of a set-up dart: big trebles and plain singles are easy, odd trebles less so.
const setupCost = (d) => {
    if (d.n === 25) return d.m === 2 ? 14 : 9;
    if (d.m === 1) return 1 + (20 - d.n) * 0.2;
    if (d.m === 3) return 2 + (20 - d.n) * 0.6;
    return 12 + DOUBLE_RANK.indexOf(d.n) * 0.3; // double as a set-up dart
};

const finishCost = (d, out) => {
    if (out === 'single') return d.m === 1 ? 0 : d.m === 2 ? 1 : 3; // any dart; prefer singles
    if (d.m === 2) return DOUBLE_RANK.indexOf(d.n);
    return 25 + (20 - d.n) * 0.5; // master out: trebles are allowed but rarer
};

const finishes = (d, out) => out === 'single' || d.m === 2 || (out === 'master' && d.m === 3);

const tables = {};
for (const out of ['double', 'master', 'single']) {
    const best = {}; // `${score}:${dartsLeft}` -> { cost, route }
    const consider = (score, darts, route, cost) => {
        for (let left = darts; left <= 3; left++) {
            const k = `${score}:${left}`;
            if (!best[k] || cost < best[k].cost) best[k] = { cost, route };
        }
    };
    const finals = singles.filter((d) => finishes(d, out));
    for (const f of finals) {
        const fs = f.n * f.m;
        consider(fs, 1, [f], finishCost(f, out));
        for (const a of singles) {
            const c2 = 1000 + finishCost(f, out) + setupCost(a);
            consider(fs + a.n * a.m, 2, [a, f], c2);
            for (const b of singles) {
                consider(fs + a.n * a.m + b.n * b.m, 3, [a, b, f], 2000 + finishCost(f, out) + setupCost(a) * 1.1 + setupCost(b));
            }
        }
    }
    tables[out] = best;
}

const suggestCheckout = (score, dartsLeft, out = 'double') => {
    const hit = tables[out]?.[`${score}:${dartsLeft}`];
    return hit ? hit.route.map(label) : null;
};

module.exports = { suggestCheckout };
