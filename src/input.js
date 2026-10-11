const held = new Set();

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

window.addEventListener('blur', () => held.clear());

export function isDown(...names) {
  return names.some((name) => held.has(name));
}
