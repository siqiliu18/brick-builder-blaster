const AIM_DEAD = 0.22;

/**
 * Where the shot points, and whether this frame fires.
 * With touch controls, both levels use the right stick. Shoot fires that way.
 * Letting go of the stick keeps the last direction. The left stick never aims.
 * A mouse still aims when the sticks are hidden.
 */
export function resolveAim({
  touchControls = false,
  aimX = 0,
  aimY = 0,
  aimOn = false,
  lastAim = 0,
  pointerInside = false,
  pointerDown = false,
  pointerOnBoard = false,
  pointerAngle = 0,
  shootHeld = false,
} = {}) {
  if (touchControls) {
    const aimed = aimOn && Math.hypot(aimX, aimY) > AIM_DEAD;
    return { angle: aimed ? Math.atan2(aimY, aimX) : lastAim, fire: !!shootHeld };
  }

  const aiming = pointerInside && (!pointerDown || pointerOnBoard);
  return {
    angle: aiming ? pointerAngle : lastAim,
    fire: !!shootHeld || (pointerInside && pointerDown && pointerOnBoard),
  };
}
