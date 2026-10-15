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

test('holding the right stick aims and fires all the way around, independent of movement', () => {
  const smooth = Math.atan2(0.35, 0.92);
  const cases = [...directions.map((dir) => ({ x: dir.x, y: dir.y, angle: dir.angle })), { x: 0.92, y: 0.35, angle: smooth }];
  for (const dir of cases) {
    const shot = resolveAim({
      touchControls: true,
      aimOn: true,
      aimX: dir.x,
      aimY: dir.y,
      lastAim: 0.4,
    });
    assert.ok(Math.abs(shot.angle - dir.angle) < 1e-9, `expected ${dir.angle}, got ${shot.angle}`);
    assert.equal(shot.fire, true);
  }
});

test('a centered hold keeps firing on the last aim, and letting go stops', () => {
  const held = resolveAim({
    touchControls: true,
    aimOn: true,
    aimX: 0.1,
    aimY: -0.1,
    lastAim: LEFT,
  });
  assert.ok(Math.abs(held.angle - LEFT) < 1e-9);
  assert.equal(held.fire, true);

  const released = resolveAim({
    touchControls: true,
    aimOn: false,
    aimX: 0,
    aimY: 1,
    lastAim: LEFT,
    pointerInside: true,
    pointerDown: true,
    pointerOnBoard: false,
    pointerAngle: DOWN,
  });
  assert.ok(Math.abs(released.angle - LEFT) < 1e-9);
  assert.equal(released.fire, false);
});

test('a mouse still aims and fires when the sticks are hidden', () => {
  const hover = resolveAim({
    touchControls: false,
    pointerInside: true,
    pointerDown: false,
    pointerOnBoard: false,
    pointerAngle: UP,
    lastAim: RIGHT,
  });
  assert.ok(Math.abs(hover.angle - UP) < 1e-9);
  assert.equal(hover.fire, false);

  const click = resolveAim({
    touchControls: false,
    pointerInside: true,
    pointerDown: true,
    pointerOnBoard: true,
    pointerAngle: DOWN,
    lastAim: RIGHT,
  });
  assert.ok(Math.abs(click.angle - DOWN) < 1e-9);
  assert.equal(click.fire, true);
});
