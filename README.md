# ⚡ BijliBureau — EV Battery Report Card (Free, On-Device)

![CI](https://github.com/dipakjad1993/Bijli-Bureau/actions/workflows/ci/badge.svg)
![Static](https://img.shields.io/badge/site-100%25_static_·_no_build-blue)
![Privacy](https://img.shields.io/badge/privacy-on--device_·_no_upload-green)
![Coverage](https://img.shields.io/badge/warranty-40_OEM_rules-orange)
![License](https://img.shields.io/badge/use-supporting--evidence-lightgrey)

**The battery report card for EVs — free, and it understands chemistry.**

Snap 3 photos → upload service bill → optional charge-log CSV / OBD → get **SoH with 90% confidence band**, **warranty verdict with exact clause**, **second-life value**, **resale band + DPP-ready QR cert**, and a **courtroom-grade evidence PDF**. 2-wheelers + 4-wheelers. India-first, EU/US-aware. **100% on-device — nothing uploaded.**

🔴 **Live demo:** https://dipakjad1993.github.io/Bijli-Bureau/ &nbsp;·&nbsp; 📖 **Methodology:** [`methodology.html`](methodology.html) &nbsp;·&nbsp; 🗺️ **Sitemap:** [`sitemap.xml`](sitemap.xml)

> Backtested vs AVILOO Sep-2026 medians — **mean |residual| 1.5 pts @ 50k km, 1.8 pts @ 150k km**. Residuals published, re-runnable: `node tools/backtest.js`.

---

## ✨ What it does (7 tabs, 1 page)

| # | Tab | What you get |
|---|-----|--------------|
| 1 | 📸 **Intake & Photos** | 3-photo upload + on-device OCR (Tesseract lazy-load), odo/SoC/VIN autofill, charge-log CSV + OBD (LeafSpy/Torque) parser, climate city + fast-% + abuse flags, DPDP/GDPR opt-in |
| 2 | 🔬 **SoH Lab** | Odometer-anchored EFC⁰·⁸⁵ + plateaued Arrhenius calendar, DoD/C-rate/SoC stress, CSV/OBD Bayesian fusion, raw + clamped SoH + honest 90% band, trajectory + breakdown charts, 11-chemistry fingerprint |
| 3 | ⚖️ **Warranty Verdict** | 40 OEM rules — ELIGIBLE / FILE-SOON / HEALTHY / EXPIRED + denial-risk audit + copy-paste claim letter with clause + CPA-2019 escalation |
| 4 | 🔋 **Second-Life** | Usable kWh × home/fleet/recycle buyback (WoodMac H1-2026 ESS boom), live FX, refurb cost, BNEF-2025 anchored |
| 5 | 🏷️ **Resale & Cert QR** | Age×km×battery-share price band, grade multiplier, certified +9%, BATTCERTv2 + DPPpre QR payload + SHA-256 + share link |
| 6 | 📕 **Evidence Pack** | Timestamped local PDF (photos, OCR, method, clause, trajectory ±band, QR, hash, consent) + encrypted IndexedDB vault |
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
node tools/backtest.js   # BACKTEST PASS — AVILOO residuals + verdict sides + headline/chart + chemistry consistency
node tools/verify.js     # VERIFY PASS — 40/40 models↔rules, 47/47 sitemap URLs resolve, no placeholders
node tools/build-pages.js  # regenerates warranty/ + pillars + us/ + sitemap.xml + llms-full.txt
```

Latest verified run (2026-10-12): `BACKTEST PASS` · `VERIFY PASS` · `BUILD-PAGES PASS`.
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

Full equations + residual tables + competitive teardown: [`methodology.html`](methodology.html) (§6 backtest, §12 competition, §13 deploy checklist).

## ⚖️ Warranty coverage (40 rules, clause-level)

Tata Lifetime 15-yr (Jul-2025 + Oct-2025 full-range extension, 70%→restore 80%, booklet-year check) · Ola base 3yr/50k + 2026 free 8yr/70k + paid 8yr/80–125k top-ups (**S1 X 2 kWh hard-blocked**) · Ather / TVS / Vida / Chetak · MG / Mahindra / BYD / Hyundai · Tesla / VW / Leaf (~66.25% bars) / Bolt (~60%) + more.

Each rule ships with **source URL + verified date + confidence** (`js/database.js:SOURCES_DETAILED`). Rulebook browser works before you run. Evidence auto-clears on model change.

## 📁 Project structure

```
index.html  methodology.html  sitemap.xml (47 URLs)  robots.txt  llms.txt  llms-full.txt (generated)
manifest.webmanifest  icon.svg  icons/  og/hero-card.png
sample-charge-log.csv  sample-obd-log.csv
css/styles.css (print + embed + contrast + QR-print)
js/database.js    (40 models + 40 rules + 11 chemistries + VALIDATION + DPP_MAP + I18N + LIVE + fmtMoney)
js/forensics.js   (computeSoH, trajectory, verdicts, second-life, resale, QR)
js/app.js         (hash router + ?r= share + vault + dataLayer/GA4-opt + lazy OCR/libs + DPP QR v2)
tools/backtest.js (AVILOO harness — the accuracy proof)
tools/build-pages.js (regenerates warranty/ + soh-calculator/ + eu-battery-passport-qr/ + second-life-value/ + used-ev-resale-cert/ + us/)
tools/verify.js   (static-site integrity gate)
tools/og.js       (zero-dep OG PNG renderer)
warranty/<40 modelIds>/  soh-calculator/  eu-battery-passport-qr/  second-life-value/  used-ev-resale-cert/  us/
```

> Generated pages: edit the DB (`js/database.js`), then `node tools/build-pages.js` — never hand-edit generated HTML.

## 🌐 SEO / sharing / deploy

- Canonical production domain: `batteryforensics.in` (OG, hreflang, JSON-LD: WebApplication + FAQ + Dataset + Breadcrumb). GitHub Pages mirror here is the public demo.
- `sitemap.xml` 47/47 resolve · `robots.txt` · `llms.txt` + `llms-full.txt` (LLM/crawler surface) · `og/hero-card.png` ships · `?embed=1` dealer mode · print CSS with 25 mm QR.
- Deploy checklist: host domain → set `BF_DB.ANALYTICS.ga4Id` + GSC + sitemap → set telemetry endpoint → replace `lab@example.com` → quarterly recalibration + rebuild.

## 🤝 Contributing

PRs welcome — especially warranty-clause corrections (with source URL + booklet year) and field SoH pairs for recalibration. Run `node tools/backtest.js && node tools/verify.js` before pushing; CI must stay green.

## ⚠️ Disclaimer

Supporting evidence only — **not legal advice**. Always demand OEM BMS SoH in writing and verify against your booklet year. Battery text is paraphrase.

---

*Built for owners, dealers (Cars24 / CarMax / OLX), insurers & lenders · BijliBureau Lab · Dataset v2026.15 · verified 2026-10-12 · BNEF Dec-2025 $108/kWh · AVILOO Sep-2026 500k tests · TPEM Oct-2025 · Ola 2026*
