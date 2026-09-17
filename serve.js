/**
 * serve.js
 * Zero-dependency static file server for local use. Run with:
 *   node serve.js            (then open http://localhost:4173/)
 *   PORT=8080 node serve.js  (PowerShell: $env:PORT=8080; node serve.js)
 *
 * Only serves files from this folder; keeps the project dependency-free so
 * `npm start` (npx serve) is never strictly required.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT ? Number(process.env.PORT) : 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let filePath = path.normalize(path.join(root, urlPath === "/" ? "index.html" : urlPath));

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, "index.html");
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log("Business Self-Evaluation Tool running at http://localhost:" + port + "/");
});
