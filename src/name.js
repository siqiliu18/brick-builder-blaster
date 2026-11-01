/** Player name shown above the hero. Stored in this browser only. */

export const NAME_LIMIT = 12;
const KEY = 'bbb-player-name';

/** Trim ends, drop a blank name, and keep at most NAME_LIMIT characters. */
export function normalizeName(value) {
  return String(value ?? '').trim().slice(0, NAME_LIMIT).trim();
}

/**
 * Local y of the name tag on the hero. Negative is above the sprite center.
 * The tank is taller, so its tag sits higher and still follows the hull.
 */
export function nameTagOffset(riding) {
  return riding ? -48 : -34;
}

export function readPlayerName(storage) {
  if (!storage) return '';
  try {
    return normalizeName(storage.getItem(KEY));
  } catch {
    return '';
  }
}

export function writePlayerName(storage, value) {
  const name = normalizeName(value);
  if (!storage) return name;
  try {
    if (!name) storage.removeItem(KEY);
    else storage.setItem(KEY, name);
  } catch {
    /* private mode */
  }
  return name;
}

function browserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getPlayerName() {
  return readPlayerName(browserStorage());
}

export function setPlayerName(value) {
  return writePlayerName(browserStorage(), value);
}
