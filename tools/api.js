/* BijliBureau — static API shim + dealer SSO-lite (magic-link, no passwords).
 * api(): pure-function wrapper around js/forensics.js for edge/server use.
 * dealerAuth: magic-link issuance + per-dealer audit log (feeds SoH Index w/ consent).
 * Wire to Cloudflare Worker / Vercel Edge; CORS-restrict to dealer domains; rate-limit by key. */
"use strict";
function verdict(p) {
  const DB = global.window ? global.window.BF_DB : window.BF_DB;
  const E = global.window ? global.window.BF_Engine : window.BF_Engine;
  const f = E.computeSoH(p);
  const w = E.warrantyVerdict(p, f);
  return { soh: f.soh, ci90: f.ci90, grade: DB.gradeOf(f.soh), warranty: w.status, soce_kwh: f.usableNow, lifecycle: f.soh > 70 ? "reuse" : "ess/recycle" };
}
const dealerAuth = {
  issueMagicLink: (email) => ({ email, token: "ml-" + Date.now().toString(36), exp: Date.now() + 15 * 60 * 1000 }),
  auditLog: [],
  logRun: (dealer, runId) => dealerAuth.auditLog.push({ dealer, runId, at: new Date().toISOString() }),
};
if (typeof module !== "undefined") module.exports = { verdict, dealerAuth };
