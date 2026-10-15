import { describe, expect, it } from 'vitest'
import { sslOptions } from '../../src/db/prisma'

describe('sslOptions: шифрование подключения к базе', () => {
  it('удалённая база (Supabase) — шифруем', () => {
    expect(sslOptions('postgresql://u:p@aws-0-eu.pooler.supabase.com:6543/postgres?pgbouncer=true')).toEqual({
      rejectUnauthorized: false,
    })
  })

  it('локальная база — без TLS', () => {
    expect(sslOptions('postgresql://u:p@localhost:5432/test')).toBe(false)
    expect(sslOptions('postgresql://u:p@127.0.0.1:5433/test?pgbouncer=true')).toBe(false)
    expect(sslOptions('postgresql://u:p@[::1]:5432/test')).toBe(false)
  })

  it('sslmode=disable отключает TLS явно', () => {
    expect(sslOptions('postgresql://u:p@db.example.com:5432/x?sslmode=disable')).toBe(false)
  })

  it('неразборчивая строка — шифруем на всякий случай', () => {
    expect(sslOptions('not a url')).toEqual({ rejectUnauthorized: false })
  })
})
