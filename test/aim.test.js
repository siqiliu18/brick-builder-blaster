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

test('touch aiming is the same on foot and in the tank, including diagonals', () => {
  for (const dir of directions) {
    for (const shootHeld of [false, true]) {
      const shot = resolveAim({
        touchControls: true,
        aimOn: true,
        aimX: dir.x,
        aimY: dir.y,
        lastAim: 0.4,
        shootHeld,
      });
      assert.ok(Math.abs(shot.angle - dir.angle) < 1e-9, `expected ${dir.angle}, got ${shot.angle}`);
      assert.equal(shot.fire, shootHeld);
    }
  }
});

test('releasing the right stick keeps the last aim and the left stick does not turn it', () => {
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
