import { COLS, ROWS, TILE } from './level.js';
import { pickSpawnPoint } from './level3-sim.js';
import { BRUTE_HP, absorbHit, corridorHeading } from './sim.js';

/** How often a new maze monster appears, and how many may be alive at once. */
export const MAZE_SPAWN_EVERY = 3;
export const MAZE_MAX_ALIVE = 6;

/** Purple brute, green runner, yellow bruiser. */
export const MAZE_KINDS = {
  brute: { hp: BRUTE_HP, speed: 100, scale: 1.15, color: 0x7b1fa2 },
  runner: { hp: 1, speed: 188, scale: 0.68, color: 0x2e7d32 },
  bruiser: { hp: 2, speed: 96, scale: 1, color: 0xf5c400 },
};
const KIND_ORDER = ['runner', 'bruiser', 'brute'];

const BULLET_SPEED = 560;

function center(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

/**
 * Level 2 maze in world pixels: same tiles, brutes, coins, and flag as the 2D level.
 * Red bricks start with 3 hit points. Blue walls never break.
 */
export function createMazeWorld(rows) {
  const grid = rows.map((row) => row.split(''));
  const brickHp = grid.map((row) => row.map((ch) => (ch === 'B' ? 3 : 0)));
  const blocks = [];
  const monsters = [];
  const coins = [];
  const spawnPoints = [];
  let spawn = { tx: 2, ty: 2, ...center(2, 2) };
  let goal = null;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      const spot = center(tx, ty);
      if (ch === 'B' || ch === 'W') blocks.push({ tx, ty, kind: ch });
      else if (ch === 'S') spawn = { tx, ty, ...spot };
      else if (ch === 'F') goal = { tx, ty, ...spot };
      else if (ch === 'C') coins.push({ tx, ty, ...spot, alive: true });
      else if (ch === '.') spawnPoints.push(spot);
      else if (ch === 'M' || ch === 'E') {
        monsters.push({
          tx,
          ty,
          ...spot,
          homeX: spot.x,
          homeY: spot.y,
          hp: ch === 'M' ? BRUTE_HP : 2,
          alive: true,
          kind: ch === 'M' ? 'brute' : 'mad',
          heading: corridorHeading(grid, spot.x, spot.y),
          aggro: 0,
          speed: 0,
        });
      }
    }
  }
  if (!goal) goal = farthestOpen(grid, spawn);
  return { grid, brickHp, blocks, monsters, coins, spawn, goal, spawnPoints };
}

/**
 * Keep the maze stocked. The opening brutes count toward the cap.
 * New monsters cycle runner, bruiser, brute, and appear away from the tank.
 */
export function advanceMazeSpawner(timer, dt, monsters, player, points, spawnIndex = 0, rng = Math.random) {
  const alive = monsters.reduce((total, monster) => total + (monster.alive ? 1 : 0), 0);
  const next = Math.max(0, timer) + Math.max(0, dt);
  if (alive >= MAZE_MAX_ALIVE) {
    return { timer: Math.min(next, MAZE_SPAWN_EVERY), spawned: null, spawnIndex };
  }
  if (next < MAZE_SPAWN_EVERY) return { timer: next, spawned: null, spawnIndex };
  const spot = pickSpawnPoint(points, player, rng);
  if (!spot) return { timer: next, spawned: null, spawnIndex };
  const kind = KIND_ORDER[spawnIndex % KIND_ORDER.length];
  const stats = MAZE_KINDS[kind];
  return {
    timer: 0,
    spawnIndex: spawnIndex + 1,
    spawned: {
      x: spot.x,
      y: spot.y,
      homeX: spot.x,
      homeY: spot.y,
      hp: stats.hp,
      alive: true,
      kind,
      heading: 0,
      aggro: 0,
      speed: stats.speed,
    },
  };
}

function farthestOpen(grid, spawn) {
  let best = spawn;
  let bestDist = -1;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      if (ch === 'B' || ch === 'W') continue;
      const spot = { tx, ty, ...center(tx, ty) };
      const dist = Math.hypot(spot.x - spawn.x, spot.y - spawn.y);
      if (dist > bestDist) {
        bestDist = dist;
        best = spot;
      }
    }
  }
  return best;
}

/** Blue walls clang. A red brick cracks, then opens on the third hit. */
export function damageMazeCell(grid, brickHp, tx, ty) {
  if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return 'wall';
  const ch = grid[ty][tx];
  if (ch === 'W') return 'solid';
  if (ch !== 'B') return 'open';
  brickHp[ty][tx] -= 1;
  if (brickHp[ty][tx] <= 0) {
    grid[ty][tx] = '.';
    return 'break';
  }
  return 'crack';
}

/** Move a shot. Monsters take a hit; bricks and solid walls stop the bullet. */
export function stepMazeBullet(bullet, dt, grid, brickHp, monsters) {
  const step = BULLET_SPEED * Math.max(0, dt);
  bullet.x += Math.cos(bullet.angle) * step;
  bullet.y += Math.sin(bullet.angle) * step;
  const tx = Math.floor(bullet.x / TILE);
  const ty = Math.floor(bullet.y / TILE);
  if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return 'wall';
  for (const monster of monsters) {
    if (!monster.alive) continue;
    const radius = monster.kind === 'brute' ? 22 : monster.kind === 'runner' ? 14 : 18;
    if (Math.hypot(monster.x - bullet.x, monster.y - bullet.y) > radius) continue;
    monster.hp -= 1;
    if (monster.hp <= 0) {
      monster.alive = false;
      return 'defeat';
    }
    return 'hit';
  }
  const cell = damageMazeCell(grid, brickHp, tx, ty);
  return cell === 'open' ? 'fly' : cell;
}

/**
 * One monster touch per check. Armor soaks the hit before a heart is lost.
 * invuln > 0 means the tank is still flashing and cannot be hit.
 */
export function mazeTouch(player, monsters, armor, health, invuln) {
  if (invuln > 0) return null;
  for (const monster of monsters) {
    if (!monster.alive) continue;
    const reach = monster.kind === 'brute' ? 24 : 22;
    if (Math.hypot(monster.x - player.x, monster.y - player.y) > reach) continue;
    const next = absorbHit(armor, health, 1);
    return {
      armor: next.armor,
      health: next.health,
      soaked: next.soaked,
      died: !next.soaked && next.health <= 0,
      monster,
      knockAngle: Math.atan2(player.y - monster.y, player.x - monster.x),
    };
  }
  return null;
}
