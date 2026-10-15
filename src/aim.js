const AIM_DEAD = 0.22;

/**
 * Where the barrel points, and whether this frame fires.
 * On the Level 2 tank with touch controls, the right stick aims and Shoot fires.
 * Letting go of the stick keeps the last direction. The left stick never aims.
 * A press that did not start on the board (the move stick) is not an aim point.
 */
export function resolveAim({
  riding = false,
  touchControls = false,
  aimX = 0,
  aimY = 0,
  aimOn = false,
  lastAim = 0,
  moveFacing = 0,
  pointerInside = false,
  pointerDown = false,
  pointerOnBoard = false,
  pointerAngle = 0,
  shootHeld = false,
} = {}) {
  if (riding && touchControls) {
    const aimed = aimOn && Math.hypot(aimX, aimY) > AIM_DEAD;
    return { angle: aimed ? Math.atan2(aimY, aimX) : lastAim, fire: !!shootHeld };
  }

  if (riding) {
    const aiming = pointerInside && (!pointerDown || pointerOnBoard);
    return {
      angle: aiming ? pointerAngle : lastAim,
      fire: !!shootHeld || (pointerInside && pointerDown && pointerOnBoard),
    };
  }

  if (pointerInside && pointerOnBoard) {
    return { angle: pointerAngle, fire: !!pointerDown || !!shootHeld };
  }

  if (!touchControls && pointerInside && !pointerDown) {
    return { angle: pointerAngle, fire: !!shootHeld };
  }

  return { angle: moveFacing, fire: !!shootHeld };
}
