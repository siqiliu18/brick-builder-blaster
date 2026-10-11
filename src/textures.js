import { COLS, ROWS } from './level.js';

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
  ctx.fillStyle = '#c62828';
  roundRect(ctx, 20, 46, 12, 18, 3);
  ctx.fill();
  roundRect(ctx, 36, 46, 12, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#1565c0';
  roundRect(ctx, 16, 30, 36, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#0d47a1';
  roundRect(ctx, 16, 44, 36, 6, 2);
  ctx.fill();
  stud(ctx, 34, 40, 4, '#64b5f6', '#0d47a1');
  ctx.fillStyle = '#ffca28';
  roundRect(ctx, 48, 32, 10, 10, 3);
  ctx.fill();
  ctx.fillStyle = '#ffca28';
  ctx.beginPath();
  ctx.arc(34, 20, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f9a825';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(39, 18, 2.3, 0, Math.PI * 2);
  ctx.arc(30, 18, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(35, 22, 6, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

function drawEnemy(ctx, hurt) {
  ctx.fillStyle = '#1b5e20';
  roundRect(ctx, 14, 54, 16, 12, 3);
  ctx.fill();
  roundRect(ctx, 42, 54, 16, 12, 3);
  ctx.fill();
  ctx.fillStyle = hurt ? '#1b5e20' : '#2e7d32';
  roundRect(ctx, 10, 24, 52, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#43a047';
  roundRect(ctx, 14, 28, 44, 14, 6);
  ctx.fill();
  stud(ctx, 24, 22, 7, '#66bb6a', '#1b5e20');
  stud(ctx, 48, 22, 7, '#66bb6a', '#1b5e20');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(28, 40, 7, 0, Math.PI * 2);
  ctx.arc(46, 40, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d50000';
  ctx.beginPath();
  if (hurt) {
    ctx.arc(30, 41, 3, 0, Math.PI * 2);
    ctx.arc(44, 41, 3, 0, Math.PI * 2);
  } else {
    ctx.arc(30, 40, 3.2, 0, Math.PI * 2);
    ctx.arc(48, 40, 3.2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.strokeStyle = '#1b5e20';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (hurt) {
    ctx.moveTo(22, 30);
    ctx.lineTo(34, 34);
    ctx.moveTo(50, 30);
    ctx.lineTo(38, 34);
  } else {
    ctx.moveTo(22, 32);
    ctx.lineTo(34, 28);
    ctx.moveTo(50, 32);
    ctx.lineTo(38, 28);
  }
  ctx.stroke();
  if (hurt) {
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.moveTo(18, 30);
    ctx.lineTo(34, 48);
    ctx.lineTo(28, 58);
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

function drawStart(ctx) {
  ctx.fillStyle = '#2e7d32';
  roundRect(ctx, 6, 10, 68, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#66bb6a';
  ctx.beginPath();
  ctx.arc(40, 38, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(32, 24);
  ctx.lineTo(54, 38);
  ctx.lineTo(32, 52);
  ctx.closePath();
  ctx.fill();
}

function drawFinish(ctx) {
  const cell = 10;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f5f5f5' : '#212121';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  ctx.strokeStyle = '#fbc02d';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 74, 74);
  ctx.fillStyle = '#fbc02d';
  ctx.font = 'bold 22px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('END', 40, 42);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#212121';
  ctx.strokeText('END', 40, 42);
}

function drawBlaster(ctx, w, h) {
  ctx.fillStyle = '#424242';
  roundRect(ctx, 0, 6, w - 4, h - 12, 3);
  ctx.fill();
  ctx.fillStyle = '#ffca28';
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

export function buildTextures(scene) {
  canvasTex(scene, 'board', COLS * TEX, ROWS * TEX, drawBoard);
  canvasTex(scene, 'brick0', TEX, TEX, (ctx) => brickBody(ctx, '#e10600', '#8e0400', 0));
  canvasTex(scene, 'brick1', TEX, TEX, (ctx) => brickBody(ctx, '#e10600', '#8e0400', 1));
  canvasTex(scene, 'brick2', TEX, TEX, (ctx) => brickBody(ctx, '#c40500', '#6d0300', 2));
  canvasTex(scene, 'solid', TEX, TEX, (ctx) => brickBody(ctx, '#1565c0', '#0d47a1', 0));
  canvasTex(scene, 'player', 68, 68, drawPlayer);
  canvasTex(scene, 'enemy', 72, 72, (ctx) => drawEnemy(ctx, false));
  canvasTex(scene, 'enemyHurt', 72, 72, (ctx) => drawEnemy(ctx, true));
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
