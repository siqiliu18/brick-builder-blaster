import * as THREE from 'three';
import { TILE, jaspersLevel } from './level.js';
import {
  ENEMY_HALF,
  MAD_MIN_SPEED,
  PLAYER_HALF,
  PLAYER_SPEED,
  chase,
  moveBody,
  separateEnemies,
} from './sim.js';
import { aimVector, isDown, stickVector } from './input.js';
import { playGrunt, playShot, syncMoveSound } from './audio.js';
import { getPlayerName } from './name.js';
import {
  FIXED_CAMERA,
  TANK_HP,
  advanceSpawner,
  angleTowardGround,
  applyContact,
  createLevel3World,
  reachedGoal,
  stepBullet,
  stickAngle,
} from './level3-sim.js';

const SHOT_GAP = 260;

export function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

function showFallback(root, onExit) {
  root.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'level3-fallback';
  const message = document.createElement('p');
  message.textContent = 'This browser can’t show the 3D test (no WebGL). Level 1 and Level 2 still work.';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-go';
  button.textContent = 'Back to menu';
  button.addEventListener('click', () => onExit?.());
  wrap.append(message, button);
  root.append(wrap);
}

function makeCanvasTexture(draw, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

function shiftColor(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.max(0, Math.min(255, shift + amount));
  const r = channel(value >> 16);
  const g = channel((value >> 8) & 255);
  const b = channel(value & 255);
  return `rgb(${r},${g},${b})`;
}

function drawBrick(ctx, size, color, mortar) {
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const cols = 4;
  const rows = 6;
  const gap = size * 0.055;
  const brickW = (size - gap * (cols + 1)) / cols;
  const brickH = (size - gap * (rows + 1)) / rows;
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : (brickW + gap) / 2;
    for (let col = -1; col <= cols; col++) {
      const x = gap + col * (brickW + gap) + offset;
      const y = gap + row * (brickH + gap);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, brickW, brickH);
      ctx.fillStyle = shiftColor(color, 48);
      ctx.fillRect(x, y, brickW, Math.max(2, brickH * 0.22));
      ctx.fillStyle = shiftColor(color, -42);
      ctx.fillRect(x, y + brickH * 0.78, brickW, Math.max(2, brickH * 0.22));
    }
  }
}

function drawFloor(ctx, size) {
  ctx.fillStyle = '#aeb6be';
  ctx.fillRect(0, 0, size, size);
  const tiles = 2;
  const gap = 4;
  const tile = (size - gap * (tiles + 1)) / tiles;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      const px = gap + x * (tile + gap);
      const py = gap + y * (tile + gap);
      ctx.fillStyle = (x + y) % 2 === 0 ? '#d5dbe1' : '#c3cbcf';
      ctx.fillRect(px, py, tile, tile);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(px, py, tile, tile * 0.14);
      ctx.fillStyle = 'rgba(60,70,80,0.18)';
      ctx.fillRect(px, py + tile * 0.86, tile, tile * 0.14);
    }
  }
}

function lambert(color, map) {
  return new THREE.MeshLambertMaterial(map ? { map, color: 0xffffff } : { color });
}

