import { COLS, ROWS, TILE } from './level.js';

export const PLAYER_HALF = 12;
export const ENEMY_HALF = 12;
export const PLAYER_SPEED = 210;
/** Level 2, while the hero is driving. A bit slower than running, still faster than a brute. */
export const PLAYER_TANK_SPEED = 168;
/** Hits the rusty hull soaks before a heart is lost. */
export const TANK_ARMOR = 5;
export const MAD_MIN_SPEED = 40;
export const MAD_MAX_SPEED = 150;
export const MAD_ACCEL = 8;

export function madSpeed(elapsed) {
  return Math.min(MAD_MAX_SPEED, MAD_MIN_SPEED + Math.max(0, elapsed) * MAD_ACCEL);
}

export function isBlocked(grid, x, y, half) {
  const x0 = Math.floor((x - half) / TILE);
  const x1 = Math.floor((x + half - 0.01) / TILE);
  const y0 = Math.floor((y - half) / TILE);
  const y1 = Math.floor((y + half - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return true;
      const ch = grid[ty][tx];
      if (ch === 'B' || ch === 'W') return true;
    }
  }
  return false;
}

export function moveBody(body, vx, vy, dt, half, grid) {
  const nx = body.x + vx * dt;
  if (!isBlocked(grid, nx, body.y, half)) body.x = nx;
  const ny = body.y + vy * dt;
  if (!isBlocked(grid, body.x, ny, half)) body.y = ny;
}

/** Armor soaks a hit before hearts do. Damage stays 1, the same as a brute touch. */
export function absorbHit(armor, health, damage = 1) {
  const hit = Math.max(1, damage);
  if (armor > 0) return { armor: armor - 1, health, soaked: true };
  return { armor: 0, health: health - hit, soaked: false };
}

export function chase(enemy, target, dt, half, grid) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  if (Math.hypot(dx, dy) < 1) return;
  const speed = enemy.speed;
  const sx = Math.sign(dx) * speed;
  const sy = Math.sign(dy) * speed;
  const preferX = Math.abs(dx) >= Math.abs(dy);
  const first = preferX ? { x: sx, y: 0 } : { x: 0, y: sy };
  const second = preferX ? { x: 0, y: sy } : { x: sx, y: 0 };
  const beforeX = enemy.x;
  const beforeY = enemy.y;
  moveBody(enemy, first.x, first.y, dt, half, grid);
  const moved = Math.hypot(enemy.x - beforeX, enemy.y - beforeY);
  if (moved < speed * dt * 0.25) moveBody(enemy, second.x, second.y, dt, half, grid);
}

export function separateEnemies(enemies, half, grid) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      if (!a.alive || !b.alive) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      if (dist === 0) {
        dx = 1;
        dy = 0;
        dist = 1;
      }
      if (dist >= 26) continue;
      const push = (26 - dist) / 2;
      const ux = dx / dist;
      const uy = dy / dist;
      nudge(a, -ux * push, -uy * push, half, grid);
      nudge(b, ux * push, uy * push, half, grid);
    }
  }
}

function nudge(body, dx, dy, half, grid) {
  const nextX = body.x + dx;
  if (!isBlocked(grid, nextX, body.y, half)) body.x = nextX;
  const nextY = body.y + dy;
  if (!isBlocked(grid, body.x, nextY, half)) body.y = nextY;
}

export const BRUTE_HP = 3;
export const BRUTE_CHASE_SPEED = 100;
export const BRUTE_PATROL_SPEED = 44;
export const BRUTE_SIGHT = 280;
export const BRUTE_CHASE_LEASH = 200;
export const BRUTE_PATROL_LEASH = 88;

export function seesTarget(enemy, target, grid) {
  if (!target) return false;
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist > BRUTE_SIGHT || dist < 1) return dist < 1;
  const steps = Math.max(1, Math.ceil(dist / (TILE / 2)));
  for (let i = 1; i < steps; i++) {
    const x = enemy.x + (dx * i) / steps;
    const y = enemy.y + (dy * i) / steps;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return false;
    const ch = grid[ty][tx];
    if (ch === 'B' || ch === 'W') return false;
  }
  return true;
}

export function corridorHeading(grid, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const open = (cx, cy) => {
    const ch = grid[cy]?.[cx];
    return Boolean(ch) && ch !== 'W' && ch !== 'B';
  };
  let best = -1;
  let heading = 0;
  for (const [dx, dy, angle] of [
    [1, 0, 0],
    [-1, 0, Math.PI],
    [0, 1, Math.PI / 2],
    [0, -1, -Math.PI / 2],
  ]) {
    let n = 0;
    let cx = tx + dx;
    let cy = ty + dy;
    while (open(cx, cy)) {
      n += 1;
      cx += dx;
      cy += dy;
    }
    if (n > best) {
      best = n;
      heading = angle;
    }
  }
  return heading;
}

export function patrolBounce(enemy, dt, half, grid) {
  const speed = BRUTE_PATROL_SPEED;
  enemy.speed = speed;
  const vx = Math.cos(enemy.heading) * speed;
  const vy = Math.sin(enemy.heading) * speed;
  const nextX = enemy.x + vx * dt;
  const nextY = enemy.y + vy * dt;
  if (Math.hypot(nextX - enemy.homeX, nextY - enemy.homeY) > BRUTE_PATROL_LEASH) {
    enemy.heading += Math.PI;
    return;
  }
  const beforeX = enemy.x;
  const beforeY = enemy.y;
  moveBody(enemy, vx, vy, dt, half, grid);
  if (Math.hypot(enemy.x - beforeX, enemy.y - beforeY) < speed * dt * 0.35) enemy.heading += Math.PI;
}

/** Pace a short beat, then rush when the player is in sight. Stops at a leash so a kid can back away. */
export function stepBrute(enemy, target, dt, half, grid, active) {
  const seeing = Boolean(active) && seesTarget(enemy, target, grid);
  if (seeing) enemy.aggro = 0.7;
  else enemy.aggro = Math.max(0, (enemy.aggro || 0) - dt);
  const fromHome = Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY);
  if (enemy.aggro > 0 && fromHome < BRUTE_CHASE_LEASH) {
    enemy.speed = BRUTE_CHASE_SPEED;
    chase(enemy, target, dt, half, grid);
    return 'chase';
  }
  if (fromHome > TILE * 1.2) {
    enemy.speed = BRUTE_PATROL_SPEED;
    chase(enemy, { x: enemy.homeX, y: enemy.homeY }, dt, half, grid);
    return 'return';
  }
  patrolBounce(enemy, dt, half, grid);
  return 'patrol';
}
