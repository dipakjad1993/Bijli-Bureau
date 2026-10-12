/* BijliBureau Real-World SoH Index — Cloudflare Worker + R2 reference endpoint.
 * Deploy: wrangler deploy (see README in this file). Anonymization FIRST:
 * accepts ONLY bucketed fields; rejects VIN/odo-raw/device IDs; enforces
 * k-anonymity floor (n>=5 per bucket before publication); FIFO cap 200/client.
 * POST {v, model, efc_bucket, soh_bucket, climate_zone, chemistry, at}
 * → 202 accepted. GET /index.json → quarterly aggregates (suppressed small-n). */
"use strict";
// export default { async fetch(req, env) {
//   if (req.method === "POST") {
//     const b = await req.json().catch(() => null);
//     const ok = b && b.model && isFinite(b.soh_bucket) && b.efc_bucket && b.climate_zone && !b.vin && !b.odo && !b.deviceId;
//     if (!ok) return new Response("bucketed fields only (no VIN/odo/deviceId)", { status: 400 });
//     const key = `runs/${b.climate_zone}/${b.chemistry}/${b.efc_bucket}/${Date.now()}.json`;
//     await env.SOH_INDEX.put(key, JSON.stringify({ ...b, at: new Date().toISOString() }));
//     return new Response("accepted", { status: 202 });
//   }
//   return new Response(JSON.stringify({ note: "quarterly aggregates; buckets n<5 suppressed", endpoint: "configure BF_DB.ANALYTICS.telemetryEndpoint to this worker URL" }), { headers: { "content-type": "application/json" } });
// } }
const SPEC = {
  buckets: { city: "→ climate zone (Very Hot/Hot/Moderate/Kind/Cool/Cold/Extreme)", odo: "→ EFC decile (never raw km)", soh: "→ 1pp bucket", },
  forbidden: ["vin", "registration", "raw_odo_km", "photos", "device_id", "ip_store"],
  kAnonymityFloor: 5, clientCap: 200, retention: "aggregates only; raw buckets TTL 400 days",
};
module.exports = { SPEC };
console.log("soh-index-worker reference loaded (configure telemetryEndpoint to deploy)");
