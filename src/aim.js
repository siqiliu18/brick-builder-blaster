const AIM_DEAD = 0.22;

/**
 * Where the shot points, and whether this frame fires.
 * On a touch screen the right stick aims all the way around and fires while it is held.
 * Letting go stops the shots and leaves the last direction. The move stick never aims.
 * A mouse still aims and fires when the sticks are hidden.
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
} = {}) {
  if (touchControls) {
    const aimed = aimOn && Math.hypot(aimX, aimY) > AIM_DEAD;
    return { angle: aimed ? Math.atan2(aimY, aimX) : lastAim, fire: !!aimOn };
  }

  const aiming = pointerInside && (!pointerDown || pointerOnBoard);
  return {
    angle: aiming ? pointerAngle : lastAim,
    fire: pointerInside && pointerDown && pointerOnBoard,
  };
}
