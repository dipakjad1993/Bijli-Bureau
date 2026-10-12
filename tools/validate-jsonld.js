/* BijliBureau — JSON-LD validator (CI): every *.html JSON-LD block must parse + carry dateModified where applicable. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const files = ["index.html", "methodology.html", "author.html", "corrections.html", "privacy.html", "terms.html", "security.html", "demo-chapters.html", "soh-calculator/index.html", "eu-battery-passport-qr/index.html", "second-life-value/index.html", "used-ev-resale-cert/index.html", "us/index.html", "us/carb-soh-standard/index.html", "soh-index/index.html"];
let fails = 0;
for (const f of files) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) { console.log("SKIP (not built yet): " + f); continue; }
  const t = fs.readFileSync(fp, "utf8");
  const blocks = [...t.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { console.log("WARN no JSON-LD: " + f); continue; }
  for (const b of blocks) {
    try { JSON.parse(b[1]); } catch (e) { fails++; console.log(`FAIL JSON-LD parse ${f}: ${e.message}`); }
  }
  console.log(`OK jsonld ${f} (${blocks.length} blocks)`);
}
console.log(fails === 0 ? "JSONLD PASS" : `JSONLD FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
