import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { MONOREPO_ROOT, PKG_ROOT } from "./paths";

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  // Precedence: real shell environment > package .env > monorepo root .env.
  // (dotenv override:true makes later files win; the snapshot restore puts
  // explicitly-set shell vars — e.g. VIDEO_LANG=hu for a one-off run — on top.)
  const shell = { ...process.env };
  const files = [path.join(MONOREPO_ROOT, ".env"), path.join(PKG_ROOT, ".env")];
  for (const file of files) {
    if (existsSync(file)) dotenv.config({ path: file, override: true });
  }
  Object.assign(process.env, shell);
}

/** UI + narration language for this run. Call after loadEnv(). */
export function getLang(): string {
  return (process.env.VIDEO_LANG ?? "en").toLowerCase();
}
