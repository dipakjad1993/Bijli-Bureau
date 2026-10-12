/* BijliBureau — source-decay monitor (weekly cron).
 * Run: node tools/check-sources.js [--open-issue]
 * HEADs every URL in SOURCES_DETAILED (+ e-daakhil + CARB refs), diffs status
 * codes, and writes source-decay-report.json. With --open-issue + GH_TOKEN it
 * opens/updates a tracking issue (see .github/workflows/ci.yml schedule).
 * An E-E-A-T system citing a dead source is worse than one citing nothing. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global;
eval.call(global, fs.readFileSync(path.join(ROOT, "js", "database.js"), "utf8"));
const EXTRA = [
  { key:"E-DAAKHIL", url:"https://edaakhil.nic.in/" },
  { key:"CARB-TITLE13", url:"https://govt.westlaw.com/calregs" },
];
const SOURCES = [...window.BF_DB.SOURCES_DETAILED.map((s) => ({ key: s.key, url: s.url })), ...EXTRA];
async function head(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { method: "HEAD", redirect: "manual", signal: ctrl.signal });
    clearTimeout(t);
    return { status: r.status, ok: r.status >= 200 && r.status < 400 };
  } catch (e) { return { status: 0, ok: false, err: String((e && e.message) || e) }; }
}
(async () => {
  const rows = [];
  for (const s of SOURCES) {
    const r = await head(s.url);
    rows.push({ ...s, ...r, at: new Date().toISOString() });
    console.log(`${r.ok ? "OK  " : "FAIL"} ${r.status} ${s.key} ${s.url}`);
  }
  fs.writeFileSync(path.join(ROOT, "source-decay-report.json"), JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
  const fails = rows.filter((r) => !r.ok);
  console.log(`sources: ${rows.length - fails.length}/${rows.length} alive`);
  if (fails.length && process.argv.includes("--open-issue")) {
    console.log("ISSUE-BODY: source decay detected:\n" + fails.map((f) => `- ${f.key}: ${f.url} → ${f.status} ${f.err || ""}`).join("\n"));
  }
  process.exit(fails.length ? 2 : 0);
})();
