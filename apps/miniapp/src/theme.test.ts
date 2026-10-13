import { describe, expect, it } from 'vitest'

import { FALLBACK_THEMES, isHexColor, THEME_CSS_VARS, themeToCssVars } from './theme'

describe('themeToCssVars', () => {
  it('maps Telegram theme params to CSS variables', () => {
    const vars = themeToCssVars(
      {
        bg_color: '#212121',
        text_color: '#ffffff',
        hint_color: '#aaaaaa',
        button_color: '#8774e1',
        button_text_color: '#fff',
        secondary_bg_color: '#181818',
      },
      'dark',
    )
    expect(vars['--tg-bg']).toBe('#212121')
    expect(vars['--tg-text']).toBe('#ffffff')
    expect(vars['--tg-hint']).toBe('#aaaaaa')
    expect(vars['--tg-button']).toBe('#8774e1')
    expect(vars['--tg-button-text']).toBe('#fff')
    expect(vars['--tg-secondary-bg']).toBe('#181818')
    expect(vars['color-scheme']).toBe('dark')
  })

  it('fills missing params from the fallback of the current scheme', () => {
    const vars = themeToCssVars({ bg_color: '#000000' }, 'dark')
    expect(vars['--tg-link']).toBe(FALLBACK_THEMES.dark.link_color)
    expect(vars['--tg-section-bg']).toBe(FALLBACK_THEMES.dark.section_bg_color)
  })

  it('uses the light fallback in a regular browser', () => {
    const vars = themeToCssVars(undefined, 'light')
    expect(vars['--tg-bg']).toBe(FALLBACK_THEMES.light.bg_color)
    expect(Object.keys(vars)).toHaveLength(Object.keys(THEME_CSS_VARS).length + 1)
  })

  it('ignores values that are not hex colors', () => {
    const vars = themeToCssVars({ bg_color: 'red; background: url(x)', text_color: '#12345' }, 'light')
    expect(vars['--tg-bg']).toBe(FALLBACK_THEMES.light.bg_color)
    expect(vars['--tg-text']).toBe(FALLBACK_THEMES.light.text_color)
  })
})

describe('isHexColor', () => {
  it('accepts 3, 6 and 8 digit hex colors only', () => {
    expect(isHexColor('#abc')).toBe(true)
    expect(isHexColor('#A1B2C3')).toBe(true)
    expect(isHexColor('#a1b2c3d4')).toBe(true)
    expect(isHexColor('abc')).toBe(false)
    expect(isHexColor(42)).toBe(false)
  })
})
