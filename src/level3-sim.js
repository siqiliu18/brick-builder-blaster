import { COLS, ROWS, TILE } from './level.js';
import { PLAYER_HALF, PLAYER_SPEED, isBlocked, moveBody, seesTarget } from './sim.js';

/** Open floor tiles in Level 1 where the 3D test adds a few extra monsters. */
export const EXTRA_MONSTER_TILES = [
  [6, 6],
  [15, 6],
  [4, 12],
];

export const BULLET_SPEED = 560;
export const BULLET_HIT = 22;
export const MONSTER_HP = 2;
export const MAX_ALIVE = 6;
export const SPAWN_EVERY = 2.5;
export const MIN_SPAWN_DIST = 140;
export const CONTACT_REACH = 26;
export const CONTACT_DAMAGE = 1;
export const TANK_HP = 3;
export const ALLY_HP = 3;
export const ALLY_SHOT_GAP = 0.26;
export const ALLY_STANDOFF = 56;
export const MAX_ALLIES = 5;

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
  let goal = null;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      if (ch === 'B' || ch === 'W') blocks.push({ tx, ty, kind: ch });
      else if (ch === 'S') spawn = center(tx, ty);
      else if (ch === 'F') goal = { tx, ty, ...center(tx, ty) };
      else if (ch === 'E') monsters.push({ ...center(tx, ty), hp: MONSTER_HP, alive: true, fromLayout: true });
    }
  }
  if (!goal) goal = farthestOpenTile(grid, spawn);
  for (const [tx, ty] of EXTRA_MONSTER_TILES) {
    if (grid[ty]?.[tx] !== '.') continue;
    if (tx === goal.tx && ty === goal.ty) continue;
    monsters.push({ ...center(tx, ty), hp: MONSTER_HP, alive: true, fromLayout: false });
  }
  return { grid, blocks, monsters, spawn, goal };
}

/** The tank wins when its center is on the goal tile. */
export function reachedGoal(player, goal) {
  if (!player || !goal) return false;
  return Math.floor(player.x / TILE) === goal.tx && Math.floor(player.y / TILE) === goal.ty;
}

function farthestOpenTile(grid, spawn) {
  let best = { tx: 2, ty: 2, ...center(2, 2) };
  let bestDist = -1;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = grid[ty][tx];
      if (ch === 'B' || ch === 'W') continue;
      const spot = center(tx, ty);
      const dist = Math.hypot(spot.x - spawn.x, spot.y - spawn.y);
      if (dist > bestDist) {
        bestDist = dist;
        best = { tx, ty, ...spot };
      }
    }
  }
  return best;
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

export function countAlive(monsters) {
  return monsters.reduce((total, monster) => total + (monster.alive ? 1 : 0), 0);
}

/** Prefer a spawn point well away from the tank. Falls back to any point so spawns never stop. */
export function pickSpawnPoint(points, player, rng = Math.random) {
  if (!points?.length || !player) return null;
  const far = points.filter((point) => Math.hypot(point.x - player.x, point.y - player.y) >= MIN_SPAWN_DIST);
  const pool = far.length ? far : points;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[index];
}

/**
 * Spawn one monster every SPAWN_EVERY seconds, up to MAX_ALIVE.
 * While the cap is full the timer stays ready, so a new one appears as soon as one is gone.
 */
export function advanceSpawner(timer, dt, monsters, player, points, rng = Math.random) {
  const next = Math.max(0, timer) + Math.max(0, dt);
  if (countAlive(monsters) >= MAX_ALIVE) {
    return { timer: Math.min(next, SPAWN_EVERY), spawned: null };
  }
  if (next < SPAWN_EVERY) return { timer: next, spawned: null };
  const spot = pickSpawnPoint(points, player, rng);
  if (!spot) return { timer: next, spawned: null };
  return {
    timer: 0,
    spawned: { x: spot.x, y: spot.y, hp: MONSTER_HP, alive: true, fromLayout: false },
  };
}

/** A monster that touches the tank pops and costs CONTACT_DAMAGE health. */
export function applyContact(player, monsters, hp) {
  const popped = [];
  for (const monster of monsters) {
    if (!monster.alive) continue;
    if (Math.hypot(monster.x - player.x, monster.y - player.y) > CONTACT_REACH) continue;
    monster.alive = false;
    popped.push(monster);
  }
  const next = Math.max(0, hp - popped.length * CONTACT_DAMAGE);
  return { hp: next, popped, dead: popped.length > 0 && next <= 0 };
}

/** True until this Level 3 run has already spawned MAX_ALLIES rainbow tanks. Deaths do not refund a press. */
export function canAddAlly(spawnedCount) {
  return Number(spawnedCount) < MAX_ALLIES;
}

export function nearestMonster(origin, monsters) {
  let best = null;
  let bestDist = Infinity;
  for (const monster of monsters) {
    if (!monster?.alive) continue;
    const dist = Math.hypot(monster.x - origin.x, monster.y - origin.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = monster;
    }
  }
  return best;
}

/** Stand beside the player on open floor, not on top of another ally. */
export function allySpawnNear(player, grid, allies = []) {
  const taken = (allies || []).filter((ally) => ally?.alive);
  const tries = [];
  for (let ring = 1; ring <= 4; ring++) {
    const step = 42 * ring;
    tries.push(
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
      [step, step],
      [-step, step],
      [step, -step],
      [-step, -step],
    );
  }
  for (const [dx, dy] of tries) {
    const x = player.x + dx;
    const y = player.y + dy;
    if (isBlocked(grid, x, y, PLAYER_HALF)) continue;
    const stacked = taken.some((ally) => Math.hypot(ally.x - x, ally.y - y) < 36);
    if (stacked) continue;
    return { x, y };
  }
  return { x: player.x + 48, y: player.y };
}

/**
 * Drive toward the nearest monster and fire only when the shot is clear.
 * The ally never aims at the player.
 */
export function stepAlly(ally, monsters, dt, grid) {
  if (!ally?.alive) return { aim: ally?.facing || 0, fire: false };
  const target = nearestMonster(ally, monsters);
  if (!target) return { aim: ally.facing || 0, fire: false };
  const dx = target.x - ally.x;
  const dy = target.y - ally.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist > ALLY_STANDOFF) {
    moveBody(ally, (dx / dist) * PLAYER_SPEED, (dy / dist) * PLAYER_SPEED, dt, PLAYER_HALF, grid);
  }
  const aim = Math.atan2(target.y - ally.y, target.x - ally.x);
  ally.facing = aim;
  ally.cooldown = Math.max(0, (ally.cooldown || 0) - dt);
  const fire = seesTarget(ally, target, grid) && ally.cooldown <= 0;
  if (fire) ally.cooldown = ALLY_SHOT_GAP;
  return { aim, fire };
}
