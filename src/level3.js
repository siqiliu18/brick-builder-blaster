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
import { resolveAim } from './aim.js';
import { aimVector, isDown, stickVector } from './input.js';
import { playGrunt, playShot, syncMoveSound } from './audio.js';
import { getPlayerName } from './name.js';
import { createLevel3World, stepBullet } from './level3-sim.js';

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
  sprite.position.y = 1.45;
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

function runLevel3(root, { onSmash }) {
  const world = createLevel3World(jaspersLevel());
  const player = { x: world.spawn.x, y: world.spawn.y };
  const monsters = world.monsters.map((monster) => ({ ...monster, speed: MAD_MIN_SPEED }));
  const bullets = [];
  let aimAngle = 0;
  let nextShot = 0;
  let smashed = 0;
  let running = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7f93a6);
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(10, 16, 8);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 15),
    new THREE.MeshLambertMaterial({ color: 0x9eb4c6 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(10, 0, 7.5);
  scene.add(floor);

  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const brickGeo = new THREE.BoxGeometry(0.92, 0.72, 0.92);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x1565c0 });
  const brickMat = new THREE.MeshLambertMaterial({ color: 0xe10600 });
  const disposables = [floor.geometry, floor.material, wallGeo, brickGeo, wallMat, brickMat];

  for (const block of world.blocks) {
    const mesh = new THREE.Mesh(block.kind === 'W' ? wallGeo : brickGeo, block.kind === 'W' ? wallMat : brickMat);
    mesh.position.set(block.tx + 0.5, block.kind === 'W' ? 0.5 : 0.36, block.ty + 0.5);
    scene.add(mesh);
  }

  const heroMat = new THREE.MeshLambertMaterial({ color: 0x6a7178 });
  const noseMat = new THREE.MeshLambertMaterial({ color: 0x3ddc84 });
  const heroGeo = new THREE.BoxGeometry(0.55, 0.8, 0.55);
  const noseGeo = new THREE.BoxGeometry(0.28, 0.16, 0.16);
  disposables.push(heroMat, noseMat, heroGeo, noseGeo);
  const hero = new THREE.Group();
  const body = new THREE.Mesh(heroGeo, heroMat);
  body.position.y = 0.4;
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0.38, 0.48, 0);
  hero.add(body, nose);
  const name = getPlayerName();
  if (name) {
    const tag = nameSprite(name);
    hero.add(tag);
    disposables.push(tag.material.map, tag.material);
  }
  scene.add(hero);

  const monsterGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const monsterMat = new THREE.MeshLambertMaterial({ color: 0xff6d00 });
  disposables.push(monsterGeo, monsterMat);
  for (const monster of monsters) {
    const mesh = new THREE.Mesh(monsterGeo, monsterMat);
    mesh.position.y = 0.34;
    monster.mesh = mesh;
    scene.add(mesh);
  }

  const bulletGeo = new THREE.BoxGeometry(0.18, 0.18, 0.32);
  const bulletMat = new THREE.MeshLambertMaterial({ color: 0xffd000 });
  disposables.push(bulletGeo, bulletMat);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!renderer.getContext()) {
    renderer.dispose();
    throw new Error('WebGL context was not created');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x7f93a6, 1);
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

  const heroScreen = new THREE.Vector3();
  let last = performance.now();
  let frame = 0;

  function placeHero() {
    hero.position.set(player.x / TILE, 0, player.y / TILE);
    hero.rotation.y = -aimAngle;
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

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

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

    const rect = canvas.getBoundingClientRect();
    heroScreen.set(player.x / TILE, 0.5, player.y / TILE).project(camera);
    const hx = (heroScreen.x * 0.5 + 0.5) * rect.width + rect.left;
    const hy = (-heroScreen.y * 0.5 + 0.5) * rect.height + rect.top;
    const aim = aimVector();
    const shot = resolveAim({
      touchControls: document.body.classList.contains('touch-ui'),
      aimX: aim.x,
      aimY: aim.y,
      aimOn: aim.on,
      lastAim: aimAngle,
      pointerInside: pointer.inside,
      pointerDown: pointer.down,
      pointerOnBoard: pointer.onBoard,
      pointerAngle: Math.atan2(pointer.y - hy, pointer.x - hx),
    });
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
        bullet.mesh.position.set(bullet.x / TILE, 0.4, bullet.y / TILE);
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
    for (const monster of monsters) {
      monster.mesh.visible = monster.alive;
      monster.mesh.position.set(monster.x / TILE, 0.34, monster.y / TILE);
    }

    placeHero();
    const dist = 8;
    camera.position.lerp(
      new THREE.Vector3(
        player.x / TILE - Math.cos(aimAngle) * dist,
        7,
        player.y / TILE - Math.sin(aimAngle) * dist,
      ),
      1 - Math.exp(-5 * dt),
    );
    camera.lookAt(player.x / TILE, 0.5, player.y / TILE);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  placeHero();
  camera.position.set(player.x / TILE - 8, 7, player.y / TILE);
  camera.lookAt(player.x / TILE, 0.5, player.y / TILE);
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
