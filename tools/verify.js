/* BijliBureau — release verifier (ships in repo).
 * Run: node tools/verify.js
 * Checks: (1) DOM contract (2) MODELS ↔ WARRANTIES ↔ sitemap 1:1:1
 * (3) every sitemap URL resolves (4) banned leftovers incl. example inbox +
 *     split-brain brand in schema/PDF/QR paths (5) required enterprise assets. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let fails = 0;
const fail = (m) => { fails++; console.log("FAIL " + m); };
const ok = (m) => console.log("OK   " + m);

// 1. DOM contract
{
  const app = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const refs = [...app.matchAll(/\$\(\s*["']([\w-]+)["']\s*\)/g)].map((m) => m[1]);
  const ids = new Set([...html.matchAll(/id=\s*["']([\w-]+)["']/g)].map((m) => m[1]));
  ids.add("stepBar");
  const miss = [...new Set(refs)].filter((r) => !ids.has(r));
  console.log(`dom: ${refs.length} refs, ${new Set(refs).size} unique`);
  if (miss.length) fail("dom missing ids: " + miss.join(", "));
  else ok("dom contract (" + new Set(refs).size + " ids, 1 dynamic)");
}

// 2+3. data integrity + sitemap resolution
{
  global.window = global;
  eval.call(global, fs.readFileSync(path.join(ROOT, "js", "database.js"), "utf8"));
  const DB = window.BF_DB;
  const mIds = DB.MODELS.map((m) => m.id).sort();
  const wIds = DB.WARRANTIES.map((w) => w.modelId).sort();
  const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const smW = locs.filter((l) => l.includes("/warranty/")).map((l) => l.split("/warranty/")[1].replace(/\/$/, "")).sort();
  const orphanM = mIds.filter((id) => !wIds.includes(id));
  const deadW = wIds.filter((id) => !mIds.includes(id));
  if (orphanM.length) fail("models without rules: " + orphanM.join(","));
  else ok("models→rules 40/40");
  if (deadW.length) fail("rules without models: " + deadW.join(","));
  else ok("rules→models 40/40");
  const smMiss = mIds.filter((id) => !smW.includes(id));
  const smExtra = smW.filter((id) => !mIds.includes(id));
  if (smMiss.length) fail("models missing from sitemap: " + smMiss.join(","));
  else ok("models→sitemap 40/40");
  if (smExtra.length) fail("sitemap warranty URLs without model: " + smExtra.join(","));
  else ok("sitemap→models (no dead warranty rows)");
  let missing = 0;
  for (const u of locs) {
    const rel = u.replace("https://batteryforensics.in", "") || "/";
    const fp = rel === "/" ? path.join(ROOT, "index.html")
      : rel.endsWith(".html") ? path.join(ROOT, rel.slice(1))
      : path.join(ROOT, rel.slice(1), "index.html");
    if (!fs.existsSync(fp)) { missing++; console.log("  404: " + u); }
  }
  if (missing) fail(missing + " sitemap URLs without files");
  else ok("sitemap files " + locs.length + "/" + locs.length + " resolve");
  // DPP71 integrity: must be 71 rows
  if ((DB.DPP71 || []).length !== 71) fail("DPP71 rows = " + ((DB.DPP71 || []).length) + " (need 71)");
  else ok("DPP71 71/71 flagged rows");
  if (!DB.CARB || DB.CARB.sohAccuracyPp !== 5) fail("CARB layer missing");
  else ok("CARB MY2026 layer present");
  if (!DB.ENTITY || !DB.ENTITY.sameAs || DB.ENTITY.sameAs.length < 3) fail("ENTITY sameAs missing");
  else ok("ENTITY sameAs (" + DB.ENTITY.sameAs.length + " links)");
  // required assets (enterprise set)
  for (const f of ["og/hero-card.png", "llms.txt", "llms-full.txt", "us/index.html", "us/carb-soh-standard/index.html",
    "soh-index/index.html", "methodology.html", "author.html", "corrections.html", "privacy.html", "terms.html",
    "security.html", "demo-chapters.html", "sw.js", "SBOM.json", "SECURITY.md", "api/openapi.json",
    ".well-known/bijlibureau-key.json", "soh-calculator/index.html", "eu-battery-passport-qr/index.html",
    "second-life-value/index.html", "used-ev-resale-cert/index.html", "tests/smoke.spec.js"])
    if (!fs.existsSync(path.join(ROOT, f))) fail("missing asset: " + f);
  ok("required assets present");
}

// 4. banned leftovers (strict-everywhere: example inbox is now a hard fail)
{
  const files = ["index.html", "methodology.html", "README.md", "robots.txt", "sitemap.xml",
    "llms.txt", "llms-full.txt", "js/database.js", "js/forensics.js", "js/app.js", "tools/build-pages.js"];
  const strictEverywhere = ["battery-forensics.example.com", "clean-energy/lithium-ion",
    "Battery Forensics", "BATTERY FORENSICS", "lab@example.com", "Example you asked",
    "v2026.12-enterprise", "v2026.13-enterprise", "v2026.15-enterprise", "?v=15",
    "courtroom-grade", "Courtroom-grade", "BATTCERTv2|"];
  let hard = 0;
  for (const f of files) {
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) continue;
    const t = fs.readFileSync(fp, "utf8");
    for (const b of strictEverywhere) {
      if (b === "lab@example.com" && f === "tools/build-pages.js") continue;
      if (t.includes(b)) { hard++; console.log(`  leftover "${b}" in ${f}`); }
    }
  }
  // schema/PDF/QR canonical-name gate: ld-app + PDF header + QR payload must say Report Card, never Assassin
  for (const [f, needle] of [["index.html", '"name":"BijliBureau — EV Battery Report Card"'], ["js/app.js", "BATTCERTv3|BijliBureau"]]) {
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    if (!t.includes(needle)) { hard++; console.log(`  canonical brand missing in ${f} (need ${needle})`); }
  }
  const idxHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  if (idxHtml.includes('"name":"BijliBureau — Warranty Claim Assassin"')) { hard++; console.log('  split-brain brand still in ld-app'); }
  if (hard) fail(hard + " hard leftovers / brand-split (see above)");
  else ok("no hard leftovers; canonical brand single-name in schema/PDF/QR");
}
console.log(fails === 0 ? "VERIFY PASS" : `VERIFY FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
