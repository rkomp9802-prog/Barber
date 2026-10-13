import { hash, verify } from '@node-rs/argon2'

/** Проверка пароля по Argon2-хешу. Вынесена в интерфейс, чтобы тесты могли её подменить. */
export interface PasswordVerifier {
  verify(passwordHash: string, password: string): Promise<boolean>
  /**
   * Холостая проверка, когда логин не найден: время ответа не должно
   * выдавать, существует ли такой администратор.
   */
  verifyDummy(password: string): Promise<void>
}

const DUMMY_SECRET = 'barber-admin-dummy-password'

async function safeVerify(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    // Испорченный хеш в базе — просто «неверный пароль».
    return false
  }
}

export function createArgon2Verifier(): PasswordVerifier {
  let dummyHash: Promise<string> | undefined
  return {
    verify: safeVerify,
    verifyDummy: async password => {
      dummyHash ??= hash(DUMMY_SECRET)
      await safeVerify(await dummyHash, password)
    },
  }
}
