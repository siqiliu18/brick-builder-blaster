import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NAME_LIMIT,
  nameTagOffset,
  normalizeName,
  readPlayerName,
  writePlayerName,
} from '../src/name.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    data,
  };
}

test('a name is trimmed and limited to 12 characters', () => {
  assert.equal(normalizeName('  Jasper  '), 'Jasper');
  assert.equal(normalizeName('   '), '');
  assert.equal(normalizeName(null), '');
  assert.equal(normalizeName('Brick Builder'), 'Brick Builde');
  assert.equal(normalizeName('  ABCDEFGHIJKLMNOP  ').length <= NAME_LIMIT, true);
  assert.equal(normalizeName('  ABCDEFGHIJKLMNOP  '), 'ABCDEFGHIJKL');
});

test('the name is saved in storage and a blank name is cleared', () => {
  const storage = memoryStorage();
  assert.equal(writePlayerName(storage, '  JASPER  '), 'JASPER');
  assert.equal(readPlayerName(storage), 'JASPER');
  assert.equal(writePlayerName(storage, '   '), '');
  assert.equal(readPlayerName(storage), '');
  assert.equal(storage.getItem('bbb-player-name'), null);
});

test('the name tag sits above the hero and higher on the tank', () => {
  const onFoot = nameTagOffset(false);
  const tank = nameTagOffset(true);
  assert.ok(onFoot < 0);
  assert.ok(tank < onFoot);
});
