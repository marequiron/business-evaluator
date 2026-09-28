/**
 * serve.js
 * Zero-dependency static file server for local use. Run with:
 *   node serve.js            (then open http://localhost:4173/)
 *   PORT=8080 node serve.js  (PowerShell: $env:PORT=8080; node serve.js)
 *   HOST=0.0.0.0 node serve.js  (explicitly bind all interfaces — see below)
 *
 * Security baseline:
 *   - Defaults to 127.0.0.1 (local machine only), NOT 0.0.0.0. Set HOST to
 *     override, e.g. only when you intentionally expose the server.
 *   - Serves only files inside this folder; traversal is rejected with 403.
 *   - Malformed URL encoding is rejected with 400 instead of crashing.
 *   - Replies carry basic security headers (CSP, nosniff, referrer, framing).
 *
 * Only serves files from this folder; keeps the project dependency-free so
 * `npm start` (npx serve) is never strictly required.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

function createServer(rootDir) {
  const root = path.resolve(rootDir || __dirname);

  const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".wasm": "application/wasm",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
  };

  function isInside(base, target) {
    const rel = path.relative(base, target);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  }

  return http.createServer((req, res) => {
    function respond(status, type, body, headers) {
      res.writeHead(status, Object.assign({ "Content-Type": type }, headers));
      res.end(body);
    }

    function securityHeaders() {
      return {
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
          "connect-src 'self' ipc: http://ipc.localhost https://huggingface.co " +
          "https://cdn-lfs.huggingface.co https://*.hf.co; " +
          "object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Frame-Options": "DENY",
      };
    }

    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    } catch (e) {
      respond(400, "text/plain", "Bad request", securityHeaders());
      return;
    }

    let filePath = path.normalize(path.join(root, urlPath === "/" ? "index.html" : urlPath));

    if (!isInside(root, filePath)) {
      respond(403, "text/plain", "Forbidden", securityHeaders());
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isDirectory()) filePath = path.join(filePath, "index.html");
      if (!isInside(root, filePath)) {
        respond(403, "text/plain", "Forbidden", securityHeaders());
        return;
      }
      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          respond(404, "text/plain", "Not found", securityHeaders());
          return;
        }
        respond(200, TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream", data, securityHeaders());
      });
    });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const root = __dirname;
  const port = process.env.PORT ? Number(process.env.PORT) : 4173;
  const host = process.env.HOST || "127.0.0.1";
  const server = createServer(root);
  server.listen(port, host, () => {
    console.log("Business Self-Evaluation Tool running at http://" + (host === "0.0.0.0" || host === "::" ? "localhost" : host) + ":" + port + "/");
  });
}