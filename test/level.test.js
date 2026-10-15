import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLS,
  ROWS,
  blankRows,
  decodeLevel,
  encodeLevel,
  eraseOn,
  findCells,
  jaspersLevel,
  placeOn,
  summarize,
} from '../src/level.js';
import { madSpeed } from '../src/sim.js';

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
  assert.deepEqual(counts, { B: 1, W: 1, E: 2, C: 1, S: 1, F: 1, M: 0, T: 0 });
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

test("Jasper's Level 1 layout is unchanged", () => {
  assert.deepEqual(jaspersLevel(), [
    'WWWWWWWWWWWWWWWWWWWW',
    'W..................W',
    'W.S..C..B..........W',
    'W.......B..........W',
    'W.......B...C.BBB..W',
    'W..................W',
    'W..................W',
    'W.......B..........W',
    'W..C....B..CE......W',
    'W.......B..........W',
    'W.BBBBBBBBB..BBB...W',
    'W..................W',
    'W..............C.F.W',
    'W..................W',
    'WWWWWWWWWWWWWWWWWWWW',
  ]);
});

test("Jasper's Level 1 has a blue border, five coins, one mad enemy, and a long path", () => {
  const level = jaspersLevel();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const edge = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
      if (edge) assert.equal(level[y][x], 'W');
    }
  }
  const counts = summarize(level);
  assert.equal(counts.C, 5);
  assert.equal(counts.E, 1);
  assert.equal(counts.S, 1);
  assert.equal(counts.F, 1);
  assert.ok(counts.B > 0);
  const start = findCells(level, 'S')[0];
  const finish = findCells(level, 'F')[0];
  const enemy = findCells(level, 'E')[0];
  const coins = findCells(level, 'C');
  assert.ok(Math.abs(start.x - finish.x) + Math.abs(start.y - finish.y) >= 20);
  assert.ok(coins.some((coin) => Math.abs(coin.x - enemy.x) + Math.abs(coin.y - enemy.y) === 1));
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const cell = queue.shift();
    if (cell.x === finish.x && cell.y === finish.y) return;
    for (const [dx, dy] of dirs) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      const ch = level[y][x];
      if (ch === 'W' || ch === 'B') continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  assert.fail('finish is walled off from the start');
});

test('the mad enemy starts slow and speeds up to a cap', () => {
  assert.equal(madSpeed(0), 40);
  assert.equal(madSpeed(5), 80);
  assert.equal(madSpeed(30), 150);
});
