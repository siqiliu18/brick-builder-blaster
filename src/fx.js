import { VIEW_H, VIEW_W } from './level.js';

export function clearFx(scene) {
  for (const shard of scene.fx || []) shard.img.destroy();
  scene.fx = [];
}

export function updateFx(scene, dt) {
  if (!scene.fx) return;
  const keep = [];
  for (const shard of scene.fx) {
    shard.vy += 1500 * dt;
    shard.img.x += shard.vx * dt;
    shard.img.y += shard.vy * dt;
    shard.img.rotation += shard.spin * dt;
    if (shard.img.y > shard.floor && shard.vy > 0) {
      shard.img.y = shard.floor;
      shard.vy = -shard.vy * 0.38;
      shard.vx *= 0.75;
      if (Math.abs(shard.vy) < 36) shard.vy = 0;
    }
    shard.life -= dt;
    const fade = Math.min(0.4, shard.maxLife * 0.34);
    shard.img.alpha = shard.life > fade ? 1 : Math.max(0, shard.life / fade);
    if (shard.life <= 0) shard.img.destroy();
    else keep.push(shard);
  }
  scene.fx = keep;
}

export function spawnBurst(scene, x, y, opts = {}) {
  const count = opts.count ?? 8;
  const colors = opts.colors ?? [0xe10600, 0xff3b30, 0xffd000];
  const power = opts.power ?? 240;
  scene.fx = scene.fx || [];
  for (let i = 0; i < count; i++) {
    const spark = i >= count - 2;
    const img = scene.add.image(x, y, spark ? 'stud' : 'shard').setDepth(5000);
    const color = colors[i % colors.length];
    img.setTint(color);
    const scale = (spark ? 0.7 : 0.85) + Math.random() * 0.55;
    img.setScale(scale);
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.35 + Math.random() * 0.7) * power;
    const maxLife = opts.life ?? 1.15 + Math.random() * 0.25;
    scene.fx.push({
      img,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.65 - (90 + Math.random() * power * 0.55),
      spin: (Math.random() - 0.5) * 16,
      life: maxLife,
      maxLife,
      floor: Math.min(VIEW_H - 6, y + 14 + Math.random() * 30),
    });
  }
  if (opts.ring) shockwave(scene, x, y, opts.ringColor ?? 0xffffff);
  if (opts.shake) scene.cameras.main.shake(150, opts.shake);
  if (opts.word) popText(scene, x, y - 8, opts.word, opts.wordColor);
}

export function popText(scene, x, y, message, color = '#ffe14a', size = 26) {
  const startY = Math.max(30, Math.min(VIEW_H - 20, y));
  const text = scene.add
    .text(x, startY, message, {
      fontFamily: 'Verdana, Trebuchet MS, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: '#1a1204',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(6000)
    .setScale(0.6);
  scene.tweens.add({
    targets: text,
    y: startY - 28,
    scale: 1.15,
    duration: 180,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: text,
    y: startY - 48,
    alpha: 0,
    delay: 240,
    duration: 420,
    onComplete: () => text.destroy(),
  });
}

export function shockwave(scene, x, y, color = 0xffffff) {
  const g = scene.add.graphics().setDepth(4900);
  const state = { r: 8, a: 0.95 };
  scene.tweens.add({
    targets: state,
    r: 64,
    a: 0,
    duration: 420,
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      g.clear();
      g.lineStyle(6, color, state.a);
      g.strokeCircle(x, y, state.r);
    },
    onComplete: () => g.destroy(),
  });
}

export function flashScreen(scene, color, alpha) {
  const rect = scene.add
    .rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, color, alpha)
    .setDepth(4500);
  scene.tweens.add({
    targets: rect,
    alpha: 0,
    duration: 180,
    onComplete: () => rect.destroy(),
  });
}
