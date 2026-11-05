import * as THREE from 'three';
import { TILE } from './level.js';
import {
  ALLY_HP,
  FIXED_CAMERA,
  MAX_ALLIES,
  allySpawnNear,
  angleTowardGround,
  applyContact,
  canAddAlly,
  stepAlly,
  stickAngle,
} from './level3-sim.js';
import {
  blobShadow,
  drawBrick,
  drawFloor,
  lambert,
  makeCanvasTexture,
  makeFinish,
  makeMonster,
  makeTank,
  nameSprite,
  webglAvailable,
} from './level3.js';
import { MAZE_KINDS, advanceMazeSpawner, createMazeWorld, mazeTouch, stepMazeBullet } from './level2-3d-sim.js';
import {
  ENEMY_HALF,
  PLAYER_HALF,
  PLAYER_TANK_SPEED,
  TANK_ARMOR,
  madSpeed,
  moveBody,
  separateEnemies,
  stepBrute,
  chase,
} from './sim.js';
import { aimVector, isDown, stickVector } from './input.js';
import { playGrunt, playShot, syncMoveSound } from './audio.js';
import { getPlayerName } from './name.js';

const SHOT_GAP = 260;

function showFallback(root, onExit) {
  root.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'level3-fallback';
  const message = document.createElement('p');
  message.textContent = 'This browser can’t show Level 2 in 3D (no WebGL).';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-go';
  button.textContent = 'Back to menu';
  button.addEventListener('click', () => onExit?.());
  wrap.append(message, button);
  root.append(wrap);
}

/**
 * Play the Level 2 maze in the same cartoon 3D view as Level 3.
 * Layout, brutes, armor, coins, and the finish flag follow the 2D rules.
 */
export function mountLevel2(root, hooks = {}) {
  if (!webglAvailable()) {
    showFallback(root, hooks.onExit);
    return { stop() { root.replaceChildren(); } };
  }
  try {
    return runLevel2(root, hooks);
  } catch (error) {
    console.error(error);
    showFallback(root, hooks.onExit);
    return { stop() { root.replaceChildren(); } };
  }
}

