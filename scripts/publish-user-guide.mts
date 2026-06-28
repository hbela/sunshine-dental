/**
 * Publishes a Sunshine Dental user guide to the portfolio (my-blog), per language.
 *
 *   1. Copies the language's screenshots (docs/assets/screenshots/<lang>/NN-name.png)
 *      into the portfolio's public/<slug>/.
 *   2. POSTs the manifest + markdown to the portfolio's import API, which upserts
 *      the Project row (the DB row updates immediately; images ship to prod only
 *      after committing public/<slug>/ and redeploying my-blog).
 *
 * One slug per language (the portfolio has no native bilingual model):
 *   en → sunshine-dental   hu → sunshine-dental-hu   de → sunshine-dental-de
 *
 * Env (repo-root .env):
 *   PORTFOLIO_API_URL       default http://localhost:3000 (prod: https://portfolio.appointer.hu)
 *   PORTFOLIO_IMPORT_SECRET shared with my-blog's IMPORT_API_SECRET
 *   PORTFOLIO_PUBLIC_DIR    default ../my-blog/public
 *
 * Run: pnpm guide:publish -- --lang hu   (default lang: en)
 */
import { readFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..")

// --- Minimal .env loader (no dotenv dependency at the repo root) ---
function loadEnv() {
  const envPath = join(repoRoot, ".env")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadEnv()

// --- Language → manifest + sources --------------------------------------
type Lang = "en" | "hu" | "de"

const SHARED = {
  brandIcon: "S",
  docTheme: true,
  published: true,
  technologies: "React, Vite, TanStack, Fastify, Prisma, Retell AI, n8n",
}

const byLang: Record<Lang, { slug: string; guideFile: string; title: string; excerpt: string }> = {
  en: {
    slug: "sunshine-dental",
    guideFile: "user-guide.md",
    title: "Sunshine Dental — User Guide",
    excerpt:
      "A 24/7 AI phone receptionist for a dental clinic, plus a staff dashboard for the calendar, patients and call logs.",
  },
  hu: {
    slug: "sunshine-dental-hu",
    guideFile: "user-guide.hu.md",
    title: "Sunshine Dental — Felhasználói útmutató",
    excerpt:
      "Éjjel-nappal elérhető MI telefonos recepciós egy fogorvosi rendelőnek, plusz egy munkatársi felület a naptárhoz, betegekhez és hívásnaplókhoz.",
  },
  de: {
    slug: "sunshine-dental-de",
    guideFile: "user-guide.de.md",
    title: "Sunshine Dental — Benutzerhandbuch",
    excerpt:
      "Eine rund um die Uhr verfügbare KI-Telefonrezeption für eine Zahnarztpraxis, plus ein Team-Dashboard für Kalender, Patienten und Anrufprotokolle.",
  },
}

// --- Parse --lang -------------------------------------------------------
function parseLang(): Lang {
  const args = process.argv.slice(2)
  let lang = "en"
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lang" || args[i] === "-l") lang = args[i + 1] ?? lang
    else if (args[i]?.startsWith("--lang=")) lang = args[i].slice("--lang=".length)
  }
  if (!(lang in byLang)) {
    throw new Error(`Unknown --lang "${lang}". Use one of: ${Object.keys(byLang).join(", ")}`)
  }
  return lang as Lang
}

const LANG = parseLang()
const { slug: SLUG, guideFile, title, excerpt } = byLang[LANG]
const manifest = {
  ...SHARED,
  slug: SLUG,
  title,
  excerpt,
  image: `/${SLUG}/02-dashboard.png`, // cover — must be one of the copied screens
}

const API_URL = process.env.PORTFOLIO_API_URL || "http://localhost:3000"
const SECRET = process.env.PORTFOLIO_IMPORT_SECRET
const PUBLIC_DIR = process.env.PORTFOLIO_PUBLIC_DIR || "../my-blog/public"

async function main() {
  if (!SECRET) {
    throw new Error(
      "PORTFOLIO_IMPORT_SECRET is not set — add it to .env (must match my-blog's IMPORT_API_SECRET).",
    )
  }

  const guidePath = join(repoRoot, "docs", guideFile)
  if (!existsSync(guidePath)) {
    throw new Error(`Missing ${guidePath} — author the ${LANG} guide first.`)
  }
  const content = readFileSync(guidePath, "utf8")

  // Resolve target public dir (relative paths are relative to the repo root).
  const publicDir = isAbsolute(PUBLIC_DIR) ? PUBLIC_DIR : resolve(repoRoot, PUBLIC_DIR)
  const destDir = join(publicDir, SLUG)

  // 1. Copy each referenced screenshot from this language's folder into public/<slug>/.
  const referenced = new Set<string>()
  const re = /assets\/screenshots\/([\w-]+)\.png/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) referenced.add(m[1])

  if (referenced.size === 0) {
    console.warn("⚠️  No assets/screenshots/*.png references found in the guide.")
  } else {
    mkdirSync(destDir, { recursive: true })
    const shotsDir = join(repoRoot, "docs", "assets", "screenshots", LANG)
    const missing: string[] = []
    for (const name of referenced) {
      const src = join(shotsDir, `${name}.png`)
      if (!existsSync(src)) {
        missing.push(name)
        continue
      }
      copyFileSync(src, join(destDir, `${name}.png`))
    }
    if (missing.length) {
      throw new Error(
        `Missing screenshots for: ${missing.join(", ")} (expected docs/assets/screenshots/${LANG}/<name>.png — run \`pnpm guide:shots\`)`,
      )
    }
    console.log(`✅ Copied ${referenced.size} image(s) → ${destDir}`)
  }

  // 2. POST to the import API.
  const endpoint = `${API_URL.replace(/\/$/, "")}/api/projects/import`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ ...manifest, content }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Import API ${res.status}: ${text}`)
  }
  console.log(`✅ Published ${LANG} (${SLUG}) to ${endpoint}`)
  console.log(text)
}

main().catch((e) => {
  console.error(`❌ Publish failed: ${e.message ?? e}`)
  process.exitCode = 1
})
