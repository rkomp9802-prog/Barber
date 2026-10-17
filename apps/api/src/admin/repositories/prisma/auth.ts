import type { Db } from '../../../db/prisma'
import type { LoginAttempt } from '../../auth/login-throttle'
import type { AdminAuthRepository, AdminSessionRecord, AdminUserRecord, NewAdminSession } from '../types'

/** Администраторы и сессии (admin_users, admin_sessions). В базе — только SHA-256 токена сессии. */
export class PrismaAdminAuthRepository implements AdminAuthRepository {
  constructor(private readonly db: Db) {}

  async findUserByLogin(login: string): Promise<AdminUserRecord | null> {
    const row = await this.db.adminUser.findUnique({
      where: { login },
      select: { id: true, login: true, passwordHash: true },
    })
    return row ? { id: row.id, login: row.login, passwordHash: row.passwordHash } : null
  }

  async createSession(input: NewAdminSession): Promise<void> {
    await this.db.adminSession.create({
      data: { adminUserId: input.adminUserId, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    })
  }

  async findActiveSession(tokenHash: string, now: Date): Promise<AdminSessionRecord | null> {
    const row = await this.db.adminSession.findFirst({
      where: { tokenHash, expiresAt: { gt: now } },
      select: { adminUserId: true, expiresAt: true, adminUser: { select: { login: true } } },
    })
    if (!row) return null
    return { adminUserId: row.adminUserId, login: row.adminUser.login, expiresAt: row.expiresAt }
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.adminSession.deleteMany({ where: { tokenHash } })
  }

  async deleteExpiredSessions(adminUserId: string, now: Date): Promise<void> {
    await this.db.adminSession.deleteMany({ where: { adminUserId, expiresAt: { lte: now } } })
  }

  async getLoginAttempt(login: string): Promise<LoginAttempt | null> {
    return this.db.adminLoginAttempt.findUnique({
      where: { login },
      select: { failures: true, lastFailureAt: true },
    })
  }

  /** Один INSERT … ON CONFLICT: параллельные неудачные входы не теряют инкремент. */
  async recordLoginFailure(login: string, now: Date, staleBefore: Date): Promise<void> {
    await this.db.$executeRaw`
      INSERT INTO admin_login_attempts (login, failures, last_failure_at)
      VALUES (${login}, 1, ${now})
      ON CONFLICT (login) DO UPDATE
        SET failures = admin_login_attempts.failures + 1, last_failure_at = EXCLUDED.last_failure_at`
    await this.db.adminLoginAttempt.deleteMany({ where: { lastFailureAt: { lt: staleBefore } } })
  }

  async clearLoginAttempts(login: string): Promise<void> {
    await this.db.adminLoginAttempt.deleteMany({ where: { login } })
  }
}
