import test from 'node:test';
import assert from 'node:assert/strict';
import { readTheme, saveTheme, THEME_STORAGE_KEY } from '../src/theme.js';

test('uses the system preference when no explicit choice exists', () => {
  const storage = { getItem: () => null };
  assert.equal(readTheme(storage, false), 'light');
  assert.equal(readTheme(storage, true), 'dark');
});

test('uses a saved explicit choice over the system preference', () => {
  const storage = { getItem: key => key === THEME_STORAGE_KEY ? 'light' : null };
  assert.equal(readTheme(storage, true), 'light');
});

test('ignores invalid values and unavailable storage', () => {
  assert.equal(readTheme({ getItem: () => 'sepia' }, true), 'dark');
  assert.equal(readTheme({ getItem: () => { throw new Error('blocked'); } }, false), 'light');
});

test('saves a choice without failing when storage is unavailable', () => {
  let saved;
  assert.equal(saveTheme('dark', { setItem: (key, value) => { saved = [key, value]; } }), true);
  assert.deepEqual(saved, [THEME_STORAGE_KEY, 'dark']);
  assert.equal(saveTheme('light', { setItem: () => { throw new Error('blocked'); } }), false);
});
