/**
 * Renders the localized portfolio cover card for the user guides.
 *
 *   docs/assets/screenshots/{en,hu,de}/00-cover.png   (1254 × 1254)
 *
 * This is the image the portfolio shows on the project card (`image` in
 * publish-user-guide.mts). It is NOT a screenshot of the app — it's promo art,
 * so it is generated from the HTML below rather than captured from the running
 * product like the other assets.
 *
 * The previous covers were made by hand in an external tool and sold the voice
 * agent ("Automate Dental Booking with Voice AI", a microphone mockup, "24/7
 * Call Handling"). When that channel was retired all three had to be redrawn,
 * which is why this exists as a script: three languages, one command, and the
 * brand colours sampled from the originals so the set stays consistent.
 *
 * Run: pnpm guide:cover            (all three languages)
 *      pnpm guide:cover -- --lang hu
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "..")

// Sampled from the original covers so the new set matches the old brand.
const BLUE = "#0055CA"
const NAVY = "#022766"
const YELLOW = "#FED221"
const WORDMARK = "#0758C0"
const GROUND = "#FEFEFE"

const SIZE = 627 // × deviceScaleFactor 2 = 1254, the original dimensions

type Lang = "en" | "hu" | "de"

interface Copy {
  headline: string[]
  sub: string
  phoneHeader: string
  ask: string
  reply: string
  badges: [string, string, string]
}

const COPY: Record<Lang, Copy> = {
  en: {
    headline: ["Automate", "Dental Booking", "with AI Chat"],
    sub: "Answer patient questions 24/7, book appointments instantly, and never miss an enquiry.",
    phoneHeader: "Chat Assistant",
    ask: "Any slots Monday?",
    reply: "Yes — 9:00 with Dr. Nagy. Shall I book it?",
    badges: ["24/7 Chat", "Instant Booking", "Calendar Sync"],
  },
  hu: {
    headline: ["Automatizálja", "a fogászati", "időpontfoglalást", "MI-csevegéssel"],
    sub: "Válaszoljon a páciensek kérdéseire 0–24-ben, foglaljon időpontokat azonnal, és ne maradjon le egyetlen megkeresésről sem.",
    phoneHeader: "Csevegő asszisztens",
    ask: "Van szabad időpont hétfőn?",
    reply: "Igen — 9:00, Dr. Nagynál. Lefoglaljam?",
    badges: ["0–24 csevegés", "Azonnali foglalás", "Naptárszinkron"],
  },
  de: {
    headline: ["Zahnarzttermine", "automatisieren", "mit KI-Chat"],
    sub: "Beantworten Sie Patientenfragen rund um die Uhr, buchen Sie Termine sofort und verpassen Sie keine Anfrage.",
    phoneHeader: "Chat-Assistent",
    ask: "Haben Sie Montag einen Termin?",
    reply: "Ja — 9:00 Uhr bei Dr. Nagy. Soll ich buchen?",
    badges: ["24/7 Chat", "Sofort buchen", "Kalender-Sync"],
  },
}

/** Smiling tooth + sunburst, redrawn to match the original logo. */
const LOGO = `
<svg viewBox="0 0 130 130" width="62" height="62" fill="none" aria-hidden="true">
  <g stroke="${YELLOW}" stroke-width="7" stroke-linecap="round">
    <path d="M46 4 L48 20"/>
    <path d="M27 10 L33 24"/>
    <path d="M11 23 L21 34"/>
    <path d="M2 42 L16 48"/>
  </g>
  <path d="M65 24 C44 24 26 38 26 60 C26 78 33 92 37 108 C40 120 43 126 49 126
           C56 126 56 110 60 99 Q65 88 70 99 C74 110 74 126 81 126
           C87 126 90 120 93 108 C97 92 104 78 104 60 C104 38 86 24 65 24 Z"
        stroke="${BLUE}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="53" cy="58" r="4.6" fill="${BLUE}"/>
  <circle cx="77" cy="58" r="4.6" fill="${BLUE}"/>
  <path d="M54 74 Q65 85 76 74" stroke="${BLUE}" stroke-width="6" stroke-linecap="round"/>
</svg>`

const ICON_CHAT = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none"
  stroke="${BLUE}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.9-.4L3 21l1.6-4.6A8.3 8.3 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z"/>
