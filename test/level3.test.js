import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { COLS, ROWS, TILE, blankRows, jaspersLevel, summarize } from '../src/level.js';
import {
  EXTRA_MONSTER_TILES,
  FIXED_CAMERA,
  angleTowardGround,
  createLevel3World,
  CONTACT_DAMAGE,
  MAX_ALIVE,
  SPAWN_EVERY,
  TANK_HP,
  ALLY_HP,
  advanceSpawner,
  applyContact,
  MAX_ALLIES,
  allySpawnNear,
  canAddAlly,
  pickSpawnPoint,
  stepAlly,
  reachedGoal,
  stepBullet,
  stickAngle,
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

test('Level 3 stick up is screen up, and a tap north of the tank aims that way', () => {
  assert.equal(FIXED_CAMERA.x, 0);
  assert.ok(FIXED_CAMERA.south > 0);
  assert.ok(FIXED_CAMERA.height > FIXED_CAMERA.south);
  assert.ok(Math.abs(stickAngle(0, -1) - (-Math.PI / 2)) < 1e-9);
  assert.ok(Math.abs(stickAngle(1, 0)) < 1e-9);
  const aim = angleTowardGround(100, 100, 100 / TILE, 40 / TILE, TILE);
  assert.ok(Math.abs(aim - (-Math.PI / 2)) < 1e-9);
});

test('Level 3 goal is the flag tile, and standing on it wins', () => {
  const rows = jaspersLevel();
  let fx = -1;
  let fy = -1;
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y].indexOf('F');
    if (x >= 0) {
      fx = x;
      fy = y;
    }
  }
  const world = createLevel3World(rows);
  assert.equal(world.goal.tx, fx);
  assert.equal(world.goal.ty, fy);
  assert.equal(reachedGoal({ x: world.goal.x, y: world.goal.y }, world.goal), true);
  assert.equal(reachedGoal({ x: world.spawn.x, y: world.spawn.y }, world.goal), false);
  assert.equal(reachedGoal({ x: world.goal.x + TILE, y: world.goal.y }, world.goal), false);

  const empty = blankRows();
  empty[2] = `${empty[2].slice(0, 2)}S${empty[2].slice(3)}`;
  const fallback = createLevel3World(empty);
  assert.equal(fallback.goal.tx, COLS - 1);
  assert.equal(fallback.goal.ty, ROWS - 1);
  assert.equal(reachedGoal({ x: fallback.goal.x, y: fallback.goal.y }, fallback.goal), true);
});

test('Level 3 monsters keep spawning up to a cap, away from the tank', () => {
  const world = createLevel3World(jaspersLevel());
  const points = world.monsters.map((monster) => ({ x: monster.x, y: monster.y }));
  const player = { x: world.spawn.x, y: world.spawn.y };
  const spot = pickSpawnPoint(points, player, () => 0);
  assert.ok(Math.hypot(spot.x - player.x, spot.y - player.y) >= 140);

  const alive = Array.from({ length: MAX_ALIVE }, (_, index) => ({
    x: points[index % points.length].x,
    y: points[index % points.length].y,
    alive: true,
  }));
  const full = advanceSpawner(SPAWN_EVERY, 1, alive, player, points, () => 0);
  assert.equal(full.spawned, null);

  const empty = [];
  const first = advanceSpawner(0, SPAWN_EVERY, empty, player, points, () => 0);
  assert.ok(first.spawned);
  assert.equal(first.spawned.alive, true);
  assert.equal(first.timer, 0);
  empty.push(first.spawned);
  const tooSoon = advanceSpawner(first.timer, SPAWN_EVERY / 2, empty, player, points, () => 0);
  assert.equal(tooSoon.spawned, null);
  const again = advanceSpawner(tooSoon.timer, SPAWN_EVERY, [], player, points, () => 0);
  assert.ok(again.spawned);
});

test('a Level 3 monster that touches the tank pops and costs one heart', () => {
  const player = { x: 100, y: 100 };
  const touching = { x: 110, y: 100, alive: true, hp: 2 };
  const far = { x: 400, y: 100, alive: true, hp: 2 };
  const hit = applyContact(player, [touching, far], TANK_HP);
  assert.equal(hit.hp, TANK_HP - CONTACT_DAMAGE);
  assert.equal(hit.dead, false);
  assert.equal(touching.alive, false);
  assert.equal(far.alive, true);
  assert.equal(hit.popped.length, 1);

  const crowd = [
    { x: 100, y: 100, alive: true },
    { x: 108, y: 108, alive: true },
    { x: 90, y: 100, alive: true },
  ];
  const wiped = applyContact(player, crowd, TANK_HP);
  assert.equal(wiped.hp, 0);
  assert.equal(wiped.dead, true);
  assert.equal(crowd.every((monster) => !monster.alive), true);
});

test('the rainbow ally shoots a monster it can see and pops when bumped', () => {
  const grid = blankRows().map((row) => row.split(''));
  const ally = { x: 100, y: 100, facing: 0, cooldown: 0, hp: ALLY_HP, alive: true };
  const monster = { x: 300, y: 100, alive: true, hp: 2 };
  const chase = stepAlly(ally, [monster], 0.2, grid);
  assert.ok(ally.x > 100);
  assert.equal(chase.fire, true);
  assert.ok(Math.abs(chase.aim) < 0.05);
  assert.equal(stepAlly(ally, [monster], 0.01, grid).fire, false);

  grid[2][4] = 'W';
  const blocked = { x: 100, y: 100, facing: 0, cooldown: 0, hp: ALLY_HP, alive: true };
  const hidden = { x: 340, y: 100, alive: true, hp: 2 };
  assert.equal(stepAlly(blocked, [hidden], 0.05, grid).fire, false);

  const bumper = { x: 110, y: 100, alive: true };
  const bystander = { x: 500, y: 100, alive: true };
  const playerHp = 3;
  const hit = applyContact({ x: 100, y: 100 }, [bumper, bystander], ALLY_HP);
  assert.equal(hit.hp, ALLY_HP - 1);
  assert.equal(hit.dead, false);
  assert.equal(bumper.alive, false);
  assert.equal(bystander.alive, true);
  assert.equal(playerHp, 3);
  const fatal = applyContact({ x: 100, y: 100 }, [{ x: 100, y: 108, alive: true }], 1);
  assert.equal(fatal.dead, true);
  assert.equal(canAddAlly(0), true);
  assert.equal(canAddAlly(MAX_ALLIES - 1), true);
  assert.equal(canAddAlly(MAX_ALLIES), false);
  assert.equal(canAddAlly(MAX_ALLIES + 2), false);
  const open = blankRows().map((row) => row.split(''));
  const here = { x: 200, y: 200 };
  const first = allySpawnNear(here, open, []);
  const second = allySpawnNear(here, open, [{ ...first, alive: true }]);
  assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= 36);
});

test('the menu keeps Level 1 and Level 2 and adds Level 3 (3D)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="btn-jasper"[^>]*>Level 1</);
  assert.match(html, /id="btn-level2"[^>]*>Level 2</);
  assert.match(html, /id="btn-level3"[^>]*>Level 3 \(3D\)</);
});
