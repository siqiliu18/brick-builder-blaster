import { COLS, ROWS, TILE } from './level.js';

export const PLAYER_HALF = 12;
export const ENEMY_HALF = 12;
export const PLAYER_SPEED = 210;
export const ENEMY_SPEED = 72;

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
