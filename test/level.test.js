import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blankRows,
  decodeLevel,
  encodeLevel,
  eraseOn,
  findCells,
  placeOn,
  summarize,
} from '../src/level.js';

test('start and finish stay unique and place does not mutate the input', () => {
  const original = blankRows();
  const first = placeOn(original, 1, 2, 'S');
  assert.equal(original[2][1], '.');
  assert.equal(first.rows[2][1], 'S');
  const moved = placeOn(first.rows, 8, 4, 'S');
  assert.equal(findCells(moved.rows, 'S').length, 1);
  assert.equal(moved.rows[4][8], 'S');
  assert.equal(moved.rows[2][1], '.');
  const finished = placeOn(moved.rows, 18, 14, 'F');
  assert.equal(findCells(finished.rows, 'F').length, 1);
});

test('erase and summarize count every piece', () => {
  let rows = blankRows();
  rows = placeOn(rows, 0, 0, 'B').rows;
  rows = placeOn(rows, 1, 0, 'W').rows;
  rows = placeOn(rows, 2, 0, 'E').rows;
  rows = placeOn(rows, 3, 0, 'E').rows;
  rows = placeOn(rows, 4, 0, 'C').rows;
  rows = placeOn(rows, 5, 0, 'S').rows;
  rows = placeOn(rows, 6, 0, 'F').rows;
  const counts = summarize(rows);
  assert.deepEqual(counts, { B: 1, W: 1, E: 2, C: 1, S: 1, F: 1 });
  rows = eraseOn(rows, 2, 0).rows;
  assert.equal(summarize(rows).E, 1);
  assert.equal(eraseOn(rows, 2, 0).dirty.length, 0);
});

test('share codes round-trip and stay url-safe', async () => {
  let rows = blankRows();
  const plan = [
    [1, 7, 'S'],
    [18, 7, 'F'],
    [4, 4, 'B'],
    [5, 4, 'B'],
    [6, 6, 'W'],
    [8, 8, 'E'],
    [10, 5, 'E'],
    [12, 10, 'C'],
    [13, 10, 'C'],
  ];
  for (const [x, y, ch] of plan) rows = placeOn(rows, x, y, ch).rows;
  const code = await encodeLevel(rows);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.equal(code[0], 'z');
  const decoded = await decodeLevel(code);
  assert.deepEqual(decoded, rows);
  assert.equal(await decodeLevel('nope'), null);
  assert.equal(await decodeLevel(''), null);
  assert.equal(await decodeLevel('z@@@'), null);
});
