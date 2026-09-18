#!/usr/bin/env node
// sync-app.mjs — copies the web distribution (index.html, css/, js/) into
// src-tauri/app-dist/ so the Tauri wrapper only ever bundles the static app.
// Uses an explicit allowlist so api/, test/, docs, and source never slip in.

import { cpSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "src-tauri", "app-dist");

const entries = ["index.html", "css", "js"];

if (!existsSync(join(root, "index.html"))) {
  console.error("sync-app: index.html not found at project root — aborting.");
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
  cpSync(join(root, entry), join(dest, entry), { recursive: true, errorOnExist: false });
}

const total = entries.reduce((sum, entry) => sum + collectBytes(join(dest, entry)), 0);
console.log(`sync-app: copied ${entries.join(", ")} into src-tauri/app-dist (${(total / 1048576).toFixed(2)} MB)`);