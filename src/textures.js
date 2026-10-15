import { COLS, ROWS } from './level.js';

/**
 * Recolor the hero here. The figure stays gray and wears an army helmet.
 */
export const PLAYER_COLORS = {
  head: '#d0d0d0',
  headShade: '#9e9e9e',
  torso: '#8a8a8a',
  torsoShade: '#5e5e5e',
  arms: '#757575',
  legs: '#454545',
  stud: '#f2f2f2',
  eye: '#222222',
  blaster: '#3c3c3c',
  blasterTip: '#c8c8c8',
  hat: '#6a7178',
};

/** Old rust-brown hull. Scorch and heat stains are painted on top of this. */
export const TANK_COLOR = '#8a4a28';
const TANK_RUST = '#c4622d';
const TANK_SCORCH = '#1c1612';
const TANK_HEAT = '#3a2a22';

const TEX = 80;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  tex.refresh();
}

function stud(ctx, x, y, radius, fill, shade) {
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(x, y + 1.5, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

function brickBody(ctx, fill, shade, cracks) {
  roundRect(ctx, 4, 14, 72, 60, 8);
  ctx.fillStyle = shade;
  ctx.fill();
  roundRect(ctx, 4, 8, 72, 60, 8);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 3;
  roundRect(ctx, 5.5, 9.5, 69, 57, 7);
  ctx.stroke();
  const spots = [
    [22, 24],
    [58, 24],
    [22, 50],
    [58, 50],
  ];
  for (const [x, y] of spots) stud(ctx, x, y, 8, lighten(fill), shade);
  if (cracks > 0) {
    ctx.strokeStyle = 'rgba(40, 0, 0, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(24, 20);
    ctx.lineTo(38, 36);
    ctx.lineTo(30, 58);
    ctx.stroke();
  }
  if (cracks > 1) {
    ctx.beginPath();
    ctx.moveTo(52, 18);
    ctx.lineTo(46, 40);
    ctx.lineTo(64, 60);
    ctx.stroke();
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 48);
  const g = Math.min(255, ((n >> 8) & 255) + 48);
  const b = Math.min(255, (n & 255) + 48);
  return `rgb(${r},${g},${b})`;
}

function drawBoard(ctx) {
  const size = TEX;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = x * size;
      const py = y * size;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#86a0b4' : '#7d98ad';
      ctx.fillRect(px, py, size, size);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(px, py, size, 3);
      stud(ctx, px + size / 2, py + size / 2, 16, '#9bb3c6', '#61788a');
    }
  }
}

