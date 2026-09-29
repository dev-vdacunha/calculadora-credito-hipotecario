export const THEME_STORAGE_KEY = 'calculadora-credito-hipotecario.theme.v1';

export function storedTheme(storage) {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function readTheme(storage, systemDark) {
  return storedTheme(storage) || (systemDark ? 'dark' : 'light');
}

export function saveTheme(theme, storage) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
    return Boolean(storage);
  } catch {
    return false;
  }
}