</svg>`

const ICON_BOOK = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none"
  stroke="${BLUE}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4.5" width="18" height="17" rx="2.5"/>
  <path d="M3 10h18M8 2.5v4M16 2.5v4"/>
  <circle cx="8" cy="14.5" r="1.1" fill="${BLUE}" stroke="none"/>
  <circle cx="12" cy="14.5" r="1.1" fill="${BLUE}" stroke="none"/>
  <circle cx="16" cy="14.5" r="1.1" fill="${BLUE}" stroke="none"/>
  <circle cx="8" cy="18" r="1.1" fill="${BLUE}" stroke="none"/>
  <circle cx="12" cy="18" r="1.1" fill="${BLUE}" stroke="none"/>
</svg>`

const ICON_SYNC = `<svg viewBox="0 0 24 24" width="21" height="21" fill="none"
  stroke="${BLUE}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4.5" width="18" height="17" rx="2.5"/>
  <path d="M3 10h18M8 2.5v4M16 2.5v4"/>
  <path d="M8.5 16.2a3.6 3.6 0 0 1 6-2.3M15.5 15.8a3.6 3.6 0 0 1-6 2.3"/>
  <path d="M14.2 11.4l.3 2.5 2.5-.3M9.8 20.2l-.3-2.5-2.5.3"/>
</svg>`

