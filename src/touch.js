import { setAimStick, setFireHeld, setStick } from './input.js';

function bindStick(base, knob, apply) {
  let activeId = null;

  function place(event) {
    const rect = base.getBoundingClientRect();
    const max = rect.width * 0.36;
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(max, dist);
    dx = (dx / dist) * clamped;
    dy = (dy / dist) * clamped;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / max;
    const ny = dy / max;
    if (Math.hypot(nx, ny) < 0.22) apply(0, 0, true);
    else apply(nx, ny, true);
  }

  function end(event) {
    if (activeId == null || event.pointerId !== activeId) return;
    activeId = null;
    knob.style.transform = 'translate(-50%, -50%)';
    apply(0, 0, false);
  }

  base.addEventListener('pointerdown', (event) => {
    if (activeId != null) return;
    activeId = event.pointerId;
    base.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    place(event);
  });
  base.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activeId) return;
    event.preventDefault();
    place(event);
  });
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
}

function bindShoot(button) {
  let activeId = null;

  function down(event) {
    if (activeId != null) return;
    activeId = event.pointerId;
    button.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    setFireHeld(true);
  }

  function up(event) {
    if (activeId == null || event.pointerId !== activeId) return;
    activeId = null;
    setFireHeld(false);
  }

  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
}

function lockPageGestures() {
  const block = (event) => event.preventDefault();
  document.addEventListener('gesturestart', block);
  document.addEventListener('gesturechange', block);
  document.addEventListener('gestureend', block);
  document.addEventListener(
    'touchmove',
    (event) => {
      const scrolling = event.target.closest('.tool-scroll, .play-help, input, textarea');
      if (scrolling) return;
      event.preventDefault();
    },
    { passive: false },
  );
}

export function installTouch() {
  const coarse = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (coarse) document.body.classList.add('touch-ui');
  lockPageGestures();
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  const aim = document.getElementById('stick-aim');
  const aimKnob = document.getElementById('stick-aim-knob');
  const shoot = document.getElementById('btn-shoot');
  if (stick && knob) bindStick(stick, knob, setStick);
  if (aim && aimKnob) bindStick(aim, aimKnob, setAimStick);
  if (shoot) bindShoot(shoot);
}
