import { COLS, ROWS, TILE } from './level.js';

/** Open floor tiles in Level 1 where the 3D test adds a few extra monsters. */
export const EXTRA_MONSTER_TILES = [
  [6, 6],
  [15, 6],
  [4, 12],
];

export const BULLET_SPEED = 560;
export const BULLET_HIT = 22;
export const MONSTER_HP = 2;

/**
 * Fixed follow camera, in tile units. It sits south of the hero and looks north,
 * and this offset never changes with aim or movement, so the view does not spin.
 * Screen up is world -y, which is also stick up and the W key.
 */
export const FIXED_CAMERA = { x: 0, height: 10, south: 6.5 };

/** Stick vector in screen space: +x right, +y down, same as the 2D game. */
export function stickAngle(x, y) {
  return Math.atan2(y, x);
}

/** World aim from a point on the ground. groundX/groundZ are tile-space Three.js coordinates. */
export function angleTowardGround(playerX, playerY, groundX, groundZ, tile) {
  return Math.atan2(groundZ * tile - playerY, groundX * tile - playerX);
}

function center(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

/**
 * Turn a Level 1 row layout into blocks, a start point, and a few monsters.
 * Bricks and solid walls become boxes. The layout's enemy is kept, plus extras on open tiles.
 */
export function createLevel3World(rows) {
  const grid = rows.map((row) => row.split(''));
  const blocks = [];
  const monsters = [];
  let spawn = center(2, 2);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      if (ch === 'B' || ch === 'W') blocks.push({ tx, ty, kind: ch });
      else if (ch === 'S') spawn = center(tx, ty);
      else if (ch === 'E') monsters.push({ ...center(tx, ty), hp: MONSTER_HP, alive: true, fromLayout: true });
    }
  }
  for (const [tx, ty] of EXTRA_MONSTER_TILES) {
    if (grid[ty]?.[tx] !== '.') continue;
    monsters.push({ ...center(tx, ty), hp: MONSTER_HP, alive: true, fromLayout: false });
  }
  return { grid, blocks, monsters, spawn };
}

/** Move a shot and report wall, hit, defeat, or fly. A hit lowers that monster's hp. */
export function stepBullet(bullet, dt, grid, monsters) {
  const step = BULLET_SPEED * Math.max(0, dt);
  bullet.x += Math.cos(bullet.angle) * step;
  bullet.y += Math.sin(bullet.angle) * step;
  const tx = Math.floor(bullet.x / TILE);
  const ty = Math.floor(bullet.y / TILE);
  if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return 'wall';
  const ch = grid[ty][tx];
  if (ch === 'B' || ch === 'W') return 'wall';
  for (const monster of monsters) {
    if (!monster.alive) continue;
    if (Math.hypot(monster.x - bullet.x, monster.y - bullet.y) > BULLET_HIT) continue;
    monster.hp -= 1;
    if (monster.hp <= 0) {
      monster.alive = false;
      return 'defeat';
    }
    return 'hit';
  }
  return 'fly';
}