function html(c: Copy): string {
  const badgeIcons = [ICON_CHAT, ICON_BOOK, ICON_SYNC]
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;800&display=swap&subset=latin,latin-ext">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${SIZE}px;height:${SIZE}px}
  body{
    background:${GROUND};
    font-family:Figtree,ui-sans-serif,system-ui,sans-serif;
    color:${NAVY};
    padding:38px 40px 34px;
    display:flex;flex-direction:column;
  }
  .brand{display:flex;align-items:center;gap:14px;margin-bottom:34px}
  .brand span{font-size:31px;font-weight:800;color:${WORDMARK};letter-spacing:-.02em}

  .main{flex:1;display:flex;gap:26px;align-items:flex-start}
  .left{flex:1;min-width:0;padding-top:18px}

  h1{font-size:${c.headline.length > 3 ? 41 : 47}px;font-weight:800;line-height:1.08;
     letter-spacing:-.028em;margin-bottom:26px}
  h1 span{display:block;white-space:nowrap}
  h1 span:first-child{font-size:${c.headline.length > 3 ? 45 : 55}px}
  p.sub{font-size:${c.headline.length > 3 ? 19 : 21}px;line-height:1.5;color:${NAVY};
        font-weight:400;max-width:23ch}

  /* phone */
  .phone{width:212px;height:368px;border:9px solid ${BLUE};border-radius:40px;
         position:relative;flex:none;background:#fff;padding:16px 14px;
         display:flex;flex-direction:column}
  .notch{position:absolute;top:-1px;left:50%;transform:translateX(-50%);
         width:56px;height:14px;background:${BLUE};border-radius:0 0 10px 10px}
  .status{display:flex;justify-content:space-between;align-items:center;
          font-size:11px;font-weight:600;color:${NAVY};margin-bottom:22px}
  .bars{display:flex;gap:3px;align-items:flex-end}
  .bars i{display:block;width:3px;background:${NAVY};border-radius:1px}
  .batt{width:17px;height:9px;border:1.4px solid ${NAVY};border-radius:2.5px;position:relative}
  .batt::after{content:"";position:absolute;inset:1.4px;background:${NAVY};border-radius:1px}
  .batt::before{content:"";position:absolute;right:-3.5px;top:2.4px;width:2px;height:4px;
                background:${NAVY};border-radius:0 1px 1px 0}

  .phead{font-size:15px;font-weight:600;text-align:center;color:${NAVY};
         padding-bottom:12px;border-bottom:1.5px solid #E4EBF6;margin-bottom:16px}

  .thread{display:flex;flex-direction:column;gap:11px}
  .bub{font-size:12.5px;line-height:1.4;padding:9px 12px;max-width:88%}
  .ask{align-self:flex-end;background:${BLUE};color:#fff;font-weight:500;
       border-radius:14px 14px 4px 14px}
  .reply{align-self:flex-start;background:#EDF3FC;color:${NAVY};
         border-radius:14px 14px 14px 4px}
  .dots{align-self:flex-start;display:flex;gap:4px;padding:10px 12px;background:#EDF3FC;
        border-radius:14px 14px 14px 4px}
  .dots i{width:5px;height:5px;border-radius:50%;background:#9DB6D8;display:block}

  .badges{display:flex;gap:12px;margin-top:30px}
  .badge{flex:1;border:2px solid #CFE0F7;border-radius:15px;padding:13px 8px;
         display:flex;align-items:center;justify-content:center;gap:9px;
         font-size:14.5px;font-weight:500;color:${NAVY};text-align:center;line-height:1.15}
  .badge svg{flex:none}
</style></head><body>

  <div class="brand">${LOGO}<span>Sunshine Dental</span></div>

  <div class="main">
    <div class="left">
      <h1>${c.headline.map((l) => `<span>${l}</span>`).join("")}</h1>
      <p class="sub">${c.sub}</p>
    </div>

    <div class="phone">
      <div class="notch"></div>
      <div class="status">
        <span>9:41</span>
        <span style="display:flex;gap:5px;align-items:center">
          <span class="bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:10px"></i></span>
          <span class="batt"></span>
        </span>
      </div>
      <div class="phead">${c.phoneHeader}</div>
      <div class="thread">
        <div class="bub ask">${c.ask}</div>
        <div class="bub reply">${c.reply}</div>
        <div class="dots"><i></i><i></i><i></i></div>
      </div>
    </div>
  </div>

  <div class="badges">
    ${c.badges.map((b, i) => `<div class="badge">${badgeIcons[i]}<span>${b}</span></div>`).join("")}
  </div>

<script>
  // The headline lines are nowrap so each array entry stays one line. Languages
  // differ wildly in word length ("Zahnarzttermine" vs "Automate"), so rather
  // than hand-tune a size per language, shrink until the widest line fits the
  // column. Keeps any future copy edit from silently clipping.
  (function () {
    var left = document.querySelector(".left");
    var h1 = document.querySelector("h1");
    var lines = Array.prototype.slice.call(h1.querySelectorAll("span"));
    var lead = lines[0];
    var size = parseFloat(getComputedStyle(h1).fontSize);
    var leadSize = parseFloat(getComputedStyle(lead).fontSize);
    var ratio = leadSize / size;
    function widest() {
      return Math.max.apply(null, lines.map(function (s) { return s.scrollWidth; }));
    }
    var guard = 200;
    while (widest() > left.clientWidth && size > 18 && guard--) {
      size -= 1;
      h1.style.fontSize = size + "px";
      lead.style.fontSize = size * ratio + "px";
    }
  })();
</script>
</body></html>`
}

function parseLangs(): Lang[] {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    let v: string | undefined
    if (args[i] === "--lang" || args[i] === "-l") v = args[i + 1]
    else if (args[i]?.startsWith("--lang=")) v = args[i].slice("--lang=".length)
    if (v) {
      if (!(v in COPY)) throw new Error(`Unknown --lang "${v}". Use en, hu or de.`)
      return [v as Lang]
    }
  }
  return ["en", "hu", "de"]
}

async function main() {
  const langs = parseLangs()
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 2,
  })

  for (const lang of langs) {
    await page.setContent(html(COPY[lang]), { waitUntil: "networkidle" })
    // These run as source strings, not closures: tsx/esbuild compiles named
    // arrow functions with a `__name` helper that does not exist in the page,
    // so a passed-in closure dies with "__name is not defined".
    await page.evaluate("document.fonts.ready.then(function(){ return true })")

    // Re-fit now that Figtree is actually applied; the inline pass ran on
    // fallback metrics, which are narrower than Figtree ExtraBold.
    await page.evaluate(`(function () {
      var left = document.querySelector(".left");
      var h1 = document.querySelector("h1");
      var lines = Array.prototype.slice.call(h1.querySelectorAll("span"));
      var lead = lines[0];
      var size = parseFloat(getComputedStyle(h1).fontSize);
      var ratio = parseFloat(getComputedStyle(lead).fontSize) / size;
      function widest() {
        return Math.max.apply(null, lines.map(function (s) { return s.scrollWidth; }));
      }
      var guard = 200;
      while (widest() > left.clientWidth && size > 18 && guard--) {
        size -= 1;
        h1.style.fontSize = size + "px";
        lead.style.fontSize = size * ratio + "px";
      }
      return size;
    })()`)
    const dir = join(repoRoot, "docs", "assets", "screenshots", lang)
    mkdirSync(dir, { recursive: true })
    const out = join(dir, "00-cover.png")
    await page.screenshot({ path: out })
    console.log(`✅ ${lang} → ${out}`)
  }

  await browser.close()
}

main().catch((e) => {
  console.error(`❌ Cover render failed: ${e.message ?? e}`)
  process.exitCode = 1
})
