Vendored third-party engine
===========================

@wllama/wllama  v3.6.1  (MIT - see ./LICENCE)
https://github.com/ngxson/wllama

Files:
  index.min.js      the ESM bundle (also contains the Web Worker source as a Blob)
  wasm/wllama.wasm  the single WebGPU + WASM build

Why vendored: the project has no build step and must not depend on a
third-party CDN at runtime. These are committed as-is, unmodified.

Updating:
  npm pack @wllama/wllama
  tar -xzf wllama-wllama-*.tgz
  copy package/esm/index.min.js      -> js/vendor/wllama/index.min.js
  copy package/esm/wasm/wllama.wasm  -> js/vendor/wllama/wasm/wllama.wasm
  copy package/LICENCE               -> js/vendor/wllama/LICENCE

Note: this is the project's only runtime dependency, added deliberately (see
AGENTS.md). Model weights are NOT vendored; they download once from Hugging
Face and are cached by the browser.
