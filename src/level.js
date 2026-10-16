export const COLS = 20;
export const ROWS = 15;
export const TILE = 40;
export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE;

const TILE_CHARS = '.BWECFSMT';
const KEY = 'brick-builder-blaster-v1';

const listeners = new Set();
let rows = blankRows();
let source = 'new';
let savedFallback = false;
/** 2 once Level 2 is loaded, until a different level replaces it. Edits do not clear it. */
let loadedCampaign = 0;
let decodedCampaign = 0;

export function blankRows() {
  return Array.from({ length: ROWS }, () => '.'.repeat(COLS));
}

function setChar(row, x, ch) {
  return row.slice(0, x) + ch + row.slice(x + 1);
}

/** Jasper's first layout. Editable like any other level once it is loaded. */
export function jaspersLevel() {
  const rows = blankRows();
  const set = (x, y, ch) => {
    rows[y] = setChar(rows[y], x, ch);
  };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) set(x, y, 'W');
    }
  }
  for (let y = 2; y <= 9; y++) if (y !== 5 && y !== 6) set(8, y, 'B');
  for (let x = 2; x <= 15; x++) if (x !== 11 && x !== 12) set(x, 10, 'B');
  set(14, 4, 'B');
  set(15, 4, 'B');
  set(16, 4, 'B');
  set(2, 2, 'S');
  set(17, 12, 'F');
  for (const [x, y] of [
    [5, 2],
    [3, 8],
    [12, 4],
    [11, 8],
    [15, 12],
  ]) set(x, y, 'C');
  set(12, 8, 'E');
  return rows;
}

/**
 * Level 2, the Brick Maze. Blue walls form the route, a red gate has to be
 * shot open, and M tiles are purple brutes. The hero rides the tank.
 */
export function level2() {
  return [
    'WWWWWWWWWWWWWWWWWWWW',
    'W....WWWWWWWWWWWWWWW',
    'W.SC..CWWWWWWWWWWWWW',
    'W....WWWWWWWWWWWWWWW',
    'WBBWWWWWWWWWWWWWWWWW',
    'W..WWWWWWWWWWWWWWWWW',
    'W.CWWWW.......MWWWWW',
    'W..WWWW...C....WWWWW',
    'W..WWWW.MWWWW..WWWWW',
    'W..WWWW..WWWWC.BCWWW',
    'W..WWWW.CWWWW..WWWWW',
    'W........WWWW......W',
    'W....C...WWWW..C..FW',
    'WWWWWWWWWWWWWWW.M..W',
    'WWWWWWWWWWWWWWWWWWWW',
  ];
}

export function sameRows(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function campaignFor(rowsIn) {
  if (sameRows(rowsIn, jaspersLevel())) return 1;
  if (sameRows(rowsIn, level2())) return 2;
  return 0;
}

/**
 * Which campaign play mode should use.
 * An exact Jasper layout is still Level 1, and any other board is custom,
 * unless Level 2 itself was loaded — that stays Level 2 after tiles change.
 */
export function activeCampaign(rowsIn = rows) {
  if (loadedCampaign === 2) return 2;
  return campaignFor(rowsIn);
}

function adoptCampaign(rowsIn, stored) {
  loadedCampaign = stored === 2 ? 2 : campaignFor(rowsIn);
}

export function validateRows(value) {
  if (!Array.isArray(value) || value.length !== ROWS) return false;
  for (const row of value) {
    if (typeof row !== 'string' || row.length !== COLS) return false;
    for (const ch of row) {
      if (!TILE_CHARS.includes(ch)) return false;
    }
  }
  return true;
}

export function placeOn(rowsIn, tx, ty, ch) {
  if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return { rows: rowsIn, dirty: [] };
  if (!TILE_CHARS.includes(ch) || ch === '.') return { rows: rowsIn, dirty: [] };
  const next = rowsIn.slice();
  const dirty = [];
  if (ch === 'S' || ch === 'F') {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (next[y][x] === ch && (x !== tx || y !== ty)) {
          next[y] = setChar(next[y], x, '.');
          dirty.push({ x, y });
        }
      }
    }
  }
  if (next[ty][tx] !== ch) {
    next[ty] = setChar(next[ty], tx, ch);
    dirty.push({ x: tx, y: ty });
  }
  return { rows: next, dirty };
}

export function eraseOn(rowsIn, tx, ty) {
  if (ty < 0 || tx < 0 || ty >= ROWS || tx >= COLS) return { rows: rowsIn, dirty: [] };
  if (rowsIn[ty][tx] === '.') return { rows: rowsIn, dirty: [] };
  const next = rowsIn.slice();
  next[ty] = setChar(next[ty], tx, '.');
  return { rows: next, dirty: [{ x: tx, y: ty }] };
}

