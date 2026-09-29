#!/usr/bin/env node
// sync-app.mjs — builds the React app and copies its distribution into
// src-tauri/app-dist/ so the Tauri wrapper bundles the React application.
//
// History: this script used to copy the repo root's legacy vanilla-JS app
// (index.html, css/, js/) into app-dist, which meant every desktop build
// packaged the old 8-category tool and never the React app. The desktop build
// now ships React; the legacy web app is still served by Azure Static Web Apps
// and by `npm run local`, and is deliberately left out of the bundle.
//
// Uses an explicit allowlist so node_modules, source, tests, and docs never slip
// into the bundle. Both src-tauri/app-dist/ and src-tauri/target/ are
// gitignored, so this is a local build artifact.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Node refuses to spawn a bare `npm.cmd` (spawnSync EINVAL) without a shell, and
// routing through a shell would reintroduce quoting problems. Run npm's own
// entry point with the current Node binary instead — no shell, same behaviour.
const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = join(root, "app");
const dist = join(appRoot, "dist");
const dest = join(root, "src-tauri", "app-dist");

// Explicit allowlist of the Vite output. `assets` is required (the hashed JS and
// CSS live there); the icons are referenced from index.html.
//
// Deliberately excludes the PWA artefacts. `DESKTOP_BUILD=1` disables the
// service worker, and with it Vite emits no `sw.js`, no `registerSW.js`, and no
// generated `manifest.webmanifest` — a webview has no install prompt to serve.
const entries = ["index.html", "assets", "favicon.ico", "favicon.svg", "pwa-192x192.png", "pwa-512x512.png"];

const npmRun = existsSync(npmCli) ? process.execPath : "npm";
const npmArgs = existsSync(npmCli) ? [npmCli, "run", "build"] : ["run", "build"];

// `DESKTOP_BUILD` makes app/vite.config.ts skip the service worker. Inside a
// Tauri webview a precaching SW is dead weight at best and a stale-cache hazard
// at worst — it would serve an old bundle from cache and look like a failed
// deploy. See the VitePWA `disable` flag there.
console.log("sync-app: building app/ (service worker disabled for desktop)...");
try {
  execFileSync(npmRun, npmArgs, {
    cwd: appRoot,
    stdio: "inherit",
    env: { ...process.env, DESKTOP_BUILD: "1" },
  });
} catch {
  console.error("sync-app: app/ build failed — aborting without touching app-dist.");
  process.exit(1);
}

if (!existsSync(dist)) {
  console.error(`sync-app: ${dist} not found after build — aborting.`);
  process.exit(1);
}

const missing = entries.filter((entry) => !existsSync(join(dist, entry)));
if (missing.length > 0) {
  console.error(
    "sync-app: build output is missing " + missing.join(", ") + " — aborting. " +
      "A partial app-dist would ship a blank window.",
  );
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

function collectBytes(path) {
  const stat = statSync(path);
  if (stat.isFile()) return stat.size;
  let bytes = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    bytes += collectBytes(join(path, entry.name));
  }
  return bytes;
}

for (const entry of entries) {
  cpSync(join(dist, entry), join(dest, entry), { recursive: true, errorOnExist: false });
}

const total = entries.reduce((sum, entry) => sum + collectBytes(join(dest, entry)), 0);
console.log(
  `sync-app: copied ${entries.join(", ")} into src-tauri/app-dist (${(total / 1048576).toFixed(2)} MB)`,
);
