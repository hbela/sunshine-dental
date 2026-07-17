/**
 * Publishes a technical blog post from docs/blog/ to the portfolio (my-blog)
 * via its /api/posts/import endpoint (the Post twin of projects/import).
 *
 * Images: posts reference already-deployed portfolio assets by absolute path
 * (e.g. /sunshine-dental/11-locked.png), so no asset copying happens here.
 *
 * Env (repo-root .env): PORTFOLIO_API_URL, PORTFOLIO_IMPORT_SECRET.
 * Run: npx tsx scripts/publish-blog-post.mts
 */
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..")

function loadEnv() {
  const envPath = join(repoRoot, ".env")
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val
  }
}
loadEnv()

const post = {
  slug: "patient-data-encryption-and-disaster-recovery",
  title: "Encrypting Patient Data When the Server Must Not Hold the Key",
  excerpt:
    "Field-level AES-256-GCM with clinic-held keys, blind indexes, a canary against wrong keys, age-encrypted backups the server can't read, and what a disaster-recovery fire drill actually taught us.",
  image: "/sunshine-dental/11-locked.png",
  published: true,
  sourceFile: "docs/blog/encrypting-patient-data.md",
}

const API_URL = process.env.PORTFOLIO_API_URL || "http://localhost:3000"
const SECRET = process.env.PORTFOLIO_IMPORT_SECRET

async function main() {
  if (!SECRET) throw new Error("PORTFOLIO_IMPORT_SECRET is not set in .env")

  const filePath = join(repoRoot, post.sourceFile)
  if (!existsSync(filePath)) throw new Error(`Missing ${filePath}`)
  const content = readFileSync(filePath, "utf8")

  const endpoint = `${API_URL.replace(/\/$/, "")}/api/posts/import`
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      image: post.image,
      published: post.published,
      content,
    }),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`Import API ${res.status}: ${text}`)
  console.log(`✅ Published post "${post.slug}" to ${endpoint}`)
  console.log(text)
}

main().catch((e) => {
  console.error(`❌ Publish failed: ${e.message ?? e}`)
  process.exitCode = 1
})
