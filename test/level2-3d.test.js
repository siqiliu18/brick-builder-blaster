import assert from 'node:assert/strict';
import test from 'node:test';
import { TILE, findCells, level2 } from '../src/level.js';
import { BRUTE_HP, TANK_ARMOR } from '../src/sim.js';
import { createMazeWorld, damageMazeCell, mazeTouch, stepMazeBullet } from '../src/level2-3d-sim.js';

test('Level 2 in 3D keeps the maze, three brutes, and the flag', () => {
  const rows = level2();
  const world = createMazeWorld(rows);
  const brutes = world.monsters.filter((monster) => monster.kind === 'brute');
  assert.equal(brutes.length, findCells(rows, 'M').length);
  assert.equal(brutes.length, 3);
  assert.ok(brutes.every((monster) => monster.hp === BRUTE_HP));
  const flag = findCells(rows, 'F')[0];
  const start = findCells(rows, 'S')[0];
  assert.equal(world.goal.tx, flag.x);
  assert.equal(world.goal.ty, flag.y);
  assert.equal(world.spawn.tx, start.x);
  assert.equal(world.spawn.ty, start.y);
  assert.equal(world.coins.length, findCells(rows, 'C').length);
  assert.equal(world.brickHp[4][1], 3);
});

test('a red Level 2 brick opens on the third shot and a blue wall does not', () => {
  const world = createMazeWorld(level2());
  const bullet = () => ({ x: 60, y: 150, angle: Math.PI / 2 });
  assert.equal(stepMazeBullet(bullet(), 0.08, world.grid, world.brickHp, world.monsters), 'crack');
  assert.equal(world.grid[4][1], 'B');
  assert.equal(world.brickHp[4][1], 2);
  assert.equal(stepMazeBullet(bullet(), 0.08, world.grid, world.brickHp, world.monsters), 'crack');
  assert.equal(stepMazeBullet(bullet(), 0.08, world.grid, world.brickHp, world.monsters), 'break');
  assert.equal(world.grid[4][1], '.');

  const wall = { x: 20, y: 180, angle: Math.PI };
  assert.equal(stepMazeBullet(wall, 0.01, world.grid, world.brickHp, world.monsters), 'solid');
  assert.equal(world.grid[4][0], 'W');
  assert.equal(damageMazeCell(world.grid, world.brickHp, 0, 4), 'solid');
});

test('Level 2 brutes take three hits, and armor soaks a touch before hearts', () => {
  const world = createMazeWorld(level2());
  const brute = world.monsters[0];
  const shot = () => ({ x: brute.x - 16, y: brute.y, angle: 0 });
  assert.equal(stepMazeBullet(shot(), 0.02, world.grid, world.brickHp, world.monsters), 'hit');
  assert.equal(stepMazeBullet(shot(), 0.02, world.grid, world.brickHp, world.monsters), 'hit');
  assert.equal(brute.hp, 1);
  assert.equal(stepMazeBullet(shot(), 0.02, world.grid, world.brickHp, world.monsters), 'defeat');
  assert.equal(brute.alive, false);

  const player = { x: 200, y: 200 };
  const monster = { x: 210, y: 200, alive: true, kind: 'brute' };
  const soaked = mazeTouch(player, [monster], TANK_ARMOR, 3, 0);
  assert.equal(soaked.soaked, true);
  assert.equal(soaked.armor, TANK_ARMOR - 1);
  assert.equal(soaked.health, 3);
  assert.equal(soaked.died, false);
  assert.equal(mazeTouch(player, [monster], 0, 3, 1.15), null);
  const fatal = mazeTouch(player, [monster], 0, 1, 0);
  assert.equal(fatal.died, true);
  assert.equal(fatal.health, 0);
});
