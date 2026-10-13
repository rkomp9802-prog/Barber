export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

/**
 * Постоянная строка (без пользовательских данных), которую layout вставляет в <head>.
 * Читает сохранённую тему до первой отрисовки, чтобы не было вспышки светлой темы.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/** Тема, которая видна сейчас: выбранная вручную или системная. */
export function currentTheme(root: HTMLElement, prefersDark: boolean): Theme {
  const chosen = root.dataset.theme
  if (isTheme(chosen)) return chosen
  return prefersDark ? 'dark' : 'light'
}
