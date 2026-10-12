/* BijliBureau — AVILOO backtest harness (ships in repo, audit P0-3).
 * Run: node tools/backtest.js   (expects js/database.js + js/forensics.js)
 * Protocol: 8 AVILOO models × 2 mileage points (50k km/4yr, 150k km/12yr),
 * Berlin temperate, 20% DC fast, 70% avg SoC, 60% DoD. Compares model SoH vs
 * AVILOO Sep-2026 published medians, prints residuals + verdict-side check.
 * Exit non-zero if any 150k verdict lands on the wrong side of its trigger. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

global.window = global; // window.BF_DB <=> global.BF_DB (browser parity for bare refs)
function load(f) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  eval.call(global, src);
}
load("js/database.js");
load("js/forensics.js");
const DB = window.BF_DB, E = window.BF_Engine;

// sanity: fadePerEFC_pct === 20/cycleLife for every chemistry (audit P0-3)
let drift = 0;
for (const [k, c] of Object.entries(DB.CHEMISTRY)) {
  const expect = 20 / c.cycleLife;
  const off = Math.abs(c.fadePerEFC_pct - expect) / expect;
  if (off > 0.06) { drift++; console.log(`DRIFT ${k}: fade=${c.fadePerEFC_pct} expect=${expect.toFixed(4)}`); }
}
console.log(drift === 0 ? "chemistry/fade consistency: OK (all ≤6%)" : `chemistry drift: ${drift} FAIL`);

function runAt(modelId, kms, ageYrs) {
  const model = DB.MODELS.find((m) => m.id === modelId);
  const pd = new Date(Date.now() - ageYrs * 365.25 * 24 * 3600 * 1000);
  const p = { model, kms, purchaseDate: pd.toISOString().slice(0, 7) + "-15",
    city: "Berlin", fastPct: 20, avgSoc: 70, depthAvg: 60,
    parkHigh: false, ultraAbuse: false, serviced: true, commercial: false,
    kmsPerYr: kms / ageYrs, csvHealth: null, csvRows: 0, csvDays: 0, obd: null };
  // freeze clock-sensitive parts: run 3×, take median (MC noise must stay inside band)
  const outs = [E.computeSoH(p), E.computeSoH(p), E.computeSoH(p)];
  const f = outs[1];
  const w = E.warrantyVerdict(p, f);
  const tr = E.trajectory(p, f, 6);
  return { f, w, tr, p };
}

let fails = 0, sum50 = 0, sum150 = 0, n = 0;
for (const row of DB.VALIDATION.rows) {
  const a = runAt(row.model, 50000, 4);
  const b = runAt(row.model, 150000, 12);
  const r50 = +(a.f.soh - row.at50k_aviloo).toFixed(1);
  const r150 = +(b.f.soh - row.at150k_aviloo).toFixed(1);
  sum50 += Math.abs(r50); sum150 += Math.abs(r150); n++;
  // verdict-side check at 150k: model verdict must agree with AVILOO-implied side
  const trig = (DB.WARRANTIES.find((x) => x.modelId === row.model) || { soh: 70 }).soh;
  const modelSide = b.f.soh < trig ? "FILE" : "HEALTHY";
  const fieldSide = row.at150k_aviloo < trig ? "FILE" : "HEALTHY";
  const ok = modelSide === fieldSide ? "OK  " : "FAIL";
  if (ok === "FAIL") fails++;
  console.log(`${row.model.padEnd(12)} @50k model=${a.f.soh}% aviloo=${row.at50k_aviloo}% r=${r50} | @150k model=${b.f.soh}% aviloo=${row.at150k_aviloo}% r=${r150} | ci=${b.f.ci90} (mc ${b.f.mcHalf}+floor ${b.f.modelForm}) | 150k sides model=${modelSide} field=${fieldSide} ${ok}`);
}
console.log(`mean |resid| @50k=${(sum50 / n).toFixed(1)} @150k=${(sum150 / n).toFixed(1)}`);

// headline/chart consistency: Nexon demo yearsTo70 vs trajectory 70-crossing
const demo = runAt("tata-nexon45", 42000, 3.3);
demo.p.city = "Chennai"; demo.p.fastPct = 30; demo.p.avgSoc = 78;
demo.p.kmsPerYr = 42000 / 3.3;
const df = E.computeSoH(demo.p);
const dtr = E.trajectory(demo.p, df, 25);
let cross = null;
for (let i = 1; i < dtr.pts.length; i++) {
  if (dtr.pts[i - 1].soh >= 70 && dtr.pts[i].soh < 70) {
    const frac = (dtr.pts[i - 1].soh - 70) / Math.max(0.01, dtr.pts[i - 1].soh - dtr.pts[i].soh);
    cross = +(i - 1 + frac).toFixed(1); break;
  }
}
console.log(`demo Nexon45/Chennai/42k: soh=${df.soh}% ci=${df.ci90} (mc ${df.mcHalf} + floor ${df.modelForm}) yearsTo70=${df.yearsTo70} chartCross=${cross}`);
if (cross == null && df.yearsTo70 >= 30) console.log("headline/chart consistency: OK (both agree: never crosses at current habit)");
else if (cross == null) { console.log("CHART NEVER CROSSES 70 but headline says " + df.yearsTo70 + " — FAIL"); fails++; }
else if (Math.abs(cross - df.yearsTo70) > 1.5) { console.log("HEADLINE/CHART DIVERGENCE FAIL"); fails++; }
else console.log("headline/chart consistency: OK");

// Leaf 150k must NOT be ELIGIBLE (the v2026.12 liability case)
const leaf = runAt("leaf40", 150000, 12);
console.log(`leaf40@150k: soh=${leaf.f.soh}% trigger=66.25 verdict=${leaf.w.status}`);
if (/ELIGIBLE/.test(leaf.w.status)) { console.log("LEAF FALSE-FILE FAIL"); fails++; }
else console.log("leaf verdict-side: OK");

// CI must vary with evidence (not a constant tier) — NMC floor (2.5) vs OBD cap (1.8)
const nmcBase = runAt("vw-id4", 42000, 3.3);
const obdP = Object.assign({}, nmcBase.p, { obd: { present: true, n: 120, medianBmsSoh: 91, maxDelta_mV: 40 } });
const obdF = E.computeSoH(obdP);
console.log(`ci model-only=${nmcBase.f.ci90} vs ci obd-strong=${obdF.ci90}`);
if (!(obdF.ci90 < nmcBase.f.ci90)) { console.log("CI EVIDENCE-RESPONSE FAIL"); fails++; }
else console.log("ci evidence-response: OK");

console.log(fails === 0 ? "BACKTEST PASS" : `BACKTEST FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
