# Security policy — BijliBureau

- Core verdict path: **zero npm runtime dependencies** (see `SBOM.json`). No transitive CVE surface.
- Report vulnerabilities to **support@batteryforensics.in** — 7-day triage SLA.
- Evidence integrity: SHA-256 always; optional Ed25519 detached signatures (key at `/.well-known/bijlibureau-key.json`, rotation logged in `corrections.html`).
- Headers on prod: CSP (self + pinned CDNs), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera self), HSTS.
- Vault: IndexedDB origin-private; AES-GCM passphrase opt-in for dealers; magic-link SSO-lite (no passwords).
- Do not include other people's VINs/photos in reports.
