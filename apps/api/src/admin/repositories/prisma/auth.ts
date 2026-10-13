import type { Db } from '../../../db/prisma'
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
}
