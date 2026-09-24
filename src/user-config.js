import { validateConfig } from './calculator.js';

export const STORAGE_KEY = 'calculadora-credito-hipotecario.config.v1';

function resolveStorage(storage) {
  if (storage !== undefined) return { storage, error: null };
  try {
    if (typeof globalThis.localStorage === 'undefined') return { storage: undefined, error: null };
    return { storage: globalThis.localStorage, error: null };
  } catch {
    return { storage: undefined, error: 'El almacenamiento local no está disponible en este navegador.' };
  }
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fieldValueValid(field, value) {
  if (field.type === 'rate-tiers') {
    if (!Array.isArray(value) || value.length === 0 || value[0]?.minLoanUsd !== 0) return false;
    return value.every((tier, index) => Number.isFinite(tier?.minLoanUsd) && tier.minLoanUsd >= 0 && Number.isFinite(tier?.annualRatePercent) && tier.annualRatePercent >= 0 && (index === 0 || tier.minLoanUsd > value[index - 1].minLoanUsd));
  }
  if (field.type === 'fee-tiers') {
    if (!Array.isArray(value) || value.length === 0 || value[0]?.minLoanUsd !== 0) return false;
    return value.every((tier, index) => Number.isFinite(tier?.minLoanUsd) && tier.minLoanUsd >= 0 && Number.isFinite(tier?.percent) && tier.percent >= 0 && (tier.capUsd === null || (Number.isFinite(tier.capUsd) && tier.capUsd >= 0)) && (index === 0 || tier.minLoanUsd > value[index - 1].minLoanUsd));
  }
  if (field.type === 'select') return field.options.some(option => option.value === value);
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (field.min !== undefined && value < field.min) return false;
  if (field.max !== undefined && value > field.max) return false;
  return true;
}

function allowedFields(fields) {
  return new Map(fields.map(field => [field.key, field]));
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validOverrides(defaults, fields, candidate) {
  const metadata = allowedFields(fields);
  const result = {};
  if (!plainObject(candidate)) return result;
  for (const [key, value] of Object.entries(candidate)) {
    const field = metadata.get(key);
    if (!field || !fieldValueValid(field, value)) continue;
    const merged = { ...defaults, ...result, [key]: value };
    try { validateConfig(merged); } catch { continue; }
    if (!valuesEqual(value, defaults[key])) result[key] = structuredClone(value);
  }
  return result;
}

function storageError(action) {
  return `No se pudo ${action} la configuración en este navegador; el almacenamiento local no está disponible.`;
}

export function readUserConfig(defaults, fields, storage) {
  const resolved = resolveStorage(storage);
  storage = resolved.storage;
  if (!storage) return { config: { ...defaults }, overrides: {}, storageError: resolved.error };
  let raw;
  try { raw = storage.getItem(STORAGE_KEY); } catch { return { config: { ...defaults }, overrides: {}, storageError: storageError('leer') }; }
  if (!raw) return { config: { ...defaults }, overrides: {}, storageError: null };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { config: { ...defaults }, overrides: {}, storageError: 'La configuración guardada no se pudo leer; se usan los valores predeterminados.' }; }
  const overrides = validOverrides(defaults, fields, parsed);
  return { config: { ...defaults, ...overrides }, overrides, storageError: null };
}

function writeOverrides(overrides, storage) {
  if (!storage) return 'No se pudo guardar la configuración en este navegador.';
  try {
    if (Object.keys(overrides).length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    return null;
  } catch { return storageError('guardar'); }
}

export function updateUserConfig(defaults, fields, currentOverrides, key, value, storage) {
  const resolved = resolveStorage(storage);
  storage = resolved.storage;
  const field = allowedFields(fields).get(key);
  if (!field || !fieldValueValid(field, value)) throw new Error('El valor de configuración no es válido.');
  const next = { ...currentOverrides };
  if (valuesEqual(value, defaults[key])) delete next[key];
  else next[key] = structuredClone(value);
  const effective = { ...defaults, ...validOverrides(defaults, fields, next) };
  validateConfig(effective);
  return { config: effective, overrides: next, storageError: resolved.error || writeOverrides(next, storage) };
}

export function resetUserConfig(storage) {
  const resolved = resolveStorage(storage);
  storage = resolved.storage;
  if (!storage) return resolved.error;
  try { storage.removeItem(STORAGE_KEY); return null; } catch { return storageError('restablecer'); }
}
