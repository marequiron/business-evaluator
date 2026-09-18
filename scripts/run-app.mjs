#!/usr/bin/env node
/**
 * run-app.mjs
 * Launches the packaged Windows exe if it exists (build first via
 * scripts/build-desktop.ps1 or `npm run app:build`), and waits.
 *
 * Usage:  node scripts/run-app.mjs [--exe <path>]
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const exeArg = args.indexOf("--exe") !== -1 ? args[args.indexOf("--exe") + 1] : null;
const exe = exeArg
  ? join(ROOT, exeArg)
  : join(ROOT, "src-tauri", "target", "release", "business-evaluator.exe");

if (!existsSync(exe)) {
  console.error("Executable not found: " + exe);
  console.error("Build it first:  .\\scripts\\build-desktop.ps1   or   npm run app:build");
  process.exit(1);
}

console.log("Launching " + exe);
const child = spawn(exe, [], { stdio: "inherit" });
child.on("error", (err) => {
  console.error("Failed to launch:", err.message);
  process.exit(1);
});
child.on("exit", (code) => {
  console.log("App exited with code " + code);
});