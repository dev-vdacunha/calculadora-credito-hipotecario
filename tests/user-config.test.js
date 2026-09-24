import test from 'node:test';
import assert from 'node:assert/strict';
import { config, configFields } from '../src/config.js';
import { STORAGE_KEY, readUserConfig, updateUserConfig, resetUserConfig } from '../src/user-config.js';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('sin overrides usa defaults y guarda solo la diferencia', () => {
  const storage = new MemoryStorage();
  const initial = readUserConfig(config, configFields, storage);
  assert.deepEqual(initial.config, config);
  const updated = updateUserConfig(config, configFields, initial.overrides, 'savingsUsd', 42000, storage);
  assert.equal(updated.config.savingsUsd, 42000);
  assert.deepEqual(updated.overrides, { savingsUsd: 42000 });
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), { savingsUsd: 42000 });
  assert.equal(readUserConfig(config, configFields, storage).config.savingsUsd, 42000);
});

test('volver al default elimina el override y resetear no borra otras claves', () => {
  const storage = new MemoryStorage({ other: 'keep' });
  const updated = updateUserConfig(config, configFields, {}, 'teaPercent', 4.1, storage);
  const restored = updateUserConfig(config, configFields, updated.overrides, 'teaPercent', config.teaPercent, storage);
  assert.deepEqual(restored.overrides, {});
  assert.equal(storage.getItem(STORAGE_KEY), null);
  storage.setItem(STORAGE_KEY, JSON.stringify({ savingsUsd: 42000 }));
  resetUserConfig(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem('other'), 'keep');
});

test('datos corruptos, obsoletos o inválidos vuelven a defaults sin romper la app', () => {
  const cases = ['not-json', JSON.stringify(null), JSON.stringify([]), JSON.stringify({ maxLoanUsd: 100000 }), JSON.stringify({ teaPercent: -1, savingsUsd: 42000 }), JSON.stringify({ bankCostsPayment: 'unknown', savingsUsd: 42000 })];
  for (const raw of cases) {
    const result = readUserConfig(config, configFields, new MemoryStorage({ [STORAGE_KEY]: raw }));
    assert.equal(result.config.savingsUsd, raw.includes('42000') ? 42000 : config.savingsUsd);
    assert.equal('maxLoanUsd' in result.config, false);
    assert.equal('financingLimitBasis' in result.config, false);
  }
});

test('storage bloqueado deja trabajar en memoria y comunica el error', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const initial = readUserConfig(config, configFields, storage);
  assert.match(initial.storageError, /disponible|bloqueado/i);
  const updated = updateUserConfig(config, configFields, {}, 'savingsUsd', 42000, storage);
  assert.equal(updated.config.savingsUsd, 42000);
  assert.match(updated.storageError, /guardar|bloqueado/i);
});

test('acceso a localStorage bloqueado desde el navegador informa que no está disponible', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
  try {
    const result = readUserConfig(config, configFields);
    assert.match(result.storageError, /disponible/i);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('no se permite persistir valores desconocidos o inválidos', () => {
  const storage = new MemoryStorage();
  assert.throws(() => updateUserConfig(config, configFields, {}, 'maxLoanUsd', 100000, storage));
  assert.throws(() => updateUserConfig(config, configFields, {}, 'teaPercent', -1, storage));
  assert.throws(() => updateUserConfig(config, configFields, {}, 'bankCostsPayment', 'unknown', storage));
});
