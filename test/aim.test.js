import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAim } from '../src/aim.js';

const RIGHT = 0;
const DOWN = Math.PI / 2;
const LEFT = Math.PI;
const UP = -Math.PI / 2;

test('the Level 2 right stick aims all the way around, including diagonals', () => {
  const directions = [
    { x: 1, y: 0, angle: RIGHT },
    { x: 0, y: 1, angle: DOWN },
    { x: -1, y: 0, angle: LEFT },
    { x: 0, y: -1, angle: UP },
    { x: 1, y: 1, angle: Math.PI / 4 },
    { x: -1, y: -1, angle: (-3 * Math.PI) / 4 },
  ];
  for (const dir of directions) {
    const shot = resolveAim({
      riding: true,
      touchControls: true,
      aimOn: true,
      aimX: dir.x,
      aimY: dir.y,
      lastAim: 0.4,
      moveFacing: UP,
      shootHeld: true,
    });
    assert.ok(Math.abs(shot.angle - dir.angle) < 1e-9, `expected ${dir.angle}, got ${shot.angle}`);
    assert.equal(shot.fire, true);
  }
});

test('releasing the right stick keeps the last aim and the left stick does not turn the barrel', () => {
  const held = resolveAim({
    riding: true,
    touchControls: true,
    aimOn: true,
    aimX: 0,
    aimY: -1,
    lastAim: RIGHT,
    moveFacing: DOWN,
    shootHeld: false,
  });
  assert.ok(Math.abs(held.angle - UP) < 1e-9);

  const released = resolveAim({
    riding: true,
    touchControls: true,
    aimOn: false,
    aimX: 0,
    aimY: 0,
    lastAim: held.angle,
    moveFacing: DOWN,
    shootHeld: true,
  });
  assert.ok(Math.abs(released.angle - UP) < 1e-9);
  assert.equal(released.fire, true);

  const deadzone = resolveAim({
    riding: true,
    touchControls: true,
    aimOn: true,
    aimX: 0.1,
    aimY: 0.1,
    lastAim: UP,
    moveFacing: LEFT,
    shootHeld: false,
  });
  assert.ok(Math.abs(deadzone.angle - UP) < 1e-9);
});

test('Level 1 ignores a stick press and still aims from a board tap or movement', () => {
  const stickSteal = resolveAim({
    riding: false,
    touchControls: true,
    pointerInside: true,
    pointerDown: true,
    pointerOnBoard: false,
    pointerAngle: UP,
    moveFacing: RIGHT,
    shootHeld: true,
  });
  assert.ok(Math.abs(stickSteal.angle - RIGHT) < 1e-9);
  assert.equal(stickSteal.fire, true);

  const board = resolveAim({
    riding: false,
    touchControls: true,
    pointerInside: true,
    pointerDown: true,
    pointerOnBoard: true,
    pointerAngle: DOWN,
    moveFacing: RIGHT,
    shootHeld: false,
  });
  assert.ok(Math.abs(board.angle - DOWN) < 1e-9);
  assert.equal(board.fire, true);

  const hover = resolveAim({
    riding: false,
    touchControls: false,
    pointerInside: true,
    pointerDown: false,
    pointerOnBoard: false,
    pointerAngle: LEFT,
    moveFacing: RIGHT,
    shootHeld: false,
  });
  assert.ok(Math.abs(hover.angle - LEFT) < 1e-9);
  assert.equal(hover.fire, false);
});
