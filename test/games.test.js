const test = require('node:test');
const assert = require('node:assert/strict');
const { view, addDart, endTurn, describe: describeGame } = require('../src/games');
const { suggestCheckout } = require('../src/games/checkout');

const people = { a: { name: 'Aron' }, b: { name: 'Bjarki' } };
const newMatch = (game, options = {}, players = ['a', 'b']) =>
    ({ id: 'm', game, options: describeGame(game, options).options, players, darts: [], startedAt: 0 });
const T = (n) => ({ n, m: 3 });
const D = (n) => ({ n, m: 2 });
const S = (n) => ({ n, m: 1 });
const M = { n: 0, m: 1 };
const throwAll = (m, darts) => darts.map((d) => addDart(m, d)).flat();

test('x01: scoring, turn change and 180 effect', () => {
    const m = newMatch('x01', { start: 501 });
    const fx = throwAll(m, [T(20), T(20), T(20)]);
    assert.ok(fx.some((e) => e.type === '180' && e.p === 0));
    const v = view(m, people);
    assert.equal(v.players[0].score, 321);
    assert.equal(v.current, 1);
    assert.deepEqual(v.players[0].lastTurn.darts, ['T20', 'T20', 'T20']);
    assert.equal(v.players[0].stats.avg, 180);
});

test('x01: bust restores the score and ends the turn', () => {
    const m = newMatch('x01', { start: 101 });
    throwAll(m, [T(20), S(1), M, S(1), S(1), S(1)]); // a: 40 left, b: 98 left
    const fx = throwAll(m, [T(20)]); // a busts on the first dart
    assert.ok(fx.some((e) => e.type === 'bust'));
    const v = view(m, people);
    assert.equal(v.players[0].score, 40);
    assert.equal(v.current, 1);
});

test('x01: leaving 1 or finishing on a single is a bust with double out', () => {
    const m = newMatch('x01', { start: 101 });
    throwAll(m, [T(20), S(1), M, S(1), S(1), S(1), S(19), S(20)]); // a: 40 -> 21 -> bust (1)
    assert.equal(view(m, people).players[0].score, 40);
    throwAll(m, [S(1), S(1), S(1), S(20), S(20)]); // a: 40 -> 20 -> 0 on a single = bust
    assert.equal(view(m, people).players[0].score, 40);
});

test('x01: checkout wins, straight out allows singles', () => {
    const m = newMatch('x01', { start: 101 });
    const fx = throwAll(m, [T(20), S(1), D(20)]);
    assert.ok(fx.some((e) => e.type === 'checkout' && e.value === 101));
    assert.equal(view(m, people).winner, 0);
    const s = newMatch('x01', { start: 101, out: 'single' });
    const sfx = throwAll(s, [T(20), S(20), S(20), M, M, M, S(1)]);
    const v = view(s, people);
    assert.equal(v.winner, 0);
    assert.ok(sfx.some((e) => e.type === 'match'));
    assert.equal(v.players[0].stats.bestCheckout, 1); // the finishing turn was just S1
});

test('x01: double in ignores darts until a double', () => {
    const m = newMatch('x01', { start: 301, in: 'double' });
    throwAll(m, [T(20), D(10), S(5)]);
    assert.equal(view(m, people).players[0].score, 301 - 25);
});

test('x01: legs rotate the starting player and undo crosses legs', () => {
    const m = newMatch('x01', { start: 101, out: 'single', legs: 2 });
    let fx = throwAll(m, [T(20), S(20), S(20), M, M, M, S(1)]);
    assert.ok(fx.some((e) => e.type === 'leg'));
    let v = view(m, people);
    assert.equal(v.legWinner, 0);
    assert.equal(v.next, 1);
    assert.deepEqual(v.players.map((p) => p.legs), [1, 0]);
    fx = throwAll(m, [S(1)]); // first dart of leg 2 is thrown by b
    v = view(m, people);
    assert.equal(v.legNo, 2);
    assert.equal(v.players[1].score, 100);
    m.darts.pop();
    m.darts.pop();
    v = view(m, people);
    assert.equal(v.legNo, 1);
    assert.equal(v.players[0].score, 1);
});

test('endTurn fills the turn with misses', () => {
    const m = newMatch('x01', { start: 501 });
    addDart(m, T(20));
    endTurn(m);
    const v = view(m, people);
    assert.equal(v.current, 1);
    assert.deepEqual(v.players[0].lastTurn.darts, ['T20', 'Miss', 'Miss']);
});

test('cricket: closing, scoring and winning', () => {
    const m = newMatch('cricket');
    throwAll(m, [T(20), T(20), S(1)]); // a closes 20 and scores 60
    let v = view(m, people);
    assert.equal(v.players[0].marks[20], 3);
    assert.equal(v.players[0].points, 60);
    endTurn(m);
    // a closes everything while leading
    throwAll(m, [T(19), T(18), T(17)]);
    endTurn(m);
    throwAll(m, [T(16), T(15), D(25)]);
    endTurn(m);
    const fx = throwAll(m, [S(25)]);
    v = view(m, people);
    assert.equal(v.winner, 0);
    assert.ok(fx.some((e) => e.type === 'match'));
});

test('cricket: cut-throat gives points to opponents', () => {
    const m = newMatch('cricket', { mode: 'cutthroat' });
    throwAll(m, [T(20), T(20)]);
    const v = view(m, people);
    assert.equal(v.players[0].points, 0);
    assert.equal(v.players[1].points, 60);
});

test('around the clock: advances on target and wins at bull', () => {
    const m = newMatch('clock', { bull: true }, ['a']);
    for (let n = 1; n <= 20; n++) addDart(m, S(n));
    assert.equal(view(m, people).players[0].target, 25);
    addDart(m, D(25));
    assert.equal(view(m, people).winner, 0);
});

test('high score: ends after the last round', () => {
    const m = newMatch('highscore', { rounds: 3 });
    for (let i = 0; i < 6; i++) throwAll(m, [S(20), S(20), S(i % 2 ? 1 : 20)]);
    const v = view(m, people);
    assert.equal(v.winner, 0);
    assert.equal(v.players[0].score, 180);
    assert.throws(() => addDart(m, S(1)));
});

test('chugit: no bust, zero or below wins', () => {
    const m = newMatch('chugit');
    throwAll(m, [T(20), T(20), T(20), S(1), S(1), S(1), D(25)]);
    const v = view(m, people);
    assert.equal(v.winner, 0);
    assert.equal(v.players[0].score, 0); // -47, shown as 0
});

test('invalid darts are rejected', () => {
    const m = newMatch('x01');
    assert.throws(() => addDart(m, { n: 25, m: 3 }));
    assert.throws(() => addDart(m, { n: 21, m: 1 }));
    assert.throws(() => addDart(m, { n: 0, m: 2 }));
});

test('checkout suggestions', () => {
    assert.deepEqual(suggestCheckout(170, 3), ['T20', 'T20', 'Bull']);
    assert.deepEqual(suggestCheckout(40, 1), ['D20']);
    assert.deepEqual(suggestCheckout(100, 2), ['T20', 'D20']);
    assert.equal(suggestCheckout(169, 3), null);
    assert.equal(suggestCheckout(159, 3), null);
    assert.equal(suggestCheckout(101, 1), null);
    assert.equal(suggestCheckout(3, 2)?.length, 2);
    assert.deepEqual(suggestCheckout(5, 1, 'single'), ['5']);
});
