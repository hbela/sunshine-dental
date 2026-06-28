/**
 * Captures fresh UI screenshots of the running Sunshine Dental web app in every
 * supported language (en/hu/de), for the portfolio user guides.
 *
 * For each language it opens a clean browser context, forces the app into that
 * language by pre-seeding localStorage `sd.lang` (the i18next detector reads it
 * first — see apps/web/src/i18n/index.ts), screenshots the login page, logs in
 * as the seeded admin, then screenshots every authenticated screen.
 *
 * Output: docs/assets/screenshots/<lang>/NN-name.png — the publish script copies
 * the per-language folder into the portfolio's public/<slug>/.
 *
 * Prereqs: Postgres up, DB seeded same-day (`pnpm --filter @repo/api db:seed`),
 * and the dev servers running (`pnpm dev` → web on 5173, API proxied on 3000).
 *
 * Run: pnpm guide:shots
 * Env: SHOT_BASE_URL (default http://localhost:5173), SHOT_LANGS (default
 *      "en,hu,de"), SHOT_EMAIL, SHOT_PASSWORD, SHOT_FULLPAGE ("1" = full page).
 */
import { chromium, type Browser, type BrowserContext } from "playwright"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..")

const BASE_URL = (process.env.SHOT_BASE_URL || "http://localhost:5173").replace(/\/$/, "")
const LANGS = (process.env.SHOT_LANGS || "en,hu,de").split(",").map((s) => s.trim()).filter(Boolean)
const EMAIL = process.env.SHOT_EMAIL || "admin@sunshine.dental"
const PASSWORD = process.env.SHOT_PASSWORD || "Admin1234!"
const FULL_PAGE = process.env.SHOT_FULLPAGE === "1"

/** Authenticated screens, in guide order. `name` matches the markdown image refs. */
const screens: { name: string; path: string }[] = [
  { name: "02-dashboard", path: "/" },
  { name: "03-calendar", path: "/calendar" },
  { name: "04-patients", path: "/patients" },
  { name: "05-appointments", path: "/appointments" },
  { name: "06-call-logs", path: "/call-logs" },
  { name: "07-admin-users", path: "/admin/users" },
  { name: "08-settings", path: "/settings" },
]

async function settle(page: import("playwright").Page) {
  await page.waitForLoadState("networkidle").catch(() => {})
  // Let entrance animations / async data render before capturing.
  await page.waitForTimeout(700)
}

async function shoot(context: BrowserContext, lang: string) {
  const outDir = join(repoRoot, "docs", "assets", "screenshots", lang)
  mkdirSync(outDir, { recursive: true })

  const page = await context.newPage()

  // 1. Login screen (logged out — fresh context has no session).
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" })
  await page.locator("#email").waitFor({ state: "visible", timeout: 30_000 })
  await settle(page)
  await page.screenshot({ path: join(outDir, "01-login.png"), fullPage: FULL_PAGE })

  // 2. Log in as the seeded admin (ADMIN sees every route).
  await page.fill("#email", EMAIL)
  await page.fill("#password", PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 })
  await settle(page)

  // 3. Each authenticated screen.
  for (const s of screens) {
    await page.goto(`${BASE_URL}${s.path}`, { waitUntil: "domcontentloaded" })
    await settle(page)
    await page.screenshot({ path: join(outDir, `${s.name}.png`), fullPage: FULL_PAGE })
    console.log(`  ✓ ${lang}/${s.name}.png`)
  }

  await page.close()
}

async function main() {
  let browser: Browser | null = null
  try {
    browser = await chromium.launch()
    for (const lang of LANGS) {
      console.log(`📸 ${lang} → ${BASE_URL}`)
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        // Pre-seed the language before any app code runs.
        storageState: {
          cookies: [],
          origins: [{ origin: BASE_URL, localStorage: [{ name: "sd.lang", value: lang }] }],
        },
      })
      await shoot(context, lang)
      await context.close()
    }
    console.log(`\n✅ Screenshots written to docs/assets/screenshots/{${LANGS.join(",")}}/`)
  } finally {
    await browser?.close()
  }
}

main().catch((e) => {
  console.error(`❌ Screenshot capture failed: ${e?.message ?? e}`)
  process.exitCode = 1
})
