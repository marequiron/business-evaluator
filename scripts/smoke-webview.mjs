#!/usr/bin/env node
/**
 * smoke-webview.mjs
 * Runtime smoke probe for the packaged Windows app via the WebView2 DevTools
 * protocol. Verifies the Tauri asset protocol serves the wllama engine and
 * its .wasm to a real WebView page - WITHOUT downloading the ~1GB model.
 *
 * Usage:  node scripts/smoke-webview.mjs [--exe <path>] [--port <n>]
 *
 * Exit 0 if all probes pass, non-zero otherwise.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const args = process.argv.slice(2);
const exeArg = args.indexOf("--exe") !== -1 ? args[args.indexOf("--exe") + 1] : null;
const exe = exeArg
  ? join(ROOT, exeArg)
  : join(ROOT, "src-tauri", "target", "release", "business-evaluator.exe");
const portArg = args.indexOf("--port") !== -1 ? Number(args[args.indexOf("--port") + 1]) : 0;
const port = portArg || 9222 + Math.floor(Math.random() * 50);

if (!existsSync(exe)) {
  console.error("Executable not found: " + exe);
  console.error("Build it with:  npm run app:build  (or .\\scripts\\build-desktop.ps1)");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function probe(name, pass, detail) {
  results.push(pass);
  console.log((pass ? "PASS" : "FAIL") + ": " + name + (detail ? "  -> " + detail : ""));
}

// 1) Launch the app with a remote-debugging WebView2.
const child = spawn(exe, [], {
  detached: false,
  stdio: "ignore",
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  },
});
console.log("Launched " + exe + " (pid " + child.pid + "), CDP on port " + port);

let code = 1;
async function main() {
  try {
    // 2) Discover the app page target.
    let target = null;
    for (let i = 0; i < 60 && !target; i += 1) {
      await sleep(250);
      target = await findPageTarget();
    }
    if (!target) {
      probe("CDP page target discovered", false, "no page target within 15s");
      return;
    }
    probe("CDP page target discovered", true, target.url);

    // 3) Attach and evaluate probes.
    const ws = await connect(target.webSocketDebuggerUrl);
    await send(ws, "Runtime.enable");

    const doc = await waitFor(
      ws,
      `({
        href: location.href,
        title: document.title,
        ready: document.readyState,
        categoryCards: document.querySelectorAll('#assessment-form .category-card').length,
        radioInputs: document.querySelectorAll('#assessment-form input[type=radio]').length,
        webgpu: !!navigator.gpu,
        wasm: !!WebAssembly.validate,
      })`,
      (d) => d.categoryCards === 8,
      30000
    );
    probe("app shell rendered 8 categories", doc.categoryCards === 8,
      `${doc.categoryCards} cards, ${doc.radioInputs} radios, ready=${doc.ready}, origin=${doc.href}`);
    probe("webview capabilities", true, `webgpu=${doc.webgpu} wasm=${doc.wasm} title="${doc.title}"`);

    const mod = await evaluate(ws, `(async () => {
      const m = await import('/js/vendor/wllama/index.min.js');
      return { kind: typeof m.Wllama, has: !!m.Wllama };
    })()`);
    probe("wllama ESM dynamic import", mod.kind === "function", `Wllama is ${mod.kind}`);

    const wasm = await evaluate(ws, `(async () => {
      const r = await fetch('/js/vendor/wllama/wasm/wllama.wasm');
      if (!r.ok) return { status: r.status };
      const b = await r.arrayBuffer();
      return { status: r.status, bytes: b.byteLength, valid: WebAssembly.validate(b) };
    })()`);
    probe("wasm served + valid over asset protocol",
      wasm.status === 200 && wasm.valid && wasm.bytes > 1_000_000,
      `${wasm.bytes} bytes, valid=${wasm.valid}, status=${wasm.status}`);

    const eng = await evaluate(ws, `(async () => {
      const m = await import('/js/vendor/wllama/index.min.js');
      const eng = new m.Wllama(
        { default: '/js/vendor/wllama/wasm/wllama.wasm' },
        { allowOffline: true, logger: { log: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {} } }
      );
      const alive = Object.keys(eng).length > 0;
      if (typeof eng.exit === 'function') { await eng.exit(); }
      return { alive };
    })()`);
    probe("Wllama engine constructed offline", eng.alive === true);

    try { ws.close(); } catch {}

    code = results.every(Boolean) ? 0 : 1;
  } catch (err) {
    probe("smoke-webview", false, String(err && err.message || err));
  } finally {
    try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
  }
}

async function findPageTarget() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!res.ok) return null;
    const list = await res.json();
    return list.find((t) => t.type === "page" && t.webSocketDebuggerUrl && !t.url.startsWith("devtools://")) || null;
  } catch {
    return null;
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const state = { nextId: 1, pending: new Map(), responses: [] };
    ws.onopen = () => resolve({ ws, state });
    ws.onerror = () => reject(new Error("WebSocket connection failed: " + wsUrl));
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : String(ev.data)); } catch { return; }
      if (msg.id && state.pending.has(msg.id)) {
        const { resolve: r, reject: j } = state.pending.get(msg.id);
        state.pending.delete(msg.id);
        if (msg.error) j(new Error("CDP error: " + (msg.error.message || JSON.stringify(msg.error))));
        else r(msg.result);
      }
    };
  });
}

function send(conn, method, params) {
  return new Promise((resolve, reject) => {
    const id = conn.state.nextId++;
    conn.state.pending.set(id, { resolve, reject });
    conn.ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function evaluate(conn, expression) {
  const out = await send(conn, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (out.exceptionDetails) {
    throw new Error("page threw: " + (out.exceptionDetails.exception && out.exceptionDetails.exception.description || JSON.stringify(out.exceptionDetails)));
  }
  return out.result ? out.result.value : undefined;
}

async function waitFor(conn, expression, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(conn, expression);
    if (predicate(last)) return last;
    await sleep(250);
  }
  return last;
}

await main();
process.exit(code);