function blobShadow(texture, width, depth, disposables) {
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  disposables.push(geometry, material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

function makeTank(disposables) {
  const rust = lambert(0x8a4a28);
  const rustDark = lambert(0x5c3218);
  const treadMat = lambert(0x3a2a22);
  const wheelMat = lambert(0x2a2a2a);
  const helmetMat = lambert(0x6a7178);
  const skinMat = lambert(0xf0c09a);
  const shirtMat = lambert(0x3d8b4a);
  const eyeMat = lambert(0x222222);
  const hero = new THREE.Group();
  const hull = new THREE.Group();
  const turret = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.42), rust);
  body.position.y = 0.28;
  hull.add(body);
  const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8);
  for (const side of [-0.26, 0.26]) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.13), treadMat);
    tread.position.set(0, 0.1, side);
    hull.add(tread);
    disposables.push(tread.geometry);
    for (let i = 0; i < 4; i++) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(-0.3 + i * 0.2, 0.08, side);
      hull.add(wheel);
    }
  }

  const star = starPlane();
  star.position.set(0.08, 0.34, 0.22);
  hull.add(star);

  const dome = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.32), rustDark);
  dome.position.y = 0.48;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.08), rustDark);
  barrel.position.set(0.38, 0.5, 0);
  turret.add(dome, barrel);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skinMat);
  head.position.set(0.02, 0.72, 0);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), helmetMat);
  helmet.scale.set(1.05, 0.72, 1.05);
  helmet.position.set(-0.01, 0.8, 0);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), helmetMat);
  brim.position.set(0.08, 0.74, 0);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), shirtMat);
  shirt.position.set(-0.02, 0.58, 0);
  const eyeGeo = new THREE.SphereGeometry(0.025, 6, 5);
  turret.add(head, helmet, brim, shirt);
  for (const z of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.1, 0.73, z);
    turret.add(eye);
  }

  hero.add(hull, turret);
  disposables.push(
    rust, rustDark, treadMat, wheelMat, helmetMat, skinMat, shirtMat, eyeMat,
    body.geometry, wheelGeo, dome.geometry, barrel.geometry,
    head.geometry, helmet.geometry, brim.geometry, shirt.geometry, eyeGeo,
    star.geometry, star.material, star.material.map,
  );
  return { hero, hull, turret };
}

function starPlane() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffe14a';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = 32 + Math.cos(angle) * 26;
    const y = 32 + Math.sin(angle) * 26;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    const inner = angle + Math.PI / 5;
    ctx.lineTo(32 + Math.cos(inner) * 11, 32 + Math.sin(inner) * 11);
  }
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
  );
  return mesh;
}

function makeMonster(color, eyeMat, pupilMat, eyeGeo, pupilGeo, bodyGeo) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, lambert(color));
  body.scale.set(1, 0.82, 0.92);
  body.position.y = 0.38;
  group.add(body);
  for (const z of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.22, 0.48, z);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0.28, 0.48, z);
    group.add(eye, pupil);
  }
  return { group, bodyMat: body.material };
}

function makeFinish(goal, disposables) {
  const group = new THREE.Group();
  group.position.set(goal.tx + 0.5, 0, goal.ty + 0.5);
  const checker = makeCanvasTexture((ctx, size) => {
    const cells = 8;
    const cell = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f7f7f7' : '#1a1a1a';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }, 64);
  const stripMat = new THREE.MeshBasicMaterial({ map: checker });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.46), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = 0.035;
  const poleMat = lambert(0xf4f4f4);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 6), poleMat);
  pole.position.set(-0.32, 0.48, 0);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lambert(0xffe14a));
  cap.position.set(-0.32, 0.98, 0);
  const flag = new THREE.Group();
  flag.position.set(-0.28, 0.82, 0);
  const cloth = lambert(0x1e88e5);
  const band = lambert(0xffe14a);
  for (let i = 0; i < 3; i++) {
    const piece = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.05), i === 1 ? band : cloth);
    piece.position.set(0.1 + i * 0.15, Math.sin(i * 1.2) * 0.05, 0.02);
    flag.add(piece);
    disposables.push(piece.geometry);
  }
  group.add(strip, pole, cap, flag);
  disposables.push(checker, stripMat, strip.geometry, poleMat, pole.geometry, cap.material, cap.geometry, cloth, band);
  return { group, flag };
}

function nameSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 8, 8, 240, 48, 16);
  ctx.fill();
  ctx.strokeStyle = '#142033';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#142033';
  ctx.font = 'bold 28px Verdana, Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.8, 0.45, 1);
  sprite.position.y = 1.7;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Start the blocky Level 3 test in root. Three.js is only loaded with this module.
 * Returns a handle whose stop() releases the WebGL context.
 */
export function mountLevel3(root, { onExit, onSmash } = {}) {
  if (!webglAvailable()) {
    showFallback(root, onExit);
    return { stop() { root.replaceChildren(); } };
  }
  try {
    return runLevel3(root, { onExit, onSmash });
  } catch (error) {
    console.error(error);
    showFallback(root, onExit);
    return { stop() { root.replaceChildren(); } };
  }
}

