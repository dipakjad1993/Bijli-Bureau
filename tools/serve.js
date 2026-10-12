/* BijliBureau — zero-dependency static server (ships in repo).
 * Usage: node tools/serve.js [port]   (default 8741, serves repo root)
 * Serves extensionless + directory URLs (…/warranty/leaf40/ → index.html),
 * correct MIME types, no directory listings, path-traversal guarded. */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const PORT = +(process.argv[2] || 8741);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
function resolve(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  if (p.includes("\0")) return null;
  let fp = path.normalize(path.join(ROOT, p === "/" ? "/index.html" : p));
  if (!fp.startsWith(ROOT)) return null;
  try {
    const st = fs.statSync(fp);
    if (st.isDirectory()) fp = path.join(fp, "index.html");
  } catch (e) {
    if (fs.existsSync(fp + ".html")) fp = fp + ".html";
    else if (fs.existsSync(path.join(fp, "index.html"))) fp = path.join(fp, "index.html");
    else return null;
  }
  return fs.existsSync(fp) ? fp : null;
}
http.createServer((req, res) => {
  const fp = resolve(req.url || "/");
  if (!fp) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("404 — " + req.url); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store" });
  fs.createReadStream(fp).pipe(res);
}).listen(PORT, "127.0.0.1", () => console.log("BijliBureau on http://localhost:" + PORT + "/"));
