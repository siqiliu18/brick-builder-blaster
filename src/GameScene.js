import Phaser from 'phaser';
import {
  COLS,
  ROWS,
  TILE,
  VIEW_H,
  VIEW_W,
  erase,
  findCells,
  getRows,
  place,
  subscribe,
  summarize,
  tileCenter,
} from './level.js';
import { facing, isDown, isFireHeld, setFacing, stickVector } from './input.js';
import {
  ENEMY_HALF,
  MAD_MAX_SPEED,
  MAD_MIN_SPEED,
  PLAYER_HALF,
  PLAYER_SPEED,
  chase,
  madSpeed,
  moveBody,
  separateEnemies,
} from './sim.js';
import { buildTextures } from './textures.js';
import { clearFx, flashScreen, popText, spawnBurst, updateFx } from './fx.js';

const DRAG_TOOLS = new Set(['B', 'W']);

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game');
  }

  create() {
    buildTextures(this);
    this.add.image(0, 0, 'board').setOrigin(0, 0).setDisplaySize(VIEW_W, VIEW_H).setDepth(0);
    this.sprites = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.cursor = this.add.graphics().setDepth(2600);
    this.aim = this.add.graphics().setDepth(3000);
    this.preview = this.add.image(0, 0, 'brick0').setOrigin(0, 0).setDepth(2500).setVisible(false);
    this.hintText = this.add
      .text(VIEW_W / 2, VIEW_H / 2, 'Pick a tool, then click the board', {
        fontFamily: 'Verdana, Trebuchet MS, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#1a1204',
        backgroundColor: '#ffe14a',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.mode = 'build';
    this.tool = 'B';
    this.fx = [];
    this.enemies = [];
    this.coins = [];
    this.bullets = [];
    this.player = null;
    this.grid = null;
    this.health = 3;
    this.invuln = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.bob = 0;
    this.freeze = 0;
    this.won = false;
    this.respawning = false;
    this.lifeGen = 0;
    this.nextShot = 0;
    this.hudSnap = '';
    this.painting = false;
    this.paintErase = false;
    this.lastPaint = null;

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
    this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
    this.input.on('pointerup', () => this.endPaint());
    this.input.on('pointerupoutside', () => this.endPaint());
    const unsub = subscribe((dirty) => this.onLevelChange(dirty));
    this.events.once('shutdown', unsub);
    this.renderAll();
    this.setTool('B');
    this.emitMode();
  }

  setTool(tool) {
    this.tool = tool;
    window.dispatchEvent(new CustomEvent('bbb-tool', { detail: tool }));
  }

  emitMode() {
    window.dispatchEvent(new CustomEvent('bbb-mode', { detail: this.mode }));
  }

  onLevelChange(dirty) {
    if (this.mode !== 'build') return;
    if (!dirty) this.renderAll();
    else for (const cell of dirty) this.renderCell(cell.x, cell.y);
    this.updateHint();
  }

  updateHint() {
    const counts = summarize(getRows());
    const blank = counts.B + counts.W + counts.E + counts.C + counts.S + counts.F === 0;
    this.hintText.setVisible(this.mode === 'build' && blank);
  }

  textureFor(ch, tx, ty) {
    if (ch === 'B') {
      const hp = this.mode === 'play' ? this.hp[ty][tx] : 3;
      if (hp <= 1) return 'brick2';
      if (hp === 2) return 'brick1';
      return 'brick0';
    }
    return { W: 'solid', E: 'enemy', C: 'coin', S: 'start', F: 'finish' }[ch];
  }

  renderCell(tx, ty) {
    const old = this.sprites[ty][tx];
    if (old) {
      this.tweens.killTweensOf(old);
      old.destroy();
      this.sprites[ty][tx] = null;
    }
    let ch = this.mode === 'play' ? this.grid[ty][tx] : getRows()[ty][tx];
    if (this.mode === 'play' && (ch === 'E' || ch === 'C')) ch = '.';
    if (!ch || ch === '.') return;
    const img = this.add.image(tx * TILE, ty * TILE, this.textureFor(ch, tx, ty));
    img.setOrigin(0, 0).setDisplaySize(TILE, TILE).setDepth(10 + (ty + 1) * TILE);
    if (ch === 'C') {
      img.setData('bob', true);
      img.setData('baseY', ty * TILE);
    }
    this.sprites[ty][tx] = img;
  }

  renderAll() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) this.renderCell(x, y);
    }
    this.updateHint();
  }

  tileFrom(pointer) {
    return {
      tx: Math.floor(pointer.worldX / TILE),
      ty: Math.floor(pointer.worldY / TILE),
    };
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
  }

  onPointerDown(pointer) {
    if (this.mode !== 'build') return;
    this.painting = true;
    this.paintErase = pointer.button === 2 || this.tool === 'erase';
    this.lastPaint = null;
    this.paintAt(pointer, this.paintErase);
  }

  onPointerMove(pointer) {
    if (this.mode === 'build') this.drawHover(pointer);
    if (!this.painting || this.mode !== 'build') return;
    const dragOk = this.paintErase || DRAG_TOOLS.has(this.tool);
    if (dragOk) this.paintAt(pointer, this.paintErase);
  }

  endPaint() {
    this.painting = false;
    this.lastPaint = null;
  }

  paintAt(pointer, eraseMode) {
    const { tx, ty } = this.tileFrom(pointer);
    if (!this.inBounds(tx, ty)) return;
    const key = `${tx},${ty},${eraseMode ? 'x' : this.tool}`;
    if (key === this.lastPaint) return;
    this.lastPaint = key;
    if (eraseMode) erase(tx, ty);
    else place(tx, ty, this.tool);
  }

  drawHover(pointer) {
    const { tx, ty } = this.tileFrom(pointer);
    this.cursor.clear();
    if (!this.inBounds(tx, ty)) {
      this.preview.setVisible(false);
      return;
    }
    const x = tx * TILE;
    const y = ty * TILE;
    if (this.tool === 'erase') {
      this.preview.setVisible(false);
      this.cursor.lineStyle(3, 0xff5a5a, 1);
      this.cursor.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      this.cursor.beginPath();
      this.cursor.moveTo(x + 10, y + 10);
      this.cursor.lineTo(x + TILE - 10, y + TILE - 10);
      this.cursor.moveTo(x + TILE - 10, y + 10);
      this.cursor.lineTo(x + 10, y + TILE - 10);
      this.cursor.strokePath();
      return;
    }
    this.cursor.lineStyle(3, 0xffe14a, 1);
    this.cursor.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    const key = this.textureFor(this.tool, tx, ty);
    this.preview.setTexture(key).setDisplaySize(TILE, TILE).setPosition(x, y).setAlpha(0.62).setVisible(true);
  }

  enterPlay() {
    const rows = getRows();
    const starts = findCells(rows, 'S');
    const finishes = findCells(rows, 'F');
    if (starts.length < 1 || finishes.length < 1) {
      window.dispatchEvent(
        new CustomEvent('bbb-toast', { detail: 'Place one Start and one Finish first.' }),
      );
      return false;
    }
    window.dispatchEvent(new CustomEvent('bbb-hide-results'));
    this.mode = 'play';
    this.won = false;
    this.respawning = false;
    this.lifeGen += 1;
    this.freeze = 0;
    this.health = 3;
    this.invuln = 0;
    this.knockX = 0;
    this.knockY = 0;
    this.smashed = 0;
    this.coinsGot = 0;
    this.startedAt = performance.now();
    this.finishElapsed = 0;
    this.hudSnap = '';
    this.grid = rows.map((row) => row.split(''));
    this.hp = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] === 'B') this.hp[y][x] = 3;
      }
    }
    this.clearActors();
    this.renderAll();
    const spawn = tileCenter(starts[0].x, starts[0].y);
    this.spawn = spawn;
    this.player = this.makePlayer(spawn.x, spawn.y);
    this.enemies = findCells(rows, 'E').map((cell) => this.makeEnemy(cell));
    this.enemyTotal = this.enemies.length;
    this.coins = findCells(rows, 'C').map((cell) => this.makeCoin(cell));
    this.coinsTotal = this.coins.length;
    this.preview.setVisible(false);
    this.cursor.clear();
    const finish = finishes[0];
    const finishSprite = this.sprites[finish.y][finish.x];
    if (finishSprite) {
      this.tweens.add({
        targets: finishSprite,
        alpha: 0.72,
        yoyo: true,
        repeat: -1,
        duration: 420,
      });
    }
    this.emitMode();
    this.emitHud(true);
    const canvas = this.game.canvas;
    canvas.setAttribute('tabindex', '0');
    requestAnimationFrame(() => canvas.focus());
    return true;
  }

  backToBuild() {
    this.mode = 'build';
    this.won = false;
    this.respawning = false;
    this.lifeGen += 1;
    this.freeze = 0;
    this.clearActors();
    this.grid = null;
    this.aim.clear();
    this.renderAll();
    window.dispatchEvent(new CustomEvent('bbb-hide-results'));
    this.emitMode();
  }

  clearActors() {
    this.player?.destroy();
    this.player = null;
    for (const enemy of this.enemies) enemy.sprite.destroy();
    this.enemies = [];
    for (const coin of this.coins) coin.sprite.destroy();
    this.coins = [];
    for (const bullet of this.bullets) bullet.sprite.destroy();
    this.bullets = [];
    clearFx(this);
  }

  makePlayer(x, y) {
    const container = this.add.container(x, y).setDepth(10 + y);
    const shadow = this.add.image(0, 16, 'shadow').setDisplaySize(34, 12);
    const body = this.add.image(0, 0, 'player').setDisplaySize(40, 40);
    const blaster = this.add.image(18, 0, 'blaster').setDisplaySize(16, 8).setOrigin(0, 0.5);
    container.add([shadow, body, blaster]);
    container.bodySprite = body;
    container.blaster = blaster;
    return container;
  }

  makeEnemy(cell) {
    const { x, y } = tileCenter(cell.x, cell.y);
    const container = this.add.container(x, y).setDepth(10 + y);
    const shadow = this.add.image(0, 16, 'shadow').setDisplaySize(32, 12);
    const body = this.add.image(0, 0, 'enemy').setDisplaySize(38, 38);
    container.add([shadow, body]);
    container.bodySprite = body;
    return {
      x,
      y,
      hp: 2,
      alive: true,
      sprite: container,
      speed: MAD_MIN_SPEED,
    };
  }

  makeCoin(cell) {
    const { x, y } = tileCenter(cell.x, cell.y);
    const sprite = this.add.image(x, y, 'coin').setDisplaySize(28, 28).setDepth(8);
    return { x, y, baseY: y, sprite, alive: true };
  }

  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000);
    updateFx(this, dt);
    if (this.mode === 'build') {
      this.bobCoins(time);
      return;
    }
    if (!this.won) this.finishElapsed = (performance.now() - this.startedAt) / 1000;
    this.emitHud(false);
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }
    if (!this.won) this.updatePlay(dt, time);
  }

  bobCoins(time) {
    const wave = time / 220;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const sprite = this.sprites[y][x];
        if (!sprite?.getData('bob')) continue;
        sprite.y = sprite.getData('baseY') + Math.sin(wave + x * 0.7 + y) * 2.2;
      }
    }
  }

  updatePlay(dt, time) {
    this.updatePlayer(dt, time);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePlayCoins(time);
    this.checkHurt();
    this.checkWin();
  }

  updatePlayer(dt, time) {
    if (!this.player || this.respawning) {
      this.aim.clear();
      return;
    }
    let ix = 0;
    let iy = 0;
    if (isDown('a', 'arrowleft')) ix -= 1;
    if (isDown('d', 'arrowright')) ix += 1;
    if (isDown('w', 'arrowup')) iy -= 1;
    if (isDown('s', 'arrowdown')) iy += 1;
    const joy = stickVector();
    if (joy.on && Math.hypot(joy.x, joy.y) > 0.22) {
      ix += joy.x;
      iy += joy.y;
    }
    const moving = Math.hypot(ix, iy) > 0.05;
    if (moving) setFacing(Math.atan2(iy, ix));
    const len = Math.hypot(ix, iy) || 1;
    const vx = (moving ? (ix / len) * PLAYER_SPEED : 0) + this.knockX;
    const vy = (moving ? (iy / len) * PLAYER_SPEED : 0) + this.knockY;
    moveBody(this.player, vx, vy, dt, PLAYER_HALF, this.grid);
    this.knockX *= Math.exp(-10 * dt);
    this.knockY *= Math.exp(-10 * dt);
    this.player.setDepth(10 + this.player.y);

    const pointer = this.input.activePointer;
    const inside =
      pointer.worldX >= 0 &&
      pointer.worldY >= 0 &&
      pointer.worldX <= VIEW_W &&
      pointer.worldY <= VIEW_H;
    const manual = pointer.leftButtonDown() && inside;
    const buttonFire = isFireHeld();
    const angle = manual
      ? Math.atan2(pointer.worldY - this.player.y, pointer.worldX - this.player.x)
      : buttonFire
        ? facing()
        : Math.atan2(pointer.worldY - this.player.y, pointer.worldX - this.player.x);
    this.player.blaster.rotation = angle;
    this.player.blaster.setPosition(Math.cos(angle) * 18, Math.sin(angle) * 18);
    if (moving) this.bob += dt * 14;
    this.player.bodySprite.y = Math.sin(this.bob) * (moving ? 1.2 : 0.25);
    if (this.invuln > 0) {
      this.invuln -= dt;
      this.player.alpha = Math.sin(time / 40) > 0 ? 1 : 0.35;
    } else this.player.alpha = 1;

    this.aim.clear();
    this.aim.lineStyle(3, 0xffe14a, 0.95);
    this.aim.beginPath();
    this.aim.moveTo(this.player.x + Math.cos(angle) * 18, this.player.y + Math.sin(angle) * 18);
    this.aim.lineTo(this.player.x + Math.cos(angle) * 42, this.player.y + Math.sin(angle) * 42);
    this.aim.strokePath();

    if ((manual || buttonFire) && time >= this.nextShot) {
      this.shoot(angle);
      this.nextShot = time + 260;
    }
  }

  shoot(angle) {
    const x = this.player.x + Math.cos(angle) * 26;
    const y = this.player.y + Math.sin(angle) * 26;
    const speed = 560;
    const sprite = this.add.image(x, y, 'bullet').setDepth(3200).setRotation(angle);
    this.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, sprite });
    const muzzle = this.add.image(x, y, 'stud').setDepth(3300).setTint(0xfff3bf).setScale(0.8);
    this.tweens.add({
      targets: muzzle,
      alpha: 0,
      scale: 1.8,
      duration: 90,
      onComplete: () => muzzle.destroy(),
    });
  }

  updateEnemies(dt) {
    if (!this.player) return;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.speed = madSpeed(this.finishElapsed || 0);
      chase(enemy, this.player, dt, ENEMY_HALF, this.grid);
      enemy.sprite.setPosition(enemy.x, enemy.y);
      enemy.sprite.setDepth(10 + enemy.y);
      const rage = (enemy.speed - MAD_MIN_SPEED) / (MAD_MAX_SPEED - MAD_MIN_SPEED);
      const wobble = Math.sin(this.time.now / (160 - rage * 70)) * (3 + rage * 8);
      enemy.sprite.bodySprite.setAngle(wobble);
    }
    separateEnemies(this.enemies, ENEMY_HALF, this.grid);
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.sprite.setPosition(enemy.x, enemy.y);
    }
  }

  updateBullets(dt) {
    const keep = [];
    for (const bullet of this.bullets) {
      if (this.stepBullet(bullet, dt)) keep.push(bullet);
      else bullet.sprite.destroy();
    }
    this.bullets = keep;
  }

  stepBullet(bullet, dt) {
    const dist = Math.hypot(bullet.vx, bullet.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 0; i < steps; i++) {
      bullet.x += (bullet.vx * dt) / steps;
      bullet.y += (bullet.vy * dt) / steps;
      bullet.sprite.setPosition(bullet.x, bullet.y);
      const enemy = this.enemyAt(bullet.x, bullet.y);
      if (enemy) {
        this.hitEnemy(enemy);
        return false;
      }
      const tx = Math.floor(bullet.x / TILE);
      const ty = Math.floor(bullet.y / TILE);
      if (!this.inBounds(tx, ty)) return false;
      const ch = this.grid[ty][tx];
      if (ch === 'B' || ch === 'W') {
        this.damageWall(tx, ty);
        return false;
      }
    }
    return true;
  }

  enemyAt(x, y) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (Math.hypot(enemy.x - x, enemy.y - y) < 18) return enemy;
    }
    return null;
  }

  wiggle(sprite, onDone) {
    if (!sprite) return;
    const baseX = sprite.x;
    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      x: baseX + 3,
      yoyo: true,
      repeat: 1,
      duration: 40,
      onComplete: () => {
        if (sprite.active) sprite.x = baseX;
        onDone?.();
      },
    });
  }

  damageWall(tx, ty) {
    const ch = this.grid[ty][tx];
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    if (ch === 'W') {
      spawnBurst(this, cx, cy, {
        count: 4,
        colors: [0x90caf9, 0xffffff, 0x1565c0],
        power: 90,
        life: 0.35,
      });
      this.wiggle(this.sprites[ty][tx]);
      return;
    }
    if (ch !== 'B') return;
    this.hp[ty][tx] -= 1;
    if (this.hp[ty][tx] <= 0) {
      this.grid[ty][tx] = '.';
      this.renderCell(tx, ty);
      spawnBurst(this, cx, cy, {
        count: 9,
        colors: [0xff3b30, 0xe10600, 0x8e0400, 0xffd000, 0xffffff],
        power: 280,
        shake: 0.006,
        ring: true,
        ringColor: 0xffd000,
      });
      return;
    }
    this.renderCell(tx, ty);
    const sprite = this.sprites[ty][tx];
    if (sprite) {
      sprite.setTintFill(0xffffff);
      this.wiggle(sprite, () => {
        if (sprite.active) sprite.clearTint();
      });
    }
    spawnBurst(this, cx, cy, {
      count: 4,
      colors: [0xff3b30, 0xffd000],
      power: 140,
      life: 0.45,
      shake: 0.0025,
    });
  }

  hitEnemy(enemy) {
    if (!enemy.alive) return;
    enemy.hp -= 1;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      const x = enemy.x;
      const y = enemy.y;
      enemy.sprite.destroy();
      this.smashed += 1;
      this.freeze = 0.08;
      spawnBurst(this, x, y, {
        count: 10,
        colors: [0xff6d00, 0xe65100, 0xffd180, 0xffe14a, 0xff5252, 0xffffff],
        power: 320,
        shake: 0.012,
        ring: true,
        ringColor: 0xffe14a,
        word: 'SMASH!',
        wordColor: '#ffe14a',
      });
      flashScreen(this, 0xffffff, 0.22);
      this.emitHud(true);
      return;
    }
    enemy.sprite.bodySprite.setTexture('enemyHurt');
    enemy.sprite.bodySprite.setTintFill(0xffffff);
    this.time.delayedCall(80, () => {
      if (enemy.alive && enemy.sprite.bodySprite?.active) enemy.sprite.bodySprite.clearTint();
    });
    spawnBurst(this, enemy.x, enemy.y, {
      count: 4,
      colors: [0x66bb6a, 0xffe14a],
      power: 150,
      life: 0.4,
      shake: 0.003,
    });
  }

  updatePlayCoins(time) {
    const wave = time / 200;
    for (const coin of this.coins) {
      if (!coin.alive || !this.player || this.respawning) continue;
      coin.sprite.y = coin.baseY + Math.sin(wave + coin.x) * 3;
      if (Math.hypot(this.player.x - coin.x, this.player.y - coin.y) < 22) {
        coin.alive = false;
        coin.sprite.destroy();
        this.coinsGot += 1;
        popText(this, coin.x, coin.y - 10, '+1', '#ffe14a', 22);
        spawnBurst(this, coin.x, coin.y, {
          count: 6,
          colors: [0xffd000, 0xfff59d, 0xffffff],
          power: 160,
          life: 0.7,
        });
        this.emitHud(true);
      }
    }
  }

  checkHurt() {
    if (!this.player || this.respawning || this.invuln > 0 || this.won) return;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= 22) {
        this.hurt(enemy);
        return;
      }
    }
  }

  hurt(enemy) {
    this.health -= 1;
    this.invuln = 1.15;
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    this.knockX = Math.cos(angle) * 280;
    this.knockY = Math.sin(angle) * 280;
    if (this.health <= 0) {
      this.die();
      return;
    }
    popText(this, this.player.x, this.player.y - 26, 'OUCH!', '#ff8b8b');
    flashScreen(this, 0xff3355, 0.2);
    this.emitHud(true);
  }

  die() {
    const x = this.player.x;
    const y = this.player.y;
    spawnBurst(this, x, y, {
      count: 8,
      colors: [0xd0d0d0, 0x8a8a8a, 0x454545, 0xffffff],
      power: 260,
      shake: 0.008,
      ring: true,
      word: 'POP!',
      wordColor: '#ff8b8b',
    });
    this.respawning = true;
    this.player.setVisible(false);
    this.player.x = this.spawn.x;
    this.player.y = this.spawn.y;
    this.knockX = 0;
    this.knockY = 0;
    this.emitHud(true);
    const gen = this.lifeGen;
    this.time.delayedCall(700, () => {
      if (gen !== this.lifeGen || this.mode !== 'play' || this.won) return;
      this.respawning = false;
      this.invuln = 1.5;
      this.health = 3;
      this.player.setVisible(true);
      this.player.setPosition(this.spawn.x, this.spawn.y);
      popText(this, this.spawn.x, this.spawn.y - 28, 'GO!', '#b9f6ca');
      this.emitHud(true);
    });
  }

  checkWin() {
    if (this.won || this.respawning || !this.player?.visible) return;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    if (this.grid[ty]?.[tx] === 'F') this.win();
  }

  win() {
    this.won = true;
    this.aim.clear();
    const palette = [0xe10600, 0xffd000, 0x1e88e5, 0x43a047, 0xffffff];
    for (let i = 0; i < 4; i++) {
      spawnBurst(this, 140 + i * 180, 90 + (i % 2) * 50, {
        count: 8,
        colors: palette,
        power: 300,
        shake: i === 0 ? 0.007 : 0,
        ring: i === 0,
      });
    }
    flashScreen(this, 0xffffff, 0.18);
    window.dispatchEvent(
      new CustomEvent('bbb-results', {
        detail: {
          time: this.finishElapsed,
          coins: this.coinsGot,
          coinsTotal: this.coinsTotal,
          smashed: this.smashed,
          enemyTotal: this.enemyTotal,
        },
      }),
    );
    this.emitHud(true);
  }

  emitHud(force) {
    const shown = this.won ? this.finishElapsed : this.finishElapsed;
    const snap = `${this.health}|${this.coinsGot}|${this.smashed}|${Math.floor(shown * 10)}`;
    if (!force && snap === this.hudSnap) return;
    this.hudSnap = snap;
    window.dispatchEvent(
      new CustomEvent('bbb-hud', {
        detail: {
          health: this.health,
          coins: this.coinsGot,
          coinsTotal: this.coinsTotal,
          smashed: this.smashed,
          enemyTotal: this.enemyTotal,
          time: shown,
        },
      }),
    );
  }
}
