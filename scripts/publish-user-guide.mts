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
  technologies: "React, Vite, TanStack, Fastify, Prisma, PostgreSQL, Claude AI, Retell AI, n8n",
}

const byLang: Record<Lang, { slug: string; guideFile: string; title: string; excerpt: string }> = {
  en: {
    slug: "sunshine-dental",
    guideFile: "user-guide.md",
    title: "Sunshine Dental — User Guide",
    excerpt:
      "A 24/7 AI receptionist for a dental clinic — phone and website chat — plus a staff dashboard, with patient data encrypted under a clinic-held key and backed up nightly.",
  },
  hu: {
    slug: "sunshine-dental-hu",
    guideFile: "user-guide.hu.md",
    title: "Sunshine Dental — Felhasználói útmutató",
    excerpt:
      "Éjjel-nappal elérhető MI recepciós egy fogorvosi rendelőnek — telefonon és webes csevegésben —, plusz munkatársi felület, a betegadatok pedig a rendelő saját kulcsával titkosítva, éjszakánként mentve.",
  },
  de: {
    slug: "sunshine-dental-de",
    guideFile: "user-guide.de.md",
    title: "Sunshine Dental — Benutzerhandbuch",
    excerpt:
      "Eine 24/7-KI-Rezeption für eine Zahnarztpraxis — Telefon und Website-Chat — plus Team-Dashboard; Patientendaten verschlüsselt mit einem Praxis-Schlüssel und nächtlich gesichert.",
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
  image: `/${SLUG}/00-cover.png`, // localized promo cover — copied below (see COVER_ASSET)
}

// Cover image shown on the portfolio project card. It lives per-language in the
// screenshot folder but isn't referenced in the guide body, so it's copied
// explicitly (in addition to the markdown-referenced assets).
const COVER_ASSET = "00-cover.png"

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

  // 1. Copy each referenced asset (screenshots + call-recording audio) from this
  //    language's folder into public/<slug>/. Filenames carry their extension so
  //    png and mp3 are handled the same way.
  const referenced = new Set<string>()
  const re = /assets\/screenshots\/([\w-]+\.(?:png|mp3))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) referenced.add(m[1])

  if (referenced.size === 0) {
    console.warn("⚠️  No assets/screenshots/* references found in the guide.")
  } else {
    mkdirSync(destDir, { recursive: true })
    const shotsDir = join(repoRoot, "docs", "assets", "screenshots", LANG)
    const missing: string[] = []
    for (const name of referenced) {
      const src = join(shotsDir, name)
      if (!existsSync(src)) {
        missing.push(name)
        continue
      }
      copyFileSync(src, join(destDir, name))
    }
    if (missing.length) {
      throw new Error(
        `Missing assets for: ${missing.join(", ")} (expected docs/assets/screenshots/${LANG}/<name> — run \`pnpm guide:shots\` / \`pnpm guide:audio\`)`,
      )
    }
    console.log(`✅ Copied ${referenced.size} asset(s) → ${destDir}`)
  }

  // Copy the localized cover image (referenced by the manifest's `image`, not the body).
  const coverSrc = join(repoRoot, "docs", "assets", "screenshots", LANG, COVER_ASSET)
  if (!existsSync(coverSrc)) {
    throw new Error(
      `Missing cover image ${coverSrc} — add the ${LANG} ${COVER_ASSET} (project-card cover).`,
    )
  }
  mkdirSync(destDir, { recursive: true })
  copyFileSync(coverSrc, join(destDir, COVER_ASSET))
  console.log(`✅ Copied cover ${COVER_ASSET} → ${destDir}`)

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
