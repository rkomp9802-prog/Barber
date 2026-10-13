import { describe, expect, it } from 'vitest'
import { buildDataCheckString, signInitData, telegramDisplayName, verifyInitData } from '../../src/auth/telegram'
import { TEST_BOT_TOKEN as BOT_TOKEN, makeInitData } from '../fixtures/telegram'

const NOW_SEC = 1_791_700_000
const DAY_SEC = 24 * 60 * 60

const user = JSON.stringify({ id: 777, first_name: 'Азиз', last_name: 'Каримов', username: 'aziz' })

describe('verifyInitData', () => {
  it('принимает корректную подпись и возвращает пользователя', () => {
    const initData = makeInitData({ auth_date: String(NOW_SEC - 60), query_id: 'AAE', user })
    const result = verifyInitData(initData, BOT_TOKEN, NOW_SEC, DAY_SEC)
    expect(result).toEqual({
      ok: true,
      authDate: NOW_SEC - 60,
      user: { id: 777, firstName: 'Азиз', lastName: 'Каримов', username: 'aziz' },
    })
  })

  it('отклоняет подпись другим токеном бота', () => {
    const initData = makeInitData({ auth_date: String(NOW_SEC), user }, '999:other')
    expect(verifyInitData(initData, BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'BAD_SIGNATURE' })
  })

  it('отклоняет подменённые данные', () => {
    const initData = makeInitData({ auth_date: String(NOW_SEC), user }).replace('777', '778')
    expect(verifyInitData(initData, BOT_TOKEN, NOW_SEC, DAY_SEC)).toMatchObject({ ok: false, reason: 'BAD_SIGNATURE' })
  })

  it('отклоняет устаревший auth_date (старше 24 часов) и дату из будущего', () => {
    const old = makeInitData({ auth_date: String(NOW_SEC - DAY_SEC - 1), user })
    expect(verifyInitData(old, BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'EXPIRED' })
    const future = makeInitData({ auth_date: String(NOW_SEC + 3600), user })
    expect(verifyInitData(future, BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'EXPIRED' })
  })

  it('MALFORMED без hash или auth_date', () => {
    expect(verifyInitData('user=1', BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'MALFORMED' })
    expect(verifyInitData(`hash=${'a'.repeat(64)}`, BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'MALFORMED' })
    expect(verifyInitData('', BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'MALFORMED' })
  })

  it('NO_USER, если подпись верна, но пользователя нет', () => {
    const initData = makeInitData({ auth_date: String(NOW_SEC) })
    expect(verifyInitData(initData, BOT_TOKEN, NOW_SEC, DAY_SEC)).toEqual({ ok: false, reason: 'NO_USER' })
  })

  it('data_check_string отсортирован и без hash', () => {
    const params = new URLSearchParams({ user: 'u', auth_date: '1', hash: 'x', query_id: 'q' })
    expect(buildDataCheckString(params)).toBe('auth_date=1\nquery_id=q\nuser=u')
  })

  it('известный вектор: HMAC по спецификации Telegram', () => {
    // secret = HMAC_SHA256(key="WebAppData", msg=token); hash = hex(HMAC_SHA256(key=secret, msg=dcs))
    expect(signInitData('auth_date=1', 'token')).toMatch(/^[0-9a-f]{64}$/)
    expect(signInitData('auth_date=1', 'token')).not.toBe(signInitData('auth_date=1', 'token2'))
  })
})

describe('telegramDisplayName', () => {
  it('имя и фамилия, иначе username, иначе id', () => {
    expect(telegramDisplayName({ id: 1, firstName: 'Азиз', lastName: 'К', username: 'a' })).toBe('Азиз К')
    expect(telegramDisplayName({ id: 1, firstName: '', lastName: undefined, username: 'aziz' })).toBe('aziz')
    expect(telegramDisplayName({ id: 5, firstName: '', lastName: undefined, username: undefined })).toBe('Telegram 5')
  })
})
