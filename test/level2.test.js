import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLS,
  ROWS,
  TILE,
  campaignFor,
  decodeLevel,
  encodeLevel,
  findCells,
  jaspersLevel,
  level2,
  summarize,
  tileCenter,
  validateRows,
} from '../src/level.js';
import {
  BRUTE_CHASE_SPEED,
  BRUTE_HP,
  ENEMY_HALF,
  MAD_MIN_SPEED,
  PLAYER_HALF,
  PLAYER_SPEED,
  corridorHeading,
  madSpeed,
  moveBody,
  seesTarget,
  stepBrute,
} from '../src/sim.js';

function walk(rows, { bricksOpen = false } = {}) {
  const blocked = new Set(bricksOpen ? ['W'] : ['W', 'B']);
  const start = findCells(rows, 'S')[0];
  const finish = findCells(rows, 'F')[0];
  const prev = new Map();
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = null;
  while (queue.length) {
    const cell = queue.shift();
    if (cell.x === finish.x && cell.y === finish.y) {
      found = cell;
      break;
    }
    for (const [dx, dy] of dirs) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      if (blocked.has(rows[y][x])) continue;
      seen.add(key);
      prev.set(key, cell);
      queue.push({ x, y });
    }
  }
  if (!found) return null;
  const path = [];
  let cursor = found;
  while (cursor) {
    path.push(cursor);
    cursor = prev.get(`${cursor.x},${cursor.y}`);
  }
  return path.reverse();
}

test('Level 2 is a maze with a red gate, a coin trail, and three separated brutes', () => {
  const level = level2();
  assert.equal(validateRows(level), true);
  assert.equal(campaignFor(level), 2);
  assert.equal(campaignFor(jaspersLevel()), 1);
  assert.notEqual(campaignFor(level), campaignFor(jaspersLevel()));
  const counts = summarize(level);
  assert.equal(counts.S, 1);
  assert.equal(counts.F, 1);
  assert.equal(counts.E, 0);
  assert.equal(counts.M, 3);
  assert.equal(counts.B, 3);
  assert.ok(counts.C >= 7);
  assert.equal(walk(level, { bricksOpen: false }), null);
  const path = walk(level, { bricksOpen: true });
  assert.ok(path);
  assert.ok(path.length >= 30);

  const monsters = findCells(level, 'M');
  const grid = level.map((row) => row.split(''));
  for (const monster of monsters) {
    const home = tileCenter(monster.x, monster.y);
    const guards = path.some((cell) => seesTarget({ x: home.x, y: home.y }, tileCenter(cell.x, cell.y), grid));
    assert.equal(guards, true, `monster at ${monster.x},${monster.y} never sees the route`);
    const start = findCells(level, 'S')[0];
    assert.ok(Math.abs(monster.x - start.x) + Math.abs(monster.y - start.y) >= 6);
  }
  for (let i = 0; i < monsters.length; i++) {
    for (let j = i + 1; j < monsters.length; j++) {
      const a = tileCenter(monsters[i].x, monsters[i].y);
      const b = tileCenter(monsters[j].x, monsters[j].y);
      assert.equal(seesTarget({ x: a.x, y: a.y }, b, grid), false);
    }
  }

  const secret = findCells(level, 'C').find((cell) => {
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => level[cell.y + dy][cell.x + dx]);
    return neighbors.includes('B') && neighbors.filter((ch) => ch !== 'W' && ch !== 'B').length === 0;
  });
  assert.ok(secret, 'a bonus coin sits behind one red brick');
  assert.equal(BRUTE_HP, 3);
  assert.ok(BRUTE_CHASE_SPEED > MAD_MIN_SPEED);
  assert.ok(BRUTE_CHASE_SPEED < madSpeed(30));
});

test('Level 2 survives a share link', async () => {
  const level = level2();
  const code = await encodeLevel(level);
  assert.equal(code[0], 'z');
  assert.deepEqual(await decodeLevel(code), level);
});

