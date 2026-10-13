// Сборка API в самодостаточные бандлы (esbuild):
//  - dist/server.mjs — локальный/обычный Node-сервер (npm start);
//  - .vercel/output/** — Vercel Build Output API v3: одна Node-функция на все маршруты.
// Бандл нужен, потому что @barber/shared поставляется как исходники TypeScript.
import { build } from 'esbuild'
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const NODE_RUNTIME = 'nodejs22.x'

/** ESM-бандл без внешних зависимостей; require() для CJS-пакетов внутри ESM. */
const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  // pg-native API не использует. @node-rs/argon2 — нативный модуль (вход в админку),
  // его не бандлим, а копируем в функцию: см. copyArgon2.
  external: ['pg-native', '@node-rs/argon2'],
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
}

async function buildServer() {
  await build({ ...common, entryPoints: [path.join(root, 'src/server.ts')], outfile: path.join(root, 'dist/server.mjs') })
}

async function buildVercel() {
  const output = path.join(root, '.vercel/output')
  const funcDir = path.join(output, 'functions/index.func')
  await rm(output, { recursive: true, force: true })
  await mkdir(funcDir, { recursive: true })
  await build({ ...common, entryPoints: [path.join(root, 'api/index.ts')], outfile: path.join(funcDir, 'index.mjs') })
  const vcConfig = { runtime: NODE_RUNTIME, handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false }
  await writeFile(path.join(funcDir, '.vc-config.json'), JSON.stringify(vcConfig, null, 2))
  await copyArgon2(funcDir)
  const config = { version: 3, routes: [{ src: '/(.*)', dest: '/index' }] }
  await writeFile(path.join(output, 'config.json'), JSON.stringify(config, null, 2))
}

/**
 * Кладёт @node-rs/argon2 и установленный бинарник платформы (на Vercel — linux-x64-gnu)
 * в node_modules функции: без них POST /admin/login падает с «Cannot find module».
 */
async function copyArgon2(funcDir) {
  const scopeDir = path.join(root, '../../node_modules/@node-rs')
  const packages = (await readdir(scopeDir)).filter(name => name === 'argon2' || name.startsWith('argon2-'))
  if (!packages.includes('argon2')) throw new Error('@node-rs/argon2 не установлен — вход в админку не заработает')
  for (const name of packages) {
    await cp(path.join(scopeDir, name), path.join(funcDir, 'node_modules/@node-rs', name), { recursive: true })
  }
}

await buildServer()
await buildVercel()
