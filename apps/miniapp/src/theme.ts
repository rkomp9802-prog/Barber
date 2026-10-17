/** Цвета темы Telegram (подмножество WebApp.themeParams, которое использует приложение). */
export type ThemeParams = {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  section_bg_color?: string
  destructive_text_color?: string
  accent_text_color?: string
}

export type ColorScheme = 'light' | 'dark'

type ThemeKey = keyof ThemeParams

/** Какой параметр темы в какую CSS-переменную попадает. */
export const THEME_CSS_VARS: Readonly<Record<ThemeKey, string>> = {
  bg_color: '--tg-bg',
  text_color: '--tg-text',
  hint_color: '--tg-hint',
  link_color: '--tg-link',
  button_color: '--tg-button',
  button_text_color: '--tg-button-text',
  secondary_bg_color: '--tg-secondary-bg',
  section_bg_color: '--tg-section-bg',
  destructive_text_color: '--tg-destructive',
  accent_text_color: '--tg-accent',
}

/** Запасные цвета для обычного браузера и старых клиентов Telegram (близко к стандартной теме). */
export const FALLBACK_THEMES: Readonly<Record<ColorScheme, Required<ThemeParams>>> = {
  light: {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#707579',
    link_color: '#2481cc',
    button_color: '#2481cc',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f1f1f4',
    section_bg_color: '#ffffff',
    destructive_text_color: '#e53935',
    accent_text_color: '#2481cc',
  },
  dark: {
    bg_color: '#17212b',
    text_color: '#f5f5f5',
    hint_color: '#708499',
    link_color: '#6ab3f3',
    button_color: '#5288c1',
    button_text_color: '#ffffff',
    secondary_bg_color: '#0e1621',
    section_bg_color: '#17212b',
    destructive_text_color: '#ec3942',
    accent_text_color: '#6ab3f3',
  },
}

/**
 * Цвета дизайна в стиле Apple (светлая — apple.com, тёмная — iOS). Остальные токены — в styles.css
 * под :root[data-scheme]. Отсюда берутся цвета, которые нужны в JS: шапка Telegram и MainButton.
 */
export const APPLE_COLORS: Readonly<Record<ColorScheme, { ground: string; accent: string; inactive: string }>> = {
  light: { ground: '#f5f5f7', accent: '#0071e3', inactive: '#aeaeb2' },
  dark: { ground: '#000000', accent: '#0a84ff', inactive: '#48484a' },
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

/**
 * Превращает themeParams в набор CSS-переменных.
 * Невалидные или отсутствующие цвета заменяются запасными для текущей схемы.
 */
export function themeToCssVars(params: ThemeParams | undefined, scheme: ColorScheme): Record<string, string> {
  const fallback = FALLBACK_THEMES[scheme]
  const keys = Object.keys(THEME_CSS_VARS) as ThemeKey[]
  const entries = keys.map(key => {
    const candidate = params?.[key]
    const value = isHexColor(candidate) ? candidate : fallback[key]
    return [THEME_CSS_VARS[key], value] as const
  })
  return Object.fromEntries([...entries, ['color-scheme', scheme]])
}

/** Записывает переменные в style корневого элемента. */
export function applyCssVars(vars: Readonly<Record<string, string>>, target: HTMLElement): void {
  Object.entries(vars).forEach(([name, value]) => {
    if (name === 'color-scheme') {
      target.style.colorScheme = value
      return
    }
    target.style.setProperty(name, value)
  })
}
