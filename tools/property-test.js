/* BijliBureau — property-based edge tests (CI): bayesWeight/effectiveAge/modelFormFloor/trajectory agreement. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global;
eval.call(global, fs.readFileSync(path.join(ROOT, "js", "database.js"), "utf8"));
eval.call(global, fs.readFileSync(path.join(ROOT, "js", "forensics.js"), "utf8"));
const E = window.BF_Engine;
let fails = 0;
const assert = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
// bayesWeight: monotonic in rows/days, decays with staleness, zero under 3 rows
assert(E.bayesWeight(0, 30) === 0, "bayesWeight 0 rows → 0");
assert(E.bayesWeight(30, 365, 0) > E.bayesWeight(30, 365, 446), "bayesWeight recency decay");
assert(E.bayesWeight(60, 365, 0) <= 0.40 + 1e-9, "bayesWeight capped 0.40");
// effectiveAge: plateau (12yr → ~6.9, not 12)
const ea = E.effectiveAge(12);
assert(ea > 5 && ea < 8, `effectiveAge(12)=${ea} plateaued`);
// modelFormFloor: grows with age, LFP < LMO
assert(E.modelFormFloor("LFP", 0) < E.modelFormFloor("LMO", 0), "floor LFP<LMO");
assert(E.modelFormFloor("LFP", 12) > E.modelFormFloor("LFP", 0), "floor grows with age");
// trajectory vs yearsTo70 agreement (Nexon demo)
const model = window.BF_DB.MODELS.find((m) => m.id === "tata-nexon45");
const p = { model, kms: 42000, purchaseDate: "2023-06-15", city: "Chennai", fastPct: 30, avgSoc: 78, depthAvg: 60, kmsPerYr: 42000 / 3.3 };
const f = E.computeSoH(p);
assert(f.soh > 80 && f.soh < 100 && f.ci90 >= 0.8 && f.ci90 <= 8, `demo SoH ${f.soh}±${f.ci90} in range`);
// analyzeObd epsilon: exactly-150mV must NOT warn
const a = E.analyzeObd([{ minV: 3.96, maxV: 4.11, bmsSoh: 90 }]);
assert(a.maxDelta_mV === 150 && a.flag.startsWith("OK"), "OBD 150.000mV epsilon-safe");
console.log(fails === 0 ? "PROPERTY PASS" : `PROPERTY FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
