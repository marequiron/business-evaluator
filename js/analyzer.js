/**
 * analyzer.js
 * Provider abstraction for document analysis. Depends on AnalyzerParse
 * (loaded before this file in the browser).
 *
 * Providers (selected by ANALYZE.provider in js/data.js):
 *   - "wllama" : on-device inference via the vendored @wllama/wllama engine
 *   - "api"    : Phase 1 backend proxy (not built yet; stub)
 *   - "mock"   : deterministic canned output, used by tests
 *
 * Every provider exposes the same small interface:
 *   { id, isLoaded(), load(onProgress), analyze(text, handlers) }
 */

const Analyzer = (function () {
  "use strict";

  function resolveParse() {
    if (typeof AnalyzerParse !== "undefined") return AnalyzerParse;
    if (typeof require === "function") return require("./analyzer-parse.js");
    throw new Error("AnalyzerParse is not loaded.");
  }

  function absoluteUrl(url) {
    if (typeof document !== "undefined" && document.baseURI) {
      return new URL(url, document.baseURI).href;
    }
    return url;
  }

  function isWebGpuAvailable() {
    return typeof navigator !== "undefined" && !!navigator.gpu;
  }

  // ---- Mock provider (tests / smoke) -------------------------------------

  function createMockAnalyzer(config, categories) {
    const cfg = config || {};
    let loaded = false;
    return {
      id: "mock",
      isLoaded: function () { return loaded; },
      load: function (onProgress) {
        if (onProgress) onProgress({ phase: "download", loaded: 1, total: 1, percent: 100 });
        loaded = true;
        return Promise.resolve();
      },
      analyze: function (documentText, handlers) {
        const h = handlers || {};
        return Promise.resolve().then(() => {
          if (h.onStatus) h.onStatus("Analyzing (mock)...");
          let suggestions;
          if (Array.isArray(cfg.mockSuggestions)) {
            suggestions = cfg.mockSuggestions;
          } else {
            const len = String(documentText || "").length;
            const base = Math.max(1, Math.min(5, 2 + (len % 4)));
            suggestions = (categories || []).map((c, i) => ({
              id: c.id,
              score: Math.max(1, Math.min(5, base - (i % 2))),
              rationale: "Mock rationale for " + c.id + " based on " + len + " characters of input.",
            }));
          }
          const raw = JSON.stringify(suggestions);
          if (h.onToken) raw.split(/(?=,")/).forEach((piece) => h.onToken(piece));
          return { suggestions: suggestions, raw: raw };
        });
      },
      dispose: function () { return Promise.resolve(); },
    };
  }

  // ---- Backend proxy provider (Phase 1, not built) -----------------------

  function createApiAnalyzer(config, categories) {
    const cfg = config || {};
    function notReady() {
      return Promise.reject(new Error("The backend analyzer is not configured yet (Phase 1)."));
    }
    return {
      id: "api",
      isLoaded: function () { return false; },
      load: notReady,
      analyze: function (documentText, handlers) {
        const h = handlers || {};
        const url = cfg.apiUrl || "";
        if (!url) return Promise.reject(new Error("ANALYZE.apiUrl is not set."));
        if (h.onStatus) h.onStatus("Sending document to the backend...");
        return fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: documentText, categoryIds: (categories || []).map((c) => c.id) }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("Analyzer backend returned " + res.status + ".");
            return res.json();
          })
          .then((data) => ({ suggestions: resolveParse().parseSuggestions(JSON.stringify(data), categories), raw: JSON.stringify(data) }));
      },
      dispose: function () { return Promise.resolve(); },
    };
  }

  // ---- On-device provider (wllama) ---------------------------------------

  function createWllamaAnalyzer(config, categories) {
    const cfg = config || {};
    let engine = null;
    let loaded = false;
    let loadingPromise = null;

    function onProgressAdapter(handlers) {
      return function (p) {
        if (!handlers || !handlers.onProgress) return;
        const loadedBytes = p && typeof p.loaded === "number" ? p.loaded : 0;
        const totalBytes = p && typeof p.total === "number" ? p.total : 0;
        const percent = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0;
        handlers.onProgress({ phase: "download", loaded: loadedBytes, total: totalBytes, percent: percent });
      };
    }

    function load(handlers) {
      if (loaded) return Promise.resolve();
      if (loadingPromise) return loadingPromise;
      const h = handlers || {};
      loadingPromise = Promise.resolve()
        .then(() => {
          if (h.onStatus) h.onStatus("Loading analysis engine...");
          return import(absoluteUrl(cfg.moduleUrl || "js/vendor/wllama/index.min.js"));
        })
        .then((mod) => {
          const Wllama = mod.Wllama || (mod.default && mod.default.Wllama);
          if (!Wllama) throw new Error("Could not load the wllama engine module.");
          engine = new Wllama({ default: absoluteUrl(cfg.wasmUrl || "js/vendor/wllama/wasm/wllama.wasm") }, { allowOffline: true, suppressNativeLog: true });
          if (h.onStatus) h.onStatus("Downloading model (first run only)...");
          const params = { n_ctx: cfg.contextSize || 4096, progressCallback: onProgressAdapter(h) };
          if (typeof cfg.gpuLayers === "number") params.n_gpu_layers = cfg.gpuLayers;
          return engine.loadModelFromHF({ repo: cfg.modelRepo, file: cfg.modelFile }, params);
        })
        .then(() => {
          loaded = true;
          if (h.onStatus) h.onStatus("Model ready.");
        })
        .catch((err) => {
          loadingPromise = null;
          throw err;
        });
      return loadingPromise;
    }

    function runCompletion(messages, h) {
      const base = { messages: messages, temperature: typeof cfg.temperature === "number" ? cfg.temperature : 0.1, max_tokens: cfg.maxTokens || 900 };

      function streamOnce(extra) {
        let full = "";
        return engine
          .createChatCompletion(Object.assign({}, base, extra, { stream: true }))
          .then((stream) => {
            if (!stream || typeof stream[Symbol.asyncIterator] !== "function") return null;
            return (async () => {
              for await (const chunk of stream) {
                const delta = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
                const piece = delta && delta.content;
                if (piece) { full += piece; if (h.onToken) h.onToken(piece); }
              }
              return full;
            })();
          })
          .catch(() => null);
      }

      return streamOnce({ response_format: { type: "json_object" } }).then((out) => {
        if (out !== null) return out;
        return streamOnce({}).then((out2) => {
          if (out2 !== null) return out2;
          return engine.createChatCompletion(base).then((res) => {
            const content = res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content;
            const text = typeof content === "string" ? content : "";
            if (h.onToken && text) h.onToken(text);
            return text;
          });
        });
      });
    }

    return {
      id: "wllama",
      isLoaded: function () { return loaded; },
      load: load,
      analyze: function (documentText, handlers) {
        const h = handlers || {};
        return load(h).then(() => {
          if (h.onStatus) h.onStatus("Analyzing document...");
          const prompt = resolveParse().buildAnalysisPrompt(categories, documentText, { maxTokens: cfg.maxTokens });
          return runCompletion(prompt.messages, h).then((raw) => ({
            suggestions: resolveParse().parseSuggestions(raw, categories),
            raw: raw,
          }));
        });
      },
      dispose: function () {
        const e = engine;
        engine = null;
        loaded = false;
        loadingPromise = null;
        return e ? e.exit() : Promise.resolve();
      },
    };
  }

  function createAnalyzer(config, categories) {
    const provider = (config && config.provider) || "wllama";
    if (provider === "mock") return createMockAnalyzer(config, categories);
    if (provider === "api") return createApiAnalyzer(config, categories);
    return createWllamaAnalyzer(config, categories);
  }

  return {
    createAnalyzer: createAnalyzer,
    createMockAnalyzer: createMockAnalyzer,
    createApiAnalyzer: createApiAnalyzer,
    createWllamaAnalyzer: createWllamaAnalyzer,
    isWebGpuAvailable: isWebGpuAvailable,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Analyzer;
}
