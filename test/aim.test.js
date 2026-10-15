import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAim } from '../src/aim.js';

const RIGHT = 0;
const DOWN = Math.PI / 2;
const LEFT = Math.PI;
const UP = -Math.PI / 2;

const directions = [
  { x: 1, y: 0, angle: RIGHT },
  { x: 0, y: 1, angle: DOWN },
  { x: -1, y: 0, angle: LEFT },
  { x: 0, y: -1, angle: UP },
  { x: 1, y: 1, angle: Math.PI / 4 },
  { x: -1, y: -1, angle: (-3 * Math.PI) / 4 },
];

test('the tank barrel follows movement, including diagonals and in-between angles', () => {
  const smooth = Math.atan2(0.35, 0.92);
  const cases = [
    ...directions.map((dir) => ({ moving: true, moveAngle: dir.angle, expect: dir.angle })),
    { moving: true, moveAngle: smooth, expect: smooth },
  ];
  for (const item of cases) {
    const shot = resolveAim({
      followMovement: true,
      moving: item.moving,
      moveAngle: item.moveAngle,
      touchControls: true,
      aimOn: true,
      aimX: 0,
      aimY: -1,
      lastAim: 0.4,
      pointerDown: true,
      pointerInside: true,
      pointerOnBoard: false,
      pointerAngle: UP,
      shootHeld: true,
    });
    assert.ok(Math.abs(shot.angle - item.expect) < 1e-9, `expected ${item.expect}, got ${shot.angle}`);
    assert.equal(shot.fire, true);
  }
});

test('an idle tank keeps the last direction and ignores the right stick', () => {
  const idle = resolveAim({
    followMovement: true,
    moving: false,
    moveAngle: RIGHT,
    touchControls: true,
    aimOn: true,
    aimX: -1,
    aimY: 0,
    lastAim: DOWN,
    shootHeld: true,
  });
  assert.ok(Math.abs(idle.angle - DOWN) < 1e-9);
  assert.equal(idle.fire, true);
});

test('on-foot touch aiming still uses the right stick, including left and right', () => {
  for (const dir of directions) {
    const shot = resolveAim({
      followMovement: false,
      moving: true,
      moveAngle: UP,
      touchControls: true,
      aimOn: true,
      aimX: dir.x,
      aimY: dir.y,
      lastAim: 0.4,
      shootHeld: true,
    });
    assert.ok(Math.abs(shot.angle - dir.angle) < 1e-9, `expected ${dir.angle}, got ${shot.angle}`);
  }
});

test('releasing the right stick keeps the last on-foot aim', () => {
  const held = resolveAim({
    touchControls: true,
    aimOn: true,
    aimX: 0,
    aimY: -1,
    lastAim: RIGHT,
    shootHeld: false,
  });
  assert.ok(Math.abs(held.angle - UP) < 1e-9);

  const released = resolveAim({
    touchControls: true,
    aimOn: false,
    aimX: 0,
    aimY: 0,
    lastAim: held.angle,
    pointerInside: true,
    pointerDown: true,
    pointerOnBoard: false,
    pointerAngle: DOWN,
    shootHeld: true,
  });
  assert.ok(Math.abs(released.angle - UP) < 1e-9);
  assert.equal(released.fire, true);

  const deadzone = resolveAim({
    touchControls: true,
    aimOn: true,
    aimX: 0.1,
    aimY: 0.1,
    lastAim: UP,
    shootHeld: false,
  });
  assert.ok(Math.abs(deadzone.angle - UP) < 1e-9);
});

test('a mouse still aims when the sticks are hidden', () => {
  const hover = resolveAim({
    touchControls: false,
    pointerInside: true,
    pointerDown: false,
    pointerOnBoard: false,
    pointerAngle: LEFT,
    lastAim: RIGHT,
    shootHeld: false,
  });
  assert.ok(Math.abs(hover.angle - LEFT) < 1e-9);
  assert.equal(hover.fire, false);

  const click = resolveAim({
    touchControls: false,
    pointerInside: true,
    pointerDown: true,
    pointerOnBoard: true,
    pointerAngle: DOWN,
    lastAim: RIGHT,
    shootHeld: false,
  });
  assert.ok(Math.abs(click.angle - DOWN) < 1e-9);
  assert.equal(click.fire, true);
});
