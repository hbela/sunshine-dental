import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { getLang, loadEnv } from "../lib/env";
import { PUBLIC_DIR, SCENES_PATH, SCREENSHOTS_DIR } from "../lib/paths";
import { scenesSchema } from "../lib/schema";

loadEnv();

const APP_URL = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
const LOGIN_EMAIL = process.env.LOGIN_EMAIL ?? "";
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD ?? "";
const VIDEO_LANG = getLang();
const width = Number(process.env.VIEWPORT_WIDTH ?? 1920);
const height = Number(process.env.VIEWPORT_HEIGHT ?? 1080);

// Opener typed into the public /chat scene so the shot shows a real AI exchange.
const defaultChatMessage = "Hi! I'd like to book a cleaning next week.";
const chatMessage: Record<string, string> = {
  en: defaultChatMessage,
  hu: "Szia! Szeretnék fogtisztításra időpontot foglalni jövő hétre.",
  de: "Hallo! Ich möchte nächste Woche einen Termin zur Zahnreinigung buchen.",
};

if (!existsSync(SCENES_PATH)) {
  console.error("✖ scenes.json not found. Run `video:scenes` first.");
  process.exit(1);
}

// Preflight: make sure APP_URL fronts the real Sunshine API before spending a
// minute on captures. The port-3000 squatter (my-blog's dev server) answers
// /api/health with a bare {"status":"ok"} — the real API always reports `db`.
const health = await fetch(`${APP_URL}/api/health`)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
if (!health || health.db !== "ok") {
  console.error(`✖ ${APP_URL}/api/health is not the Sunshine API (got: ${JSON.stringify(health)}).`);
  console.error("  The Vite proxy target (port 3000) is probably taken by another app (my-blog).");
  console.error("  Either free port 3000 and run `pnpm dev`, or start a parallel stack:");
  console.error("    PORT=3002 BETTER_AUTH_URL=http://localhost:3002 WEB_ORIGIN=http://localhost:5199 pnpm --filter api dev");
  console.error("    API_PROXY_TARGET=http://localhost:3002 pnpm --filter web exec vite --port 5199 --strictPort");
  console.error("  then set APP_URL=http://localhost:5199 in packages/video-generator/.env.");
  process.exit(1);
}
if (health.encryption !== "unlocked") {
  console.warn("⚠ API encryption is locked — patient pages will show the unlock banner.");
}

const scenes = scenesSchema.parse(JSON.parse(await fs.readFile(SCENES_PATH, "utf8")));
await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

const browser = await chromium.launch();
// Pre-seed the app language before any code runs (i18next reads sd.lang first).
const context = await browser.newContext({
  viewport: { width, height },
  storageState: {
    cookies: [],
    origins: [{ origin: APP_URL, localStorage: [{ name: "sd.lang", value: VIDEO_LANG }] }],
  },
});
const page = await context.newPage();

async function login(p: Page): Promise<void> {
  console.log(`→ Logging in as ${LOGIN_EMAIL}…`);
  await p.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
  await p.locator("#email").waitFor({ state: "visible", timeout: 30_000 });
  await p.fill("#email", LOGIN_EMAIL);
  await p.fill("#password", LOGIN_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30_000 });
}

async function captureChatExchange(p: Page): Promise<void> {
  await p.locator("textarea").waitFor({ state: "visible", timeout: 30_000 });
  await p.waitForTimeout(700);
  await p.fill("textarea", chatMessage[VIDEO_LANG] ?? defaultChatMessage);
  await p.keyboard.press("Enter");
  // Generous wait: let the streamed AI reply finish rendering before the shot.
  await p.waitForTimeout(15_000);
}

let loggedIn = false;

try {
  for (const scene of scenes) {
    const isPublic = scene.route === "/chat" || scene.route === "/login";
    if (!isPublic && !loggedIn && LOGIN_EMAIL && LOGIN_PASSWORD) {
      await login(page);
      loggedIn = true;
    }

    const url = `${APP_URL}${scene.route}`;
    console.log(`→ Capturing ${scene.title} (${url})`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    if (scene.route === "/chat") {
      await captureChatExchange(page);
    } else {
      await page.waitForTimeout(1000);
    }
    const outPath = path.join(PUBLIC_DIR, scene.screenshot);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath, fullPage: false });
  }
} finally {
  await browser.close();
}

console.log(`✓ Captured ${scenes.length} screenshots into ${SCREENSHOTS_DIR}`);
