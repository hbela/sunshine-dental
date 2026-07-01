/**
 * Downloads a Retell call recording and transcodes it to a small mp3 for the
 * user guides, writing the result into every language's screenshot folder so
 * `publish-user-guide.mts` copies it into the portfolio like any screenshot.
 *
 * Retell's `recording_url` is a public (unsigned) CloudFront .wav; we transcode
 * it to mono mp3 with the bundled `ffmpeg-static` binary (no system ffmpeg).
 *
 * Output:
 *   docs/assets/screenshots/{en,hu,de}/<name>.mp3   (default name: latest-call)
 *
 * Run:
 *   pnpm guide:audio
 *   pnpm guide:audio -- --url <recording_url> --name latest-call
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import ffmpegPath from "ffmpeg-static"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..")

// Default = the featured "latest call" (successful booking, positive sentiment).
const DEFAULT_URL =
  "https://dxc03zgurdly9.cloudfront.net/b8f20892a990d4ec9fb4f1618d6d6347fca487058a93f28ea069c898bab16857/recording.wav"

const LANGS = ["en", "hu", "de"] as const

function parseArgs() {
  const args = process.argv.slice(2)
  let url = DEFAULT_URL
  let name = "latest-call"
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") url = args[i + 1] ?? url
    else if (args[i]?.startsWith("--url=")) url = args[i].slice("--url=".length)
    else if (args[i] === "--name") name = args[i + 1] ?? name
    else if (args[i]?.startsWith("--name=")) name = args[i].slice("--name=".length)
  }
  return { url, name }
}

async function main() {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not resolve a binary path")
  const { url, name } = parseArgs()

  // 1. Download the recording to a temp file.
  console.log(`⬇️  Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  const wavPath = join(tmpdir(), `${name}-${Date.now()}.wav`)
  writeFileSync(wavPath, Buffer.from(await res.arrayBuffer()))

  // 2. Transcode wav → mono mp3 (~96 kbps) into the first language folder.
  const shotsDir = (lang: string) =>
    join(repoRoot, "docs", "assets", "screenshots", lang)
  const firstOut = join(shotsDir(LANGS[0]), `${name}.mp3`)
  mkdirSync(dirname(firstOut), { recursive: true })

  console.log(`🎚️  Transcoding → ${firstOut}`)
  const ff = spawnSync(
    ffmpegPath,
    ["-y", "-i", wavPath, "-ac", "1", "-b:a", "96k", firstOut],
    { stdio: ["ignore", "ignore", "inherit"] },
  )
  if (ff.status !== 0) throw new Error(`ffmpeg exited with code ${ff.status}`)
  if (!existsSync(firstOut)) throw new Error(`ffmpeg produced no output at ${firstOut}`)

  // 3. Copy the mp3 into the remaining language folders (one English recording,
  //    referenced identically by all three guides).
  for (const lang of LANGS.slice(1)) {
    const dest = join(shotsDir(lang), `${name}.mp3`)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(firstOut, dest)
  }

  console.log(`✅ Wrote ${name}.mp3 into: ${LANGS.join(", ")}`)
}

main().catch((e) => {
  console.error(`❌ fetch-call-audio failed: ${e.message ?? e}`)
  process.exitCode = 1
})