test('a careful kid can clear Level 2', () => {
  const rows = level2();
  const grid = rows.map((row) => row.split(''));
  const brickHp = grid.map((row) => row.map((ch) => (ch === 'B' ? 3 : 0)));
  const startCell = findCells(rows, 'S')[0];
  const spawn = tileCenter(startCell.x, startCell.y);
  const player = { x: spawn.x, y: spawn.y };
  const monsters = findCells(rows, 'M').map((cell) => {
    const home = tileCenter(cell.x, cell.y);
    return {
      x: home.x,
      y: home.y,
      homeX: home.x,
      homeY: home.y,
      hp: BRUTE_HP,
      alive: true,
      heading: corridorHeading(grid, home.x, home.y),
      aggro: 0,
      speed: 0,
    };
  });
  let health = 3;
  let invuln = 0;
  let nextShot = 0;
  let deaths = 0;
  let knockedX = 0;
  let knockedY = 0;
  const bullets = [];
  const dt = 1 / 60;
  const shotGap = 0.26;

  function openPath() {
    const blocked = (x, y) => {
      const ch = grid[y]?.[x];
      if (ch === 'W') return true;
      if (ch === 'B' && brickHp[y][x] > 0) return true;
      return false;
    };
    const finish = findCells(rows, 'F')[0];
    const origin = { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) };
    const prev = new Map();
    const seen = new Set([`${origin.x},${origin.y}`]);
    const queue = [origin];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let found = null;
    while (queue.length) {
      const cell = queue.shift();
      if (cell.x === finish.x && cell.y === finish.y) {
        found = cell;
        break;
      }
      for (const [dx, dy] of dirs) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        if (blocked(x, y)) continue;
        seen.add(key);
        prev.set(key, cell);
        queue.push({ x, y });
      }
    }
    if (found) {
      const path = [];
      let cursor = found;
      while (cursor) {
        path.push(cursor);
        cursor = prev.get(`${cursor.x},${cursor.y}`);
      }
      return path.reverse();
    }
    return null;
  }

  function pathThroughBricks() {
    const finish = findCells(rows, 'F')[0];
    const origin = { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) };
    const prev = new Map();
    const seen = new Set([`${origin.x},${origin.y}`]);
    const queue = [origin];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      const cell = queue.shift();
      if (cell.x === finish.x && cell.y === finish.y) {
        const path = [];
        let cursor = cell;
        while (cursor) {
          path.push(cursor);
          cursor = prev.get(`${cursor.x},${cursor.y}`);
        }
        return path.reverse();
      }
      for (const [dx, dy] of dirs) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        if (grid[y][x] === 'W') continue;
        seen.add(key);
        prev.set(key, cell);
        queue.push({ x, y });
      }
    }
    return null;
  }

  function shoot(angle, time) {
    if (time < nextShot) return;
    nextShot = time + shotGap;
    const x = player.x + Math.cos(angle) * 26;
    const y = player.y + Math.sin(angle) * 26;
    bullets.push({ x, y, vx: Math.cos(angle) * 560, vy: Math.sin(angle) * 560 });
  }

  function nearestThreat() {
    let best = null;
    for (const enemy of monsters) {
      if (!enemy.alive) continue;
      if (!seesTarget(enemy, player, grid)) continue;
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (!best || dist < best.dist) best = { enemy, dist };
    }
    return best;
  }

  let time = 0;
  for (let frame = 0; frame < 60 * 90; frame++) {
    time += dt;
    const tileX = Math.floor(player.x / TILE);
    const tileY = Math.floor(player.y / TILE);
    if (grid[tileY]?.[tileX] === 'F') {
      assert.ok(deaths <= 2, `cleared, but needed ${deaths} retries`);
      return;
    }

    for (const enemy of monsters) {
      if (!enemy.alive) continue;
      stepBrute(enemy, player, dt, ENEMY_HALF, grid, health > 0);
    }

    const threat = nearestThreat();
    let aim = null;
    let ix = 0;
    let iy = 0;
    if (threat && threat.dist < 340) {
      aim = Math.atan2(threat.enemy.y - player.y, threat.enemy.x - player.x);
      if (threat.dist < 170) {
        ix = -Math.cos(aim);
        iy = -Math.sin(aim);
      }
    } else {
      const route = openPath() || pathThroughBricks();
      assert.ok(route, 'the maze closed itself');
      const next = route[1] || route[0];
      const center = tileCenter(next.x, next.y);
      if (grid[next.y][next.x] === 'B' && brickHp[next.y][next.x] > 0) {
        aim = Math.atan2(center.y - player.y, center.x - player.x);
      } else if (Math.hypot(center.x - player.x, center.y - player.y) > 6) {
        ix = center.x - player.x;
        iy = center.y - player.y;
      }
    }
    const moving = Math.hypot(ix, iy) > 0.05;
    const len = Math.hypot(ix, iy) || 1;
    const vx = (moving ? (ix / len) * PLAYER_SPEED : 0) + knockedX;
    const vy = (moving ? (iy / len) * PLAYER_SPEED : 0) + knockedY;
    moveBody(player, vx, vy, dt, PLAYER_HALF, grid.map((row, y) => row.map((ch, x) => (ch === 'B' && brickHp[y][x] <= 0 ? '.' : ch))));
    knockedX *= Math.exp(-10 * dt);
    knockedY *= Math.exp(-10 * dt);
    if (aim != null) shoot(aim, time);

    const keep = [];
    for (const bullet of bullets) {
      let alive = true;
      const dist = Math.hypot(bullet.vx, bullet.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / 6));
      for (let i = 0; i < steps && alive; i++) {
        bullet.x += (bullet.vx * dt) / steps;
        bullet.y += (bullet.vy * dt) / steps;
        const hit = monsters.find((enemy) => enemy.alive && Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < 20);
        if (hit) {
          hit.hp -= 1;
          if (hit.hp <= 0) hit.alive = false;
          alive = false;
          break;
        }
        const tx = Math.floor(bullet.x / TILE);
        const ty = Math.floor(bullet.y / TILE);
        if (!grid[ty] || grid[ty][tx] == null) {
          alive = false;
          break;
        }
        const ch = grid[ty][tx];
        if (ch === 'W' || (ch === 'B' && brickHp[ty][tx] > 0)) {
          if (ch === 'B') brickHp[ty][tx] -= 1;
          alive = false;
        }
      }
      if (alive) keep.push(bullet);
    }
    bullets.length = 0;
    bullets.push(...keep);

    if (invuln > 0) invuln -= dt;
    else {
      for (const enemy of monsters) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) <= 24) {
          health -= 1;
          invuln = 1.15;
          const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
          knockedX = Math.cos(angle) * 280;
          knockedY = Math.sin(angle) * 280;
          if (health <= 0) {
            deaths += 1;
            player.x = spawn.x;
            player.y = spawn.y;
            knockedX = 0;
            knockedY = 0;
            health = 3;
            invuln = 1.5;
            for (const other of monsters) {
              if (!other.alive) continue;
              other.x = other.homeX;
              other.y = other.homeY;
              other.aggro = 0;
            }
          }
          break;
        }
      }
    }
  }
  assert.fail(`did not reach the finish (${deaths} pops, monsters left ${monsters.filter((m) => m.alive).length})`);
});
