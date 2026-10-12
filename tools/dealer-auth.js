// BijliBureau — dealer SSO-lite reference (magic-link, no passwords).
// Flow: POST /auth/magic {email, dealerId} → emailed link (15-min) → GET /auth/callback → session cookie (httpOnly, SameSite=Lax) → per-dealer audit log of runs.
export function issueMagicLink(email, dealerId) {
  return { email, dealerId, token: "ml-" + Date.now().toString(36), exp: Date.now() + 15 * 60 * 1000 };
}
