const held = new Set();
let joy = { x: 0, y: 0, on: false };
let aimJoy = { x: 0, y: 0, on: false };
let face = 0;

function typingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

window.addEventListener('keydown', (event) => {
  if (typingTarget(event.target)) return;
  held.add(event.key.toLowerCase());
  if (event.key.startsWith('Arrow')) event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  held.delete(event.key.toLowerCase());
});

window.addEventListener('blur', () => {
  held.clear();
  joy = { x: 0, y: 0, on: false };
  aimJoy = { x: 0, y: 0, on: false };
});

export function isDown(...names) {
  return names.some((name) => held.has(name));
}

export function setStick(x, y, on) {
  joy = { x, y, on };
  if (on && Math.hypot(x, y) > 0.22) face = Math.atan2(y, x);
}

export function stickVector() {
  return joy;
}

export function setAimStick(x, y, on) {
  aimJoy = { x, y, on };
}

export function aimVector() {
  return aimJoy;
}

export function facing() {
  return face;
}

export function setFacing(angle) {
  face = angle;
}