function runLevel3(root, { onExit, onSmash, onHealth }) {
  const world = createLevel3World(jaspersLevel());
  const player = { x: world.spawn.x, y: world.spawn.y };
  const monsters = world.monsters.map((monster) => ({ ...monster, speed: MAD_MIN_SPEED }));
  const spawnPoints = monsters.map((monster) => ({ x: monster.x, y: monster.y }));
  const bullets = [];
  const bursts = [];
  let aimAngle = 0;
  let moveFacing = 0;
  let nextShot = 0;
  let smashed = 0;
  let running = true;
  let won = false;
  let lost = false;
  let hp = TANK_HP;
  let spawnTimer = 0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc5d4e0);
  scene.add(new THREE.HemisphereLight(0xfff6e4, 0x8aa0b0, 0.95));
  const sun = new THREE.DirectionalLight(0xfff8ee, 0.7);
  sun.position.set(12, 18, 6);
  scene.add(sun);

  const floorTex = makeCanvasTexture(drawFloor, 128);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(10, 7.5);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 15),
    new THREE.MeshLambertMaterial({ map: floorTex }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(10, 0, 7.5);
  scene.add(floor);

  const wallTex = makeCanvasTexture((ctx, size) => drawBrick(ctx, size, '#8d5a3c', '#d7c4b0'));
  const brickColors = ['#43a047', '#1e88e5', '#8e24aa', '#e10600'];
  const brickTextures = brickColors.map((color) => makeCanvasTexture((ctx, size) => drawBrick(ctx, size, color, '#efe6dc')));
  const wallGeo = new THREE.BoxGeometry(0.96, 1, 0.96);
  const brickGeo = new THREE.BoxGeometry(0.9, 0.7, 0.9);
  const wallMat = lambert(0xffffff, wallTex);
  const brickMats = brickTextures.map((texture) => lambert(0xffffff, texture));
  const disposables = [floor.geometry, floor.material, floorTex, wallGeo, brickGeo, wallMat, wallTex, ...brickMats, ...brickTextures];

  for (const block of world.blocks) {
    const colored = block.kind !== 'W';
    const material = colored ? brickMats[(block.tx + block.ty) % brickMats.length] : wallMat;
    const mesh = new THREE.Mesh(colored ? brickGeo : wallGeo, material);
    mesh.position.set(block.tx + 0.5, colored ? 0.35 : 0.5, block.ty + 0.5);
    scene.add(mesh);
  }

  const { hero, hull, turret } = makeTank(disposables);
  const shadowTex = makeCanvasTexture((ctx, size) => {
    const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
    fade.addColorStop(0, 'rgba(30, 40, 50, 0.4)');
    fade.addColorStop(1, 'rgba(30, 40, 50, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);
  }, 64);
  disposables.push(shadowTex);
  hero.add(blobShadow(shadowTex, 1.15, 0.8, disposables));
  const name = getPlayerName();
  if (name) {
    const tag = nameSprite(name);
    hero.add(tag);
    disposables.push(tag.material.map, tag.material);
  }
  scene.add(hero);

  const finish = makeFinish(world.goal, disposables);
  scene.add(finish.group);

  const bodyGeo = new THREE.SphereGeometry(0.32, 12, 10);
  const eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const pupilGeo = new THREE.SphereGeometry(0.045, 6, 5);
  const eyeMat = lambert(0xffffff);
  const pupilMat = lambert(0x222222);
  disposables.push(bodyGeo, eyeGeo, pupilGeo, eyeMat, pupilMat);
  monsters.forEach((monster, index) => {
    const color = monster.fromLayout || index % 2 === 0 ? 0xff6d00 : 0x7b1fa2;
    const built = makeMonster(color, eyeMat, pupilMat, eyeGeo, pupilGeo, bodyGeo);
    built.group.add(blobShadow(shadowTex, 0.7, 0.55, disposables));
    disposables.push(built.bodyMat);
    monster.mesh = built.group;
    built.group.position.set(monster.x / TILE, 0, monster.y / TILE);
    scene.add(built.group);
  });

  const bulletGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const bulletMat = lambert(0xffd000);
  const burstGeo = new THREE.SphereGeometry(0.08, 6, 5);
  const burstMat = lambert(0xffb300);
  disposables.push(bulletGeo, bulletMat, burstGeo, burstMat);

  function attachMonster(monster) {
    const color = monster.fromLayout || monsters.length % 2 === 0 ? 0xff6d00 : 0x7b1fa2;
    const built = makeMonster(color, eyeMat, pupilMat, eyeGeo, pupilGeo, bodyGeo);
    built.group.add(blobShadow(shadowTex, 0.7, 0.55, disposables));
    disposables.push(built.bodyMat);
    monster.mesh = built.group;
    monster.speed = MAD_MIN_SPEED;
    built.group.position.set(monster.x / TILE, 0, monster.y / TILE);
    scene.add(built.group);
  }

  function explode(monster) {
    const group = new THREE.Group();
    group.position.set(monster.x / TILE, 0.35, monster.y / TILE);
    for (let i = 0; i < 6; i++) {
      const bit = new THREE.Mesh(burstGeo, burstMat);
      const angle = (i / 6) * Math.PI * 2;
      bit.position.set(Math.cos(angle) * 0.12, 0.25, Math.sin(angle) * 0.12);
      group.add(bit);
    }
    scene.add(group);
    bursts.push({ group, life: 0.4, max: 0.4 });
    if (monster.mesh) scene.remove(monster.mesh);
    monster.mesh = null;
  }

  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i];
      burst.life -= dt;
      const grown = 1 + (1 - burst.life / burst.max) * 2.4;
      burst.group.scale.setScalar(grown);
      if (burst.life <= 0) {
        scene.remove(burst.group);
        bursts.splice(i, 1);
      }
    }
  }

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!renderer.getContext()) {
    renderer.dispose();
    throw new Error('WebGL context was not created');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xc5d4e0, 1);
  renderer.domElement.style.touchAction = 'none';
  root.replaceChildren(renderer.domElement);

  const pointer = { inside: false, down: false, onBoard: false, x: 0, y: 0 };
  const canvas = renderer.domElement;
  const onPointerDown = (event) => {
    pointer.down = true;
    pointer.onBoard = true;
    pointer.inside = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };
  const onPointerMove = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = true;
  };
  const onPointerUp = () => {
    pointer.down = false;
    pointer.onBoard = false;
  };
  const onPointerLeave = () => {
    pointer.inside = false;
    pointer.down = false;
    pointer.onBoard = false;
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  function resize() {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(root);

  let last = performance.now();
  let frame = 0;

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundHit = new THREE.Vector3();

  function groundShot() {
    if (!pointer.inside && !pointer.down) return { angle: aimAngle, fire: false };
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return { angle: aimAngle, fire: false };
    ndc.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, groundHit);
    if (!hit) return { angle: aimAngle, fire: false };
    const angle = angleTowardGround(player.x, player.y, hit.x, hit.z, TILE);
    return { angle, fire: pointer.down && pointer.onBoard };
  }

  function placeHero() {
    hero.position.set(player.x / TILE, 0, player.y / TILE);
    hull.rotation.y = -moveFacing;
    turret.rotation.y = -aimAngle;
  }

  function spawnBullet(angle) {
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    const bullet = {
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      angle,
      mesh,
    };
    bullets.push(bullet);
    scene.add(mesh);
    playShot();
  }

  function showOverlay(titleText, noteText) {
    const wrap = document.createElement('div');
    wrap.className = 'level3-win';
    const title = document.createElement('h2');
    title.textContent = titleText;
    const note = document.createElement('p');
    note.textContent = noteText;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-go';
    button.textContent = 'Back to menu';
    button.addEventListener('click', () => onExit?.());
    wrap.append(title, note, button);
    root.append(wrap);
  }

  function showWin() {
    const name = getPlayerName();
    showOverlay(name ? `${name}, you win!` : 'You win!', 'You reached the finish flag!');
  }

  function showLose() {
    const name = getPlayerName();
    showOverlay('Try again', name ? `${name}, the monsters got the tank.` : 'The monsters got the tank.');
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    finish.flag.rotation.z = Math.sin(now / 220) * 0.35;
    updateBursts(dt);
    if (won || lost) {
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
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
    if (moving) moveFacing = Math.atan2(iy, ix);
    const len = Math.hypot(ix, iy) || 1;
    moveBody(
      player,
      moving ? (ix / len) * PLAYER_SPEED : 0,
      moving ? (iy / len) * PLAYER_SPEED : 0,
      dt,
      PLAYER_HALF,
      world.grid,
    );
    syncMoveSound(dt, moving, false);
    if (reachedGoal(player, world.goal)) {
      won = true;
      showWin();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
      return;
    }
    const contact = applyContact(player, monsters, hp);
    if (contact.popped.length) {
      hp = contact.hp;
      for (const monster of contact.popped) explode(monster);
      onHealth?.(hp);
      if (contact.dead) {
        lost = true;
        showLose();
        renderer.render(scene, camera);
        frame = requestAnimationFrame(tick);
        return;
      }
    }
    const spawn = advanceSpawner(spawnTimer, dt, monsters, player, spawnPoints);
    spawnTimer = spawn.timer;
    if (spawn.spawned) {
      monsters.push(spawn.spawned);
      attachMonster(spawn.spawned);
    }

    const aim = aimVector();
    const shot = aim.on
      ? { angle: Math.hypot(aim.x, aim.y) > 0.22 ? stickAngle(aim.x, aim.y) : aimAngle, fire: true }
      : groundShot();
    aimAngle = shot.angle;
    if (shot.fire && now >= nextShot) {
      nextShot = now + SHOT_GAP;
      spawnBullet(aimAngle);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      const result = stepBullet(bullet, dt, world.grid, monsters);
      if (result === 'hit') playGrunt(false);
      if (result === 'defeat') {
        playGrunt(true);
        smashed += 1;
        onSmash?.(smashed);
      }
      if (result === 'fly') {
        bullet.mesh.position.set(bullet.x / TILE, 0.5, bullet.y / TILE);
        bullet.mesh.rotation.y = -bullet.angle;
      } else {
        scene.remove(bullet.mesh);
        bullets.splice(i, 1);
      }
    }

    for (const monster of monsters) {
      if (!monster.alive) continue;
      chase(monster, player, dt, ENEMY_HALF, world.grid);
    }
    separateEnemies(monsters, ENEMY_HALF, world.grid);
    for (let i = monsters.length - 1; i >= 0; i--) {
      const monster = monsters[i];
      if (!monster.alive) {
        if (monster.mesh) scene.remove(monster.mesh);
        monsters.splice(i, 1);
        continue;
      }
      if (!monster.mesh) continue;
      monster.mesh.visible = true;
      monster.mesh.position.set(monster.x / TILE, 0, monster.y / TILE);
      const face = Math.atan2(player.y - monster.y, player.x - monster.x);
      monster.mesh.rotation.y = -face;
    }

    placeHero();
    const focusX = player.x / TILE;
    const focusZ = player.y / TILE;
    camera.position.lerp(
      new THREE.Vector3(focusX + FIXED_CAMERA.x, FIXED_CAMERA.height, focusZ + FIXED_CAMERA.south),
      1 - Math.exp(-5 * dt),
    );
    camera.lookAt(focusX, 0.3, focusZ);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  placeHero();
  camera.position.set(
    player.x / TILE + FIXED_CAMERA.x,
    FIXED_CAMERA.height,
    player.y / TILE + FIXED_CAMERA.south,
  );
  camera.lookAt(player.x / TILE, 0.3, player.y / TILE);
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      syncMoveSound(0, false, false);
      for (const item of disposables) item.dispose?.();
      renderer.dispose();
      root.replaceChildren();
    },
  };
}
