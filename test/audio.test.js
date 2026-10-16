import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STEP_INTERVAL,
  advanceLocomotion,
  gruntSpec,
  initialLocomotion,
  shotPitch,
} from '../src/audio.js';

test('blaster pitch only wobbles a little, so held fire stays pleasant', () => {
  for (let i = 0; i < 200; i++) {
    const pitch = shotPitch(() => i / 199);
    assert.ok(pitch >= 0.94 && pitch <= 1.06, `pitch ${pitch} left the narrow band`);
  }
  assert.equal(shotPitch(() => 0), 0.94);
  assert.ok(Math.abs(shotPitch(() => 1) - 1.06) < 1e-9);
  assert.notEqual(shotPitch(() => 0), shotPitch(() => 1));
});

test('a defeat grunt is lower, longer, and louder than a hit grunt', () => {
  const hit = gruntSpec(false);
  const down = gruntSpec(true);
  assert.ok(down.pitch < hit.pitch);
  assert.ok(down.dur > hit.dur);
  assert.ok(down.gain > hit.gain);
  assert.equal(hit.defeated, false);
  assert.equal(down.defeated, true);
});

test('footsteps repeat only while running, and the tank rumbles instead', () => {
  let state = initialLocomotion();
  let stepped = advanceLocomotion(state, 0.016, true, false);
  assert.deepEqual(stepped.events, ['step']);
  state = stepped.state;

  stepped = advanceLocomotion(state, STEP_INTERVAL - 0.02, true, false);
  assert.deepEqual(stepped.events, []);
  state = stepped.state;

  stepped = advanceLocomotion(state, 0.03, true, false);
  assert.deepEqual(stepped.events, ['step']);
  state = stepped.state;

  const still = advanceLocomotion(state, 0.5, false, false);
  assert.deepEqual(still.events, []);

  const tank = advanceLocomotion(initialLocomotion(), 0.2, true, true);
  assert.deepEqual(tank.events, ['tread-on']);
  assert.equal(tank.events.includes('step'), false);
  const held = advanceLocomotion(tank.state, 1, true, true);
  assert.deepEqual(held.events, []);
  const stop = advanceLocomotion(held.state, 0.1, false, true);
  assert.deepEqual(stop.events, ['tread-off']);
  assert.deepEqual(advanceLocomotion(stop.state, 0.1, false, true).events, []);
});

test('a long frame does not dump a burst of footsteps', () => {
  const jumped = advanceLocomotion(initialLocomotion(), 5, true, false);
  assert.deepEqual(jumped.events, ['step']);
  assert.equal(jumped.state.wait, STEP_INTERVAL);
});
