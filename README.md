# ⚡ BijliBureau — EV Battery Report Card (Free, On-Device)

![CI](https://github.com/dipakjad1993/Bijli-Bureau/actions/workflows/ci/badge.svg)
![Static](https://img.shields.io/badge/site-100%25_static_·_no_build-blue)
![Privacy](https://img.shields.io/badge/privacy-on--device_·_no_upload-green)
![Coverage](https://img.shields.io/badge/warranty-40_OEM_rules-orange)
![License](https://img.shields.io/badge/use-supporting--evidence-lightgrey)

**The battery report card for EVs — free, and it understands chemistry.**

Snap 3 photos → upload service bill → optional charge-log CSV / OBD → get **SoH with honest 90% band (MC + field floor)**, **warranty verdict with exact clause**, **second-life value**, **resale band + DPP-ready QR cert (BATTCERTv3 + SOCE)**, and a **timestamped + SHA-256 hashed evidence PDF (optional Ed25519 detached signature)**. 2-wheelers + 4-wheelers. India-first, EU/US-aware. **100% on-device — nothing uploaded.**

🔴 **Live demo:** https://dipakjad1993.github.io/Bijli-Bureau/ &nbsp;·&nbsp; 📖 **Methodology:** [`methodology.html`](methodology.html) &nbsp;·&nbsp; 🗺️ **Sitemap:** [`sitemap.xml`](sitemap.xml) (54 URLs, all resolve)

> Backtested vs AVILOO Sep-2026 medians — **mean |residual| 1.5 pts @ 50k km, 1.8 pts @ 150k km**. Worst misses published, re-runnable: `node tools/backtest.js`.

---

## ✨ What it does (7 tabs, 1 page)

| # | Tab | What you get |
|---|-----|--------------|
| 1 | 📸 **Intake & Photos** | 3-photo upload + on-device OCR (Tesseract lazy-load), odo/SoC/VIN autofill, charge-log CSV + OBD (LeafSpy/Torque) parser, climate city + fast-% + abuse flags, DPDP/GDPR opt-in |
| 2 | 🔬 **SoH Lab** | Odometer-anchored EFC⁰·⁸⁵ + plateaued Arrhenius calendar, DoD/C-rate/SoC stress, CSV/OBD Bayesian fusion, raw + clamped SoH + honest 90% band, trajectory + breakdown charts, 11-chemistry fingerprint |
| 3 | ⚖️ **Warranty Verdict** | 40 OEM rules + DPP71 + CARB — ELIGIBLE / FILE-SOON / HEALTHY / EXPIRED + denial-risk audit + copy-paste claim letter with clause + CPA-2019 → e-daakhil escalation |
| 4 | 🔋 **Second-Life** | Usable kWh × home/fleet/recycle buyback (WoodMac H1-2026 ESS boom), live FX, refurb cost, BNEF Dec-2025 snapshot anchored |
| 5 | 🏷️ **Resale & Cert QR** | Age×km×battery-share price band, grade multiplier, certified +9%, BATTCERTv3 (SOCE + lifecycle status + access tiers) + DPPpre QR + SHA-256 + share link |
| 6 | 📕 **Evidence Pack** | Timestamped local PDF (photos, OCR, method, clause, trajectory ±band, QR, hash, consent, pre-passport notice, optional detached signature) + IndexedDB vault (AES-GCM passphrase opt-in) |
| 7 | 📚 **Market Intel** | BNEF / AVILOO / Geotab / WoodMac data room + live FX & ambient overrides + competitor teardown |

Deep-linkable: `#/intake #/soh #/warranty #/second #/resale #/evidence #/intel` · Share: `?r=<b64>#/warranty` (30-day expiry, minimal PII) · Dealer embed: `?embed=1`

## 🚀 Quick start (no build, no server)

```bash
git clone https://github.com/dipakjad1993/Bijli-Bureau.git
cd Bijli-Bureau

# Option A — just open it (file:// works, http://localhost recommended so sample CSVs load)
npx serve .          # or: python3 -m http.server 8080
# → http://localhost:3000  (or :8080)

# Option B — Node helper
node tools/serve.js
```

1. Click **⚡ Load demo (Nexon.ev Chennai)** — all 7 tabs fill with real data.
2. Edit Step 1 with your vehicle → **RUN FULL FORENSIC**.
3. Copy share link / download evidence PDF / scan cert QR.

## ✅ Verify (this is what CI runs — green commits only)

```bash
node --check js/database.js js/forensics.js js/app.js   # syntax
node tools/backtest.js       # BACKTEST PASS — AVILOO residuals + verdict sides + headline/chart + chemistry consistency
node tools/property-test.js  # PROPERTY PASS — bayesWeight/effectiveAge/floor/OBD-epsilon edge cases
node tools/verify.js         # VERIFY PASS — 40/40 models↔rules, 54/54 sitemap resolve, DPP71 71/71, CARB, entity sameAs, no placeholders
node tools/validate-jsonld.js # JSONLD PASS — every page's structured data parses
node tools/build-pages.js    # regenerates 40 warranty + 6 pillars + us/ + CARB + SoH Index + sitemap.xml + llms-full.txt
```

Latest verified run (2026-10-12): `BACKTEST PASS` · `PROPERTY PASS` · `VERIFY PASS` · `JSONLD PASS` · `BUILD-PAGES PASS`.
Demo probe: Nexon.ev Chennai 42k km → **SoH ~93.9% ±1.8%, Grade A+, heat gap ×~1.38 @78% LFP**.

## 🧠 How SoH is computed (honest, published)

```
EFC           = odo_km / certified_range_new_km        (odometer-anchored; CSV never extrapolates EFC)
cycleFade%    = EFC^0.85 × (20/cycleLife) × DoDstress × CrateStress
calendarFade% = eff-age × baseRate(chemistry) × Arrhenius(Tpack, Ea) × SoCstress
  eff-age     = age≤2 ? age : 2+(age−2)^0.70 · live ambient nudges Tpack ±1.75 °C max
Arrhenius     = exp[(Ea/R)(1/298.15 − 1/Tpack)] · R = 8.314 J/mol·K
CSV health    vs DRIVER baseline, recency decay exp(−staleDays/540)
Bayesian fuse: w_csv ≤ 0.40 (decayed), dash-range w = 0.15, OBD BMS w = min(0.80, 0.5+n/200)
90% band      = √(MC² + chemistry field-floor²), n = 600 (odo ±2%, T ±1.5 °C, age ±15 d — all really sampled)
OBD           cell ΔV rounded BEFORE compare; >150 mV WARN, >250 mV CRITICAL
```

- **Band honesty:** model-only LFP ≈ ±1.8% young → 12-yr NMC ≈ ±3.7%; strong OBD tightens to ≤ ±1.8%. Band *moves* with evidence (asserted in backtest).
- **Fingerprint:** 11 chemistries (LFP / NMC622 / NMC811 / NCA / LMO / LMFP / Na-ion / LTO + NMC9-Si / Semi-solid / Na-G2) with flat-vs-slope logic + module-fail flag.
- **Misses published:** Ioniq 5 −4.1 @150k, Zoe +3.5 @50k, Model 3 +2.8 @50k — **no 150k verdict on the wrong side of its trigger** (harness-asserted).

Full equations + residual tables + CARB/DPP layers + KPI stack + competitive teardown: [`methodology.html`](methodology.html) (§6 backtest, §12 competition, §15 CARB, §16 DPP v2, §18 KPIs).

## ⚖️ Warranty coverage (40 rules, clause-level)

Tata Lifetime 15-yr (Jul-2025 + Oct-2025 full-range extension, 70%→restore 80%, booklet-year check) · Ola base 3yr/50k + 2026 free 8yr/70k + paid 8yr/80–125k top-ups (**S1 X 2 kWh hard-blocked**) · Ather / TVS / Vida / Chetak · MG / Mahindra / BYD / Hyundai · Tesla / VW / Leaf (~66.25% bars) / Bolt (~60%) + more.

Each rule ships with **source URL + verified date + confidence** (`js/database.js:SOURCES_DETAILED`). Rulebook browser works before you run. Evidence auto-clears on model change. Claim letter ends with the CPA-2019 → [e-daakhil](https://edaakhil.nic.in/) (helpline 1915) filing path. Warranty text is paraphrase — verify your booklet.

## 📁 Project structure

```
index.html  methodology.html  sitemap.xml (54 URLs)  robots.txt  llms.txt  llms-full.txt (generated)
author.html  corrections.html  privacy.html  terms.html  security.html  demo-chapters.html
manifest.webmanifest  sw.js (PWA)  icon.svg  icons/  og/hero-card.png
SBOM.json  SECURITY.md  api/openapi.json  .well-known/bijlibureau-key.json
sample-charge-log.csv  sample-obd-log.csv
css/styles.css (print + embed + contrast + QR-print)
js/database.js    (40 models + 40 rules + 11 chemistries + VALIDATION + DPP71 + CARB + ENTITY + LIVE + fmtMoney)
js/forensics.js   (computeSoH, trajectory, verdicts, second-life, resale, QR)
js/app.js         (hash router + ?r= share + vault + dataLayer/GA4-opt + lazy OCR/libs + DPP QR v3 + Ed25519 signatures)
tools/backtest.js (AVILOO harness — the accuracy proof)
tools/property-test.js (bayesWeight/effectiveAge/floor/OBD-epsilon edge tests)
tools/build-pages.js (regenerates 40 warranty + 6 pillars + us/ + CARB + SoH Index + sitemap + llms-full)
tools/verify.js   (static-site integrity gate: DOM + 1:1:1 + DPP71 + CARB + entity + brand-split)
tools/validate-jsonld.js (structured-data CI gate)
tools/check-sources.js (weekly SOURCES_DETAILED HEAD-check + decay report)
tools/soh-index-worker.js (Cloudflare Worker + R2 reference for opt-in SoH Index)
tools/generate-key.js + tools/verify-signature.js (Ed25519 evidence keys)
tools/api.js + tools/dealer-auth.js (static API shim + magic-link SSO-lite)
tools/og.js       (zero-dep OG PNG renderer)
tests/smoke.spec.js (Playwright 7-tab flow)
warranty/<40 modelIds>/  soh-calculator/  eu-battery-passport-qr/ (71-row Map v2)  second-life-value/
used-ev-resale-cert/  us/  us/carb-soh-standard/  soh-index/
```

> Generated pages: edit the DB (`js/database.js`), then `node tools/build-pages.js` — never hand-edit generated HTML.

## 🌐 SEO / sharing / deploy

- Canonical production domain: `batteryforensics.in` (OG, hreflang, JSON-LD: SoftwareApplication + Organization/sameAs + HowTo + VideoObject + WebPage/speakable + FAQ + Dataset + Product + Breadcrumb). GitHub Pages mirror here is the public demo.
- `sitemap.xml` 54/54 resolve · `robots.txt` (retrieval-bot allowlist) · `llms.txt` + `llms-full.txt` (LLM/crawler surface) · `og/hero-card.png` ships · `?embed=1` dealer mode · print CSS with 25 mm QR.
- Deploy checklist: host domain → set `BF_DB.ANALYTICS.ga4Id` + GSC + sitemap → set telemetry endpoint → claim YouTube Preferred Source → quarterly recalibration + rebuild. Report issues via [GitHub Issues](https://github.com/dipakjad1993/Bijli-Bureau/issues) (7-day SLA).

## 🏢 Enterprise surfaces

- **Signed evidence:** SHA-256 always; optional Ed25519/ECDSA detached signature, key at `/.well-known/bijlibureau-key.json`, verify via `node tools/verify-signature.js`. Until a key is configured the UI honestly says "timestamped + SHA-256 hashed" — never "signed".
- **API:** static OpenAPI shim at `api/openapi.json` (`POST /api/v1/forensic` → `{soh, ci, grade, warranty, qr, hash, soce_kwh}`; rate-limited, key-authed, CORS-restricted at the edge).
- **Dealer SSO-lite:** magic-link (no passwords) + per-dealer audit log (`tools/dealer-auth.js`, `tools/api.js`).
- **Offline-first PWA:** `sw.js` (cache-first shell+DB, network-first FX) + manifest.
- **Compliance:** zero-dep core (`SBOM.json`), CSP/Referrer/Permissions metas, `privacy.html` (DPDP/GDPR) + `terms.html` + `security.html` + `corrections.html` (7-day SLA).
- **2026 KPI stack:** citation share (50-prompt matrix) · GSC generative-AI report · brand demand · tool-vs-article CTR · `check-sources.js` decay count · opt-in runs/day · share/PDF/vault/embeds. Rank is a leading indicator, not the outcome (`methodology.html` §18).

## 🤝 Contributing

PRs welcome — especially warranty-clause corrections (with source URL + booklet year) and field SoH pairs for recalibration. Run `node tools/backtest.js && node tools/property-test.js && node tools/verify.js` before pushing; CI must stay green.

## ⚠️ Disclaimer

Supporting evidence only — **not legal advice**. Always demand OEM BMS SoH in writing and verify against your booklet year. Battery text is paraphrase. Pre-passport QR (BATTCERTv3/DPPpre) is **not** an EU Art.77 Battery Passport — issuance is the economic operator's duty.

---

*Built for owners, dealers (Cars24 / CarMax / OLX), insurers & lenders · BijliBureau · Dataset v2026.16 · verified 2026-10-12 · BNEF Dec-2025 snapshot $108/kWh · AVILOO Sep-2026 500k tests · TPEM Oct-2025 · Ola 2026 · EU 2023/1542 · CARB MY2026*
