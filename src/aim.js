const AIM_DEAD = 0.22;

/**
 * Where the shot points, and whether this frame fires.
 * The ridden tank follows the move stick (or the keys): any direction, including
 * diagonals, and the last direction stays when the stick is released.
 * On foot, the right stick still aims. A press on the move stick is not an aim point.
 * A mouse still aims when the sticks are hidden.
 */
export function resolveAim({
  followMovement = false,
  moving = false,
  moveAngle = 0,
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
  if (followMovement) {
    let angle = lastAim;
    if (moving) angle = moveAngle;
    else if (!touchControls && pointerInside && (!pointerDown || pointerOnBoard)) angle = pointerAngle;
    const mouseFire = !touchControls && pointerInside && pointerDown && pointerOnBoard;
    return { angle, fire: !!shootHeld || mouseFire };
  }

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