function drawPlayer(ctx) {
  const colors = PLAYER_COLORS;
  ctx.fillStyle = colors.legs;
  roundRect(ctx, 26, 54, 12, 16, 3);
  ctx.fill();
  roundRect(ctx, 42, 54, 12, 16, 3);
  ctx.fill();
  ctx.fillStyle = colors.torsoShade;
  roundRect(ctx, 20, 36, 40, 24, 5);
  ctx.fill();
  ctx.fillStyle = colors.torso;
  roundRect(ctx, 20, 32, 40, 24, 5);
  ctx.fill();
  stud(ctx, 32, 44, 4, colors.stud, colors.torsoShade);
  stud(ctx, 48, 44, 4, colors.stud, colors.torsoShade);
  ctx.fillStyle = colors.arms;
  roundRect(ctx, 6, 34, 14, 14, 3);
  ctx.fill();
  roundRect(ctx, 60, 34, 14, 14, 3);
  ctx.fill();
  ctx.fillStyle = colors.headShade;
  ctx.beginPath();
  ctx.arc(40, 28, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.head;
  ctx.beginPath();
  ctx.arc(40, 26, 16, 0, Math.PI * 2);
  ctx.fill();
  if (colors.hat) {
    ctx.fillStyle = shade(colors.hat, -28);
    ctx.beginPath();
    ctx.ellipse(40, 24, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.hat;
    ctx.beginPath();
    ctx.ellipse(40, 22, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(colors.hat, -12);
    ctx.beginPath();
    ctx.arc(40, 16, 13, Math.PI * 1.02, -0.02);
    ctx.lineTo(40, 18);
    ctx.fill();
    ctx.fillStyle = shade(colors.hat, 28);
    ctx.fillRect(38.5, 6, 3, 12);
    ctx.fillStyle = shade(colors.hat, 40);
    ctx.beginPath();
    ctx.ellipse(32, 21, 7, 2.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = colors.eye;
  ctx.beginPath();
  ctx.arc(34, 30, 2, 0, Math.PI * 2);
  ctx.arc(46, 30, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(ctx, hurt) {
  ctx.fillStyle = '#bf360c';
  ctx.beginPath();
  ctx.arc(40, 42, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hurt ? '#e65100' : '#ff6d00';
  ctx.beginPath();
  ctx.arc(40, 38, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4e1400';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(28, 36, 7, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(52, 36, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  if (hurt) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(23, 32);
    ctx.lineTo(33, 40);
    ctx.moveTo(33, 32);
    ctx.lineTo(23, 40);
    ctx.moveTo(47, 32);
    ctx.lineTo(57, 40);
    ctx.moveTo(57, 32);
    ctx.lineTo(47, 40);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(30, 38, 3, 0, Math.PI * 2);
    ctx.arc(50, 38, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#3e1200';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 24);
  ctx.lineTo(30, 30);
  ctx.moveTo(62, 24);
  ctx.lineTo(50, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, 52);
  ctx.quadraticCurveTo(40, 44, 52, 52);
  ctx.stroke();
  if (hurt) {
    ctx.beginPath();
    ctx.moveTo(18, 18);
    ctx.lineTo(36, 40);
    ctx.lineTo(28, 58);
    ctx.stroke();
  }
}

function drawBrute(ctx, cracks) {
  ctx.fillStyle = '#4a148c';
  ctx.beginPath();
  ctx.arc(40, 44, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cracks >= 2 ? '#8e24aa' : '#7b1fa2';
  ctx.beginPath();
  ctx.arc(40, 40, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#311b92';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#ede7f6';
  ctx.beginPath();
  ctx.moveTo(22, 24);
  ctx.lineTo(16, 8);
  ctx.lineTo(32, 20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(58, 24);
  ctx.lineTo(64, 8);
  ctx.lineTo(48, 20);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(28, 38, 8, 9, 0, 0, Math.PI * 2);
  ctx.ellipse(52, 38, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffea00';
  ctx.beginPath();
  ctx.arc(30, 40, 3.5, 0, Math.PI * 2);
  ctx.arc(50, 40, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(31, 41, 2, 0, Math.PI * 2);
  ctx.arc(51, 41, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#311b92';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(16, 28);
  ctx.lineTo(36, 34);
  ctx.moveTo(64, 28);
  ctx.lineTo(44, 34);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(26, 52);
  ctx.lineTo(32, 46);
  ctx.lineTo(38, 54);
  ctx.lineTo(44, 46);
  ctx.lineTo(50, 54);
  ctx.lineTo(56, 46);
  ctx.lineTo(56, 58);
  ctx.lineTo(26, 58);
  ctx.closePath();
  ctx.fill();
  if (cracks > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 18);
    ctx.lineTo(36, 40);
    ctx.lineTo(28, 58);
    ctx.stroke();
  }
  if (cracks > 1) {
    ctx.beginPath();
    ctx.moveTo(58, 16);
    ctx.lineTo(48, 36);
    ctx.lineTo(62, 56);
    ctx.stroke();
  }
}

function drawCoin(ctx) {
  ctx.fillStyle = '#f9a825';
  ctx.beginPath();
  ctx.moveTo(40, 6);
  ctx.lineTo(70, 40);
  ctx.lineTo(40, 74);
  ctx.lineTo(10, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff59d';
  ctx.beginPath();
  ctx.moveTo(40, 18);
  ctx.lineTo(58, 40);
  ctx.lineTo(40, 62);
  ctx.lineTo(22, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(40, 24);
  ctx.lineTo(48, 36);
  ctx.lineTo(40, 34);
  ctx.closePath();
  ctx.fill();
}

function drawFlag(ctx, cloth, clothDark) {
  ctx.fillStyle = '#5d4037';
  roundRect(ctx, 18, 8, 8, 66, 2);
  ctx.fill();
  ctx.fillStyle = clothDark;
  ctx.beginPath();
  ctx.moveTo(26, 16);
  ctx.lineTo(70, 28);
  ctx.lineTo(26, 46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(26, 12);
  ctx.lineTo(66, 22);
  ctx.lineTo(26, 38);
  ctx.closePath();
  ctx.fill();
}

function drawStart(ctx) {
  drawFlag(ctx, '#43a047', '#1b5e20');
}

function drawFinish(ctx) {
  drawFlag(ctx, '#1e88e5', '#0d47a1');
}

function drawBlaster(ctx, w, h) {
  ctx.fillStyle = PLAYER_COLORS.blaster;
  roundRect(ctx, 0, 6, w - 4, h - 12, 3);
  ctx.fill();
  ctx.fillStyle = PLAYER_COLORS.blasterTip;
  roundRect(ctx, w - 12, 8, 10, h - 16, 2);
  ctx.fill();
}

function drawShard(ctx, w, h) {
  roundRect(ctx, 1, 4, w - 2, h - 6, 3);
  ctx.fillStyle = '#d0d0d0';
  ctx.fill();
  roundRect(ctx, 1, 2, w - 2, h - 6, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#e6e6e6';
  ctx.beginPath();
  ctx.arc(w * 0.35, h * 0.48, 3.2, 0, Math.PI * 2);
  ctx.arc(w * 0.68, h * 0.48, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(w * 0.35, h * 0.42, 3.2, 0, Math.PI * 2);
  ctx.arc(w * 0.68, h * 0.42, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTank(ctx, cracks) {
  ctx.clearRect(0, 0, 80, 80);
  ctx.fillStyle = '#241910';
  roundRect(ctx, 8, 16, 14, 50, 4);
  ctx.fill();
  roundRect(ctx, 58, 16, 14, 50, 4);
  ctx.fill();
  ctx.fillStyle = '#3a2e24';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(10, 20 + i * 9, 10, 3);
    ctx.fillRect(60, 20 + i * 9, 10, 3);
  }
  ctx.fillStyle = TANK_COLOR;
  roundRect(ctx, 16, 18, 48, 46, 6);
  ctx.fill();
  ctx.fillStyle = TANK_RUST;
  ctx.beginPath();
  ctx.ellipse(28, 32, 8, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(52, 50, 7, 4, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6e3b22';
  ctx.beginPath();
  ctx.ellipse(48, 28, 5, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(42, 24, 12, 0.45)';
  ctx.beginPath();
  ctx.arc(24, 46, 3.2, 0, Math.PI * 2);
  ctx.arc(54, 40, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TANK_HEAT;
  ctx.beginPath();
  ctx.ellipse(34, 48, 11, 7, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TANK_SCORCH;
  ctx.beginPath();
  ctx.ellipse(33, 46, 6, 3.4, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(50, 36, 4, 2.4, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(TANK_COLOR, -24);
  ctx.beginPath();
  ctx.arc(40, 40, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TANK_SCORCH;
  ctx.beginPath();
  ctx.arc(44, 36, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a3028';
  roundRect(ctx, 36, 4, 8, 24, 2);
  ctx.fill();
  ctx.fillStyle = TANK_SCORCH;
  ctx.fillRect(36, 4, 8, 7);
  ctx.fillStyle = '#5a5048';
  ctx.fillRect(37, 14, 6, 2);
  if (cracks > 0) {
    ctx.strokeStyle = '#140e0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26, 26);
    ctx.lineTo(34, 34);
    ctx.lineTo(24, 40);
    ctx.stroke();
  }
  if (cracks > 1) {
    ctx.beginPath();
    ctx.moveTo(48, 46);
    ctx.lineTo(58, 54);
    ctx.lineTo(50, 58);
    ctx.stroke();
  }
}

function drawTankShot(ctx) {
  ctx.fillStyle = TANK_SCORCH;
  ctx.beginPath();
  ctx.arc(12, 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TANK_RUST;
  ctx.beginPath();
  ctx.arc(12, 12, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0d2a0';
  ctx.beginPath();
  ctx.arc(10, 10, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSmoke(ctx) {
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 14);
  g.addColorStop(0, 'rgba(70, 70, 70, 0.55)');
  g.addColorStop(1, 'rgba(70, 70, 70, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
}

export function buildTextures(scene) {
  canvasTex(scene, 'board', COLS * TEX, ROWS * TEX, drawBoard);
  canvasTex(scene, 'brick0', TEX, TEX, (ctx) => brickBody(ctx, '#e10600', '#8e0400', 0));
  canvasTex(scene, 'brick1', TEX, TEX, (ctx) => brickBody(ctx, '#e10600', '#8e0400', 1));
  canvasTex(scene, 'brick2', TEX, TEX, (ctx) => brickBody(ctx, '#c40500', '#6d0300', 2));
  canvasTex(scene, 'solid', TEX, TEX, (ctx) => brickBody(ctx, '#1565c0', '#0d47a1', 0));
  canvasTex(scene, 'player', 68, 68, drawPlayer);
  canvasTex(scene, 'enemy', 72, 72, (ctx) => drawEnemy(ctx, false));
  canvasTex(scene, 'enemyHurt', 72, 72, (ctx) => drawEnemy(ctx, true));
  canvasTex(scene, 'brute', 80, 80, (ctx) => drawBrute(ctx, 0));
  canvasTex(scene, 'bruteHurt', 80, 80, (ctx) => drawBrute(ctx, 1));
  canvasTex(scene, 'bruteCrack', 80, 80, (ctx) => drawBrute(ctx, 2));
  canvasTex(scene, 'tank', 80, 80, (ctx) => drawTank(ctx, 0));
  canvasTex(scene, 'tankCrack', 80, 80, (ctx) => drawTank(ctx, 1));
  canvasTex(scene, 'tankBreak', 80, 80, (ctx) => drawTank(ctx, 2));
  canvasTex(scene, 'tankShot', 24, 24, drawTankShot);
  canvasTex(scene, 'smoke', 32, 32, drawSmoke);
  canvasTex(scene, 'coin', TEX, TEX, drawCoin);
  canvasTex(scene, 'start', TEX, TEX, drawStart);
  canvasTex(scene, 'finish', TEX, TEX, drawFinish);
  canvasTex(scene, 'blaster', 28, 18, drawBlaster);
  canvasTex(scene, 'shard', 28, 20, drawShard);
  canvasTex(scene, 'stud', 14, 14, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'shadow', 48, 18, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  canvasTex(scene, 'bullet', 22, 12, (ctx, w, h) => {
    roundRect(ctx, 0, 1, w, h - 2, 3);
    ctx.fillStyle = '#ffd000';
    ctx.fill();
    ctx.fillStyle = '#fff6c2';
    roundRect(ctx, 2, 2, 6, h - 6, 2);
    ctx.fill();
  });
}