export function findCells(rowsIn, ch) {
  const out = [];
  for (let y = 0; y < rowsIn.length; y++) {
    for (let x = 0; x < rowsIn[y].length; x++) {
      if (rowsIn[y][x] === ch) out.push({ x, y });
    }
  }
  return out;
}

export function summarize(rowsIn) {
  const counts = { B: 0, W: 0, E: 0, C: 0, S: 0, F: 0, M: 0, T: 0 };
  for (const row of rowsIn) {
    for (const ch of row) {
      if (counts[ch] != null) counts[ch] += 1;
    }
  }
  return counts;
}

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function getRows() {
  return rows.slice();
}

export function getSource() {
  return source;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(dirty) {
  for (const fn of listeners) fn(dirty);
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload = { v: 1, rows };
    if (loadedCampaign === 2) payload.campaign = 2;
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode or a full disk should not break building.
  }
}

export function saveNow() {
  persist();
}

function readSaved() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.v !== 1 || !validateRows(data.rows)) return null;
    return { rows: data.rows, campaign: data.campaign === 2 ? 2 : 0 };
  } catch {
    return null;
  }
}

export function place(tx, ty, ch) {
  const result = placeOn(rows, tx, ty, ch);
  if (result.dirty.length === 0) return;
  rows = result.rows;
  persist();
  notify(result.dirty);
}

export function erase(tx, ty) {
  const result = eraseOn(rows, tx, ty);
  if (result.dirty.length === 0) return;
  rows = result.rows;
  persist();
  notify(result.dirty);
}

export function clearLevel() {
  rows = blankRows();
  loadedCampaign = 0;
  persist();
  notify(null);
}

export function replaceLevel(next) {
  rows = next.map((row) => row);
  adoptCampaign(rows, campaignFor(rows));
  persist();
  notify(null);
}

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlToBytes(text) {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodeLevel(rowsIn, campaignId = campaignFor(rowsIn)) {
  const payload = { v: 1, rows: rowsIn };
  if (campaignId === 2) payload.campaign = 2;
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    return `z${bytesToB64url(buf)}`;
  } catch {
    return `r${bytesToB64url(bytes)}`;
  }
}

export async function decodeLevel(code) {
  decodedCampaign = 0;
  if (typeof code !== 'string' || code.length < 2 || code.length > 8000) return null;
  try {
    const kind = code[0];
    const bytes = b64urlToBytes(code.slice(1));
    let json;
    if (kind === 'z') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      json = await new Response(stream).text();
    } else if (kind === 'r') {
      json = new TextDecoder().decode(bytes);
    } else {
      return null;
    }
    const data = JSON.parse(json);
    if (data?.v !== 1 || !validateRows(data.rows)) return null;
    decodedCampaign = data.campaign === 2 ? 2 : 0;
    return data.rows;
  } catch {
    decodedCampaign = 0;
    return null;
  }
}

export function loadMessage() {
  if (source === 'link') {
    return {
      banner: 'Shared level loaded',
      toast: 'Shared level loaded. Play test it, or keep building.',
    };
  }
  if (source === 'bad-link' && savedFallback) {
    return { toast: 'That share link did not work. Your saved level was opened instead.' };
  }
  if (source === 'bad-link') {
    return { toast: "That share link did not work. Jasper's Level 1 was opened instead." };
  }
  if (source === 'jasper') {
    return { toast: "Jasper's Level 1 is ready. Change it if you want, then play test." };
  }
  return {};
}

export async function initLevel() {
  source = 'new';
  savedFallback = false;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('level');
  if (code) {
    const decoded = await decodeLevel(code);
    if (decoded) {
      rows = decoded;
      adoptCampaign(rows, decodedCampaign);
      source = 'link';
      persist();
      const url = new URL(window.location.href);
      url.searchParams.delete('level');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      return;
    }
    source = 'bad-link';
  }
  const saved = readSaved();
  if (saved) {
    rows = saved.rows;
    adoptCampaign(rows, saved.campaign);
    savedFallback = source === 'bad-link';
    if (source !== 'bad-link') source = 'saved';
    return;
  }
  rows = jaspersLevel();
  adoptCampaign(rows, 0);
  if (source !== 'bad-link') source = 'jasper';
  persist();
}

export function shareUrl(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('level', code);
  return url.toString();
}
