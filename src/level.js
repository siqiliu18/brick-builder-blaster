export const COLS = 20;
export const ROWS = 15;
export const TILE = 40;
export const VIEW_W = COLS * TILE;
export const VIEW_H = ROWS * TILE;

const TILE_CHARS = '.BWECFS';
const KEY = 'brick-builder-blaster-v1';

const listeners = new Set();
let rows = blankRows();
let source = 'new';
let savedFallback = false;

export function blankRows() {
  return Array.from({ length: ROWS }, () => '.'.repeat(COLS));
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

function setChar(row, x, ch) {
  return row.slice(0, x) + ch + row.slice(x + 1);
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
  const counts = { B: 0, W: 0, E: 0, C: 0, S: 0, F: 0 };
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
    localStorage.setItem(KEY, JSON.stringify({ v: 1, rows }));
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
    return data.rows;
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
  persist();
  notify(null);
}

export function replaceLevel(next) {
  rows = next.map((row) => row);
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

export async function encodeLevel(rowsIn) {
  const json = JSON.stringify({ v: 1, rows: rowsIn });
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
    return data.rows;
  } catch {
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
    return { toast: 'That share link did not work. Starting a new level.' };
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
    rows = saved;
    savedFallback = source === 'bad-link';
    if (source !== 'bad-link') source = 'saved';
    return;
  }
  rows = blankRows();
}

export function shareUrl(code) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('level', code);
  return url.toString();
}
