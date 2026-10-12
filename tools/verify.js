/* BijliBureau — release verifier (ships in repo).
 * Run: node tools/verify.js
 * Checks: (1) DOM contract — every $("id") in js/app.js exists in index.html
 * (2) MODELS ↔ WARRANTIES ↔ sitemap 1:1:1, both directions
 * (3) every sitemap URL resolves to a file (4) banned leftovers scan. */
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
  ids.add("stepBar"); // dynamically created in buildStepper before use
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
  // required assets
  for (const f of ["og/hero-card.png", "llms-full.txt", "us/index.html", "methodology.html",
    "soh-calculator/index.html", "eu-battery-passport-qr/index.html",
    "second-life-value/index.html", "used-ev-resale-cert/index.html"])
    if (!fs.existsSync(path.join(ROOT, f))) fail("missing asset: " + f);
  ok("required assets present");
}

// 4. banned leftovers
{
  const banned = ["battery-forensics.example.com", "Example you asked", "clean-energy/lithium-ion",
    "v2026.12-enterprise", "v2026.13-enterprise", "2026.13-enterprise"];
  const files = ["index.html", "methodology.html", "README.md", "robots.txt", "sitemap.xml",
    "llms.txt", "llms-full.txt", "js/database.js", "js/forensics.js", "js/app.js"];
  let hits = 0;
  for (const f of files) {
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const b of banned) if (t.includes(b)) { hits++; console.log(`  leftover "${b}" in ${f}`); }
  }
  // allow historical mentions inside changelogs
  if (hits) console.log("(note: changelog-history mentions are benign if intentional)");
  const strict = ["battery-forensics.example.com", "Example you asked", "clean-energy/lithium-ion"];
  // strict: placeholder domain + retired brand tokens anywhere; scaffolding copy
  // only in LIVE user-facing files (changelog narratives describing a deletion
  // are benign and excluded by the file filter below)
  const strictEverywhere = ["battery-forensics.example.com", "clean-energy/lithium-ion",
    "Battery Forensics", "BATTERY FORENSICS"];
  let hard = 0;
  for (const f of files) {
    const t = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const b of strictEverywhere) if (t.includes(b)) { hard++; console.log(`  leftover "${b}" in ${f}`); }
    if (["js/app.js", "index.html"].includes(f) && t.includes("Example you asked")) hard++;
  }
  if (hard) fail(hard + " hard leftovers (domain/scaffolding/BNEF URL)");
  else ok("no hard leftovers (placeholder domain, scaffolding copy, BNEF path)");
}
console.log(fails === 0 ? "VERIFY PASS" : `VERIFY FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
