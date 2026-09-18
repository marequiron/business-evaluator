# Phase B: Windows Runtime Smoke Checklist

Status: PASSED on 2026-09-18 (local Windows 11, WebView2 Runtime 153.0.4234.32)

## Scope

Phase B validates that the static web app actually works when shipped inside the
Tauri v2 Windows wrapper: the app shell boots, the bundled assets load over the
custom `http://tauri.localhost/` asset protocol, and the wllama engine's ESM +
WASM assets are served correctly by that protocol — all without downloading the
~1 GB model.

## Automated checks

### 1. Headless assembly in `npm test` (CI-safe, no browser)

`test/app.smoke.test.js` builds a jsdom from `index.html` with `data.js`,
`analyzer-parse.js`, `analyzer.js`, and `app.js` inlined, then covers:

| Check | What it proves |
|---|---|
| 8 categories / full form rendered | CATEGORIES data -> DOM |
| Evaluate -> band classification | 3.0 average lands in "Opportunity" for all 8 |
| Auto-save snapshot to history | `business-evaluator-history-v1` gets 1 snapshot |
| Answers persist in localStorage | `business-evaluator-answers-v1` round-trips |
| Info overlay open/toggle/Esc | `createInfoButton`/`toggleInfoOverlay` wiring |
| History JSON export + results .txt export | anchor `download` paths fire |
| Submit fallback -> clipboard | no API configured, clipboard + no `window.open` |
| Reset clears state | answers + results reset |
| Mock analyzer: review + apply | provider abstraction + suggestion selection |
| Synced bundle assembles | `src-tauri/app-dist/` is current |

Result: 9/9 pass, plus the existing 23 analyzer unit tests (32 total).

### 2. Real WebView2 probe via DevTools protocol

`scripts/smoke-webview.mjs` launches the packaged `business-evaluator.exe`, drives
its WebView2 through the Chrome DevTools Protocol, and asserts:

| Probe | Result |
|---|---|
| CDP page target discovered | PASS (`http://tauri.localhost/`) |
| App shell rendered after navigation | PASS: 8 cards, 200 radios, ready=complete |
| Capabilities | PASS: `navigator.gpu` present, `WebAssembly.validate` present |
| `import('/js/vendor/wllama/index.min.js')` resolves | PASS: `Wllama` is a function |
| `fetch('/js/vendor/wllama/wasm/wllama.wasm')` | PASS: HTTP 200, 8,457,512 bytes, `WebAssembly.validate` true |
| `new Wllama({default: ...}, {allowOffline:true})` + `exit()` | PASS: constructs without error |

This confirms the CSP (`script-src 'self' 'wasm-unsafe-eval'`, `wasm-unsafe-eval`
allows compilation) does not block the bundled engine or its WASM, and that the
on-device analyzer will boot from the packaged assets.

## How to reproduce

1. `npm ci` then `npm test` (headless).
2. `powershell -File scripts/build-desktop.ps1 -Probe -Port 9222`
   (temporarily bakes `--remote-debugging-port=9222`, builds binaries only,
   self-restores `src-tauri/tauri.conf.json` afterwards).
3. `node scripts/smoke-webview.mjs --port 9222`.
4. Rebuild the clean artifact: `powershell -File scripts/build-desktop.ps1`
   (also regenerates the NSIS/MSI bundles without the debug port).

## Manual spot-checks (human, required before closing Phase B)

Run the app: `npm run app:run` (launches the built exe) — or double-click
`src-tauri\target\release\business-evaluator.exe`. Go top-to-bottom; mark ✅/❌
and note anything unexpected. The automated suites above already cover the
logic paths; this runbook is a live-window confirmation, and item 8 is the one
thing automation intentionally leaves out (real model download).

- [ ] **1. Window shell** — 960x720, resizable; cannot shrink below 640x480.
- [ ] **2. Fill form + Evaluate** — after selecting an answer for every
      question, click "Evaluate My Business": bar chart + 8 band cards render,
      with a legend and per-category recommendations.
- [ ] **3. Reload the app** — answers survive (localStorage / webview profile).
      Close and relaunch, answers are still there.
- [ ] **4. Re-evaluate after an edit** — change one answer, re-evaluate: the
      history panel gains a snapshot ("Past snapshots (2)") and Compare shows
      the delta.
- [ ] **5. Export Results** — downloads `business-evaluation-results.txt`.
- [ ] **6. Print / Save as PDF** — opens the print dialog; "Save as PDF" works.
- [ ] **7. Info (ⓘ) overlay** — a question's ⓘ opens the plain-language overlay;
      toggles closed, and closes on Esc / outside click.
- [ ] **8. Analyze My Documents (model download + stream)** — with the app
      running, click "Analyze My Documents" and pick a `.txt` with one
      business-owning sentence. First run downloads ~1 GB
      `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` from Hugging Face (progress shown);
      then streaming begins: one suggestion block per category with a
      rationale. No upload anywhere: model + input stay on-device (confirm via
      Task Manager / firewall prompts that nothing leaves the machine). Note
      whether the WebGPU or CPU/WASM path engaged (DevTools: sources/backend).
- [ ] **9. Reset** — confirm dialog appears; answers + results clear.

Result (fill on completion):

| Item | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8a* | 8b** | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| ✅/❌ |   |   |   |   |   |   |   |    |      |   |

\* 8a = model downloaded + cached · \*\* 8b = suggestions streamed on-device.

Record any failures here, then flip `PLATFORM-APP-PLAN.md` Phase B to fully
complete (including human spot-checks) and proceed to Phase C.

## Known notes

- WebView2 runs as a singleton browser process; after a `-Probe` build session its
  old `msedgewebview2.exe` may briefly keep `--remote-debugging-port` in its
  command line until the last host that holds it exits. The packaged exe itself is
  devtools-free once the config is restored and rebuilt (verified in step 4 above).
- `webgpu` flips between webview instances; the app already falls back to
  CPU/WASM when `navigator.gpu` is unavailable (`Analyzer.isWebGpuAvailable()`).