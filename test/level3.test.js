import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { TILE, jaspersLevel, summarize } from '../src/level.js';
import {
  EXTRA_MONSTER_TILES,
  createLevel3World,
  stepBullet,
} from '../src/level3-sim.js';

test('Level 3 builds 3D boxes from the Level 1 layout and a few monsters', () => {
  const rows = jaspersLevel();
  const counts = summarize(rows);
  const world = createLevel3World(rows);
  assert.equal(world.blocks.filter((block) => block.kind === 'W').length, counts.W);
  assert.equal(world.blocks.filter((block) => block.kind === 'B').length, counts.B);
  assert.equal(world.spawn.x, 2 * TILE + TILE / 2);
  assert.equal(world.spawn.y, 2 * TILE + TILE / 2);
  assert.equal(world.monsters.filter((monster) => monster.fromLayout).length, 1);
  assert.equal(world.monsters.length, 1 + EXTRA_MONSTER_TILES.length);
  for (const [tx, ty] of EXTRA_MONSTER_TILES) assert.equal(rows[ty][tx], '.');
});

test('a Level 3 shot hits a monster and stops on a wall', () => {
  const world = createLevel3World(jaspersLevel());
  const monster = world.monsters.find((item) => item.fromLayout);
  const bullet = { x: monster.x - 30, y: monster.y, angle: 0 };
  assert.equal(stepBullet(bullet, 0.08, world.grid, world.monsters), 'hit');
  assert.equal(monster.hp, 1);
  assert.equal(monster.alive, true);
  const finish = { x: monster.x - 10, y: monster.y, angle: 0 };
  assert.equal(stepBullet(finish, 0.05, world.grid, world.monsters), 'defeat');
  assert.equal(monster.alive, false);

  const wall = { x: 60, y: 20, angle: 0 };
  assert.equal(stepBullet(wall, 0.01, world.grid, world.monsters), 'wall');
});

test('the menu keeps Level 1 and Level 2 and adds Level 3 (3D)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="btn-jasper"[^>]*>Level 1</);
  assert.match(html, /id="btn-level2"[^>]*>Level 2</);
  assert.match(html, /id="btn-level3"[^>]*>Level 3 \(3D\)</);
});