function runLevel2(root, { onExit, onHud, onWin, rows }) {
  const world = createMazeWorld(rows);
  const player = { x: world.spawn.x, y: world.spawn.y };
  const monsters = world.monsters.map((monster) => ({ ...monster }));
  const bullets = [];
  let aimAngle = 0;
  let moveFacing = 0;
  let nextShot = 0;
  let smashed = 0;
  let coinsGot = 0;
  let armor = TANK_ARMOR;
  let health = 3;
  let invuln = 0;
  let knockX = 0;
  let knockY = 0;
  let respawn = 0;
  let running = true;
  let won = false;
  let startedAt = performance.now();
  let spawnTimer = 0;
  let spawnIndex = 0;
  let alliesCalled = 0;
  const allies = [];
  const disposables = [];

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
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(10, 0, 7.5);
  scene.add(floor);
  disposables.push(floor.geometry, floor.material, floorTex);

  const wallTex = makeCanvasTexture((ctx, size) => drawBrick(ctx, size, '#8d5a3c', '#d7c4b0'));
  const brickColors = ['#43a047', '#1e88e5', '#8e24aa', '#e10600'];
  const brickTextures = brickColors.map((color) => makeCanvasTexture((ctx, size) => drawBrick(ctx, size, color, '#efe6dc')));
  const wallGeo = new THREE.BoxGeometry(0.96, 1, 0.96);
  const brickGeo = new THREE.BoxGeometry(0.9, 0.7, 0.9);
  const wallMat = lambert(0xffffff, wallTex);
  const brickMats = brickTextures.map((texture) => lambert(0xffffff, texture));
  disposables.push(wallGeo, brickGeo, wallMat, wallTex, ...brickMats, ...brickTextures);
  const brickMeshes = new Map();
  for (const block of world.blocks) {
    const colored = block.kind !== 'W';
    const material = colored ? brickMats[(block.tx + block.ty) % brickMats.length] : wallMat;
    const mesh = new THREE.Mesh(colored ? brickGeo : wallGeo, material);
    mesh.position.set(block.tx + 0.5, colored ? 0.35 : 0.5, block.ty + 0.5);
    if (colored) brickMeshes.set(`${block.tx},${block.ty}`, mesh);
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
  const allyTanks = [];
  for (let i = 0; i < MAX_ALLIES; i++) {
    const tank = makeTank(disposables, { rainbow: true, rider: false });
    tank.hero.visible = false;
    tank.used = false;
    scene.add(tank.hero);
    allyTanks.push(tank);
  }

  const finish = makeFinish(world.goal, disposables);
  scene.add(finish.group);

  const bodyGeo = new THREE.SphereGeometry(0.34, 12, 10);
  const eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const pupilGeo = new THREE.SphereGeometry(0.045, 6, 5);
  const eyeMat = lambert(0xffffff);
  const pupilMat = lambert(0x222222);
  disposables.push(bodyGeo, eyeGeo, pupilGeo, eyeMat, pupilMat);
  function attachMonster(monster) {
    const stats = MAZE_KINDS[monster.kind] || MAZE_KINDS.bruiser;
    const built = makeMonster(stats.color, eyeMat, pupilMat, eyeGeo, pupilGeo, bodyGeo);
    built.group.scale.setScalar(stats.scale);
    built.group.add(blobShadow(shadowTex, 0.75, 0.6, disposables));
    disposables.push(built.bodyMat);
    monster.mesh = built.group;
    built.group.position.set(monster.x / TILE, 0, monster.y / TILE);
    scene.add(built.group);
  }
  for (const monster of monsters) attachMonster(monster);

  const coinGeo = new THREE.OctahedronGeometry(0.16, 0);
  const coinMat = lambert(0xffd000);
  disposables.push(coinGeo, coinMat);
  for (const coin of world.coins) {
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.position.set(coin.x / TILE, 0.28, coin.y / TILE);
    coin.mesh = mesh;
    scene.add(mesh);
  }

  const bulletGeo = new THREE.SphereGeometry(0.09, 8, 6);
  const bulletMat = lambert(0xffd000);
  disposables.push(bulletGeo, bulletMat);

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
  const allyButton = document.createElement('button');
  allyButton.type = 'button';
  allyButton.className = 'level3-ally-btn';
  allyButton.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="rainbow-tank-l2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e10600"/>
        <stop offset="0.2" stop-color="#ff6d00"/>
        <stop offset="0.4" stop-color="#ffe14a"/>
        <stop offset="0.6" stop-color="#43a047"/>
        <stop offset="0.8" stop-color="#1e88e5"/>
        <stop offset="1" stop-color="#8e24aa"/>
      </linearGradient>
    </defs>
    <rect x="6" y="30" width="40" height="16" rx="3" fill="url(#rainbow-tank-l2)"/>
    <rect x="16" y="18" width="18" height="14" rx="2" fill="url(#rainbow-tank-l2)"/>
    <rect x="30" y="22" width="24" height="6" rx="2" fill="#ffe14a"/>
    <rect x="8" y="46" width="36" height="6" rx="2" fill="#5c3218"/>
  </svg><span class="level3-ally-count">5</span>`;
  const allyCount = allyButton.querySelector('.level3-ally-count');
  function paintAllyCount() {
    const left = Math.max(0, MAX_ALLIES - alliesCalled);
    allyCount.textContent = String(left);
    allyButton.disabled = left === 0;
    allyButton.setAttribute('aria-label', left ? `Call rainbow tank, ${left} left` : 'No rainbow tanks left');
  }
  function onAllyPointerDown(event) {
    if (allyButton.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    allyButton.setPointerCapture?.(event.pointerId);
  }
  function onAllyPointerUp(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.button != null && event.button !== 0) return;
    summonAlly();
  }
  allyButton.addEventListener('pointerdown', onAllyPointerDown, { passive: false });
  allyButton.addEventListener('pointerup', onAllyPointerUp, { passive: false });
  (root.parentElement || root).append(allyButton);
  paintAllyCount();

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

  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundHit = new THREE.Vector3();
  let last = performance.now();
  let frame = 0;

  function hud(forceTime) {
    const time = won ? forceTime : (performance.now() - startedAt) / 1000;
    onHud?.({
      health,
      armor,
      armorMax: TANK_ARMOR,
      coins: coinsGot,
      smashed,
      time,
    });
  }

  function groundShot() {
    if (!pointer.inside && !pointer.down) return { angle: aimAngle, fire: false };
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return { angle: aimAngle, fire: false };
    ndc.x = ((pointer.x - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((pointer.y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, groundHit);
    if (!hit) return { angle: aimAngle, fire: false };
    return {
      angle: angleTowardGround(player.x, player.y, hit.x, hit.z, TILE),
      fire: pointer.down && pointer.onBoard,
    };
  }

  function placeHero() {
    hero.position.set(player.x / TILE, 0, player.y / TILE);
    hull.rotation.y = -moveFacing;
    turret.rotation.y = -aimAngle;
    hero.visible = respawn <= 0;
  }

  function summonAlly() {
    if (!canAddAlly(alliesCalled)) {
      allyButton.disabled = true;
      return;
    }
    const tank = allyTanks.find((item) => !item.used);
    if (!tank) {
      allyButton.disabled = true;
      return;
    }
    const spot = allySpawnNear(player, world.grid, allies);
    tank.used = true;
    tank.hero.visible = true;
    alliesCalled += 1;
    allies.push({
      x: spot.x,
      y: spot.y,
      facing: moveFacing,
      cooldown: 0.2,
      hp: ALLY_HP,
      alive: true,
      slot: alliesCalled - 1,
      tank,
    });
    paintAllyCount();
  }

  function syncAllies() {
    for (let i = allies.length - 1; i >= 0; i--) {
      const ally = allies[i];
      if (!ally.alive) {
        ally.tank.hero.visible = false;
        ally.tank.used = false;
        allies.splice(i, 1);
        continue;
      }
      ally.tank.hero.visible = true;
      ally.tank.hero.position.set(ally.x / TILE, 0, ally.y / TILE);
      ally.tank.hull.rotation.y = -ally.facing;
      ally.tank.turret.rotation.y = -ally.facing;
    }
  }

  const burstGeo = new THREE.SphereGeometry(0.08, 6, 5);
  const burstMat = lambert(0xffb300);
  disposables.push(burstGeo, burstMat);
  const bursts = [];
  function explode(monster) {
    const group = new THREE.Group();
    group.position.set(monster.x / TILE, 0.35, monster.y / TILE);
    for (let i = 0; i < 6; i++) {
      const bit = new THREE.Mesh(burstGeo, burstMat);
      const angle = (i / 6) * Math.PI * 2;
      bit.position.set(Math.cos(angle) * 0.12, 0.2, Math.sin(angle) * 0.12);
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
      burst.group.scale.setScalar(1 + (1 - burst.life / burst.max) * 2.2);
      if (burst.life <= 0) {
        scene.remove(burst.group);
        bursts.splice(i, 1);
      }
    }
  }

  function spawnBullet(angle, from = player) {
    const mesh = new THREE.Mesh(bulletGeo, bulletMat);
    bullets.push({
      x: from.x + Math.cos(angle) * 26,
      y: from.y + Math.sin(angle) * 26,
      angle,
      mesh,
    });
    scene.add(mesh);
    playShot();
  }

  function resetBrutes() {
    for (const monster of monsters) {
      if (!monster.alive || monster.kind !== 'brute') continue;
      monster.x = monster.homeX;
      monster.y = monster.homeY;
      monster.aggro = 0;
    }
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    finish.flag.rotation.z = Math.sin(now / 220) * 0.35;
    updateBursts(dt);
    if (won) {
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
      return;
    }

    if (respawn > 0) {
      respawn -= dt;
      if (respawn <= 0) {
        health = 3;
        invuln = 1.5;
        hud();
      }
    } else {
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
      const speed = PLAYER_TANK_SPEED;
      moveBody(
        player,
        (moving ? (ix / len) * speed : 0) + knockX,
        (moving ? (iy / len) * speed : 0) + knockY,
        dt,
        PLAYER_HALF,
        world.grid,
      );
      knockX *= Math.exp(-10 * dt);
      knockY *= Math.exp(-10 * dt);
      syncMoveSound(dt, moving, true);
      if (invuln > 0) invuln -= dt;

      const elapsed = (now - startedAt) / 1000;
      const active = true;
      for (const monster of monsters) {
        if (!monster.alive) continue;
        if (monster.kind === 'brute') stepBrute(monster, player, dt, ENEMY_HALF, world.grid, active);
        else {
          monster.speed = MAZE_KINDS[monster.kind]?.speed || madSpeed(elapsed);
          chase(monster, player, dt, ENEMY_HALF, world.grid);
        }
      }
      separateEnemies(monsters, ENEMY_HALF, world.grid);

      const touch = mazeTouch(player, monsters, armor, health, invuln);
      if (touch) {
        armor = touch.armor;
        health = touch.health;
        invuln = 1.15;
        knockX = Math.cos(touch.knockAngle) * 280;
        knockY = Math.sin(touch.knockAngle) * 280;
        if (touch.died) {
          respawn = 0.7;
          player.x = world.spawn.x;
          player.y = world.spawn.y;
          knockX = 0;
          knockY = 0;
          resetBrutes();
        }
        hud();
      }
      for (const ally of allies) {
        if (!ally.alive) continue;
        const action = stepAlly(ally, monsters, dt, world.grid);
        if (action.fire) spawnBullet(action.aim, ally);
        const allyHit = applyContact(ally, monsters, ally.hp);
        if (allyHit.popped.length) {
          ally.hp = allyHit.hp;
          for (const monster of allyHit.popped) explode(monster);
          if (allyHit.dead) ally.alive = false;
        }
      }
      const wave = advanceMazeSpawner(spawnTimer, dt, monsters, player, world.spawnPoints, spawnIndex);
      spawnTimer = wave.timer;
      spawnIndex = wave.spawnIndex;
      if (wave.spawned) {
        monsters.push(wave.spawned);
        attachMonster(wave.spawned);
      }

      for (const coin of world.coins) {
        if (!coin.alive) continue;
        coin.mesh.position.y = 0.28 + Math.sin(now / 200 + coin.x) * 0.06;
        coin.mesh.rotation.y += dt * 2;
        if (Math.hypot(player.x - coin.x, player.y - coin.y) < 22) {
          coin.alive = false;
          coin.mesh.visible = false;
          coinsGot += 1;
          hud();
        }
      }

      if (respawn <= 0 && Math.floor(player.x / TILE) === world.goal.tx && Math.floor(player.y / TILE) === world.goal.ty) {
        won = true;
        hud((performance.now() - startedAt) / 1000);
        onWin?.({
          time: (performance.now() - startedAt) / 1000,
          coins: coinsGot,
          coinsTotal: world.coins.length,
          smashed,
          enemyTotal: monsters.length,
          campaign: 2,
        });
      } else if (respawn <= 0) {
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
          const result = stepMazeBullet(bullet, dt, world.grid, world.brickHp, monsters);
          if (result === 'hit') playGrunt(false);
          if (result === 'defeat') {
            playGrunt(true);
            smashed += 1;
            hud();
          }
          if (result === 'break' || result === 'crack') {
            const tx = Math.floor(bullet.x / TILE);
            const ty = Math.floor(bullet.y / TILE);
            const mesh = brickMeshes.get(`${tx},${ty}`);
            if (mesh) {
              if (result === 'break') mesh.visible = false;
              else mesh.scale.y = world.brickHp[ty][tx] / 3;
            }
          }
          if (result === 'fly') {
            bullet.mesh.position.set(bullet.x / TILE, 0.5, bullet.y / TILE);
          } else {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
          }
        }
      }
    }

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
      monster.mesh.rotation.y = -Math.atan2(player.y - monster.y, player.x - monster.x);
    }
    syncAllies();
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
  camera.position.set(player.x / TILE, FIXED_CAMERA.height, player.y / TILE + FIXED_CAMERA.south);
  camera.lookAt(player.x / TILE, 0.3, player.y / TILE);
  hud();
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
      allyButton.remove();
      for (const item of disposables) item.dispose?.();
      renderer.dispose();
      root.replaceChildren();
    },
  };
}
