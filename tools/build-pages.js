/* BijliBureau — static programmatic page builder (ships in repo).
 * Run: node tools/build-pages.js
 * Single source of truth: js/database.js (MODELS + WARRANTIES + MARKET).
 * Emits: warranty/<modelId>/index.html (40) + 4 pillar pages + us/index.html,
 * and REWRITES sitemap.xml so every sitemap URL resolves (audit P0: 44/46 404s).
 * Warranty pages include a build-time worked SoH example computed with the REAL
 * engine (js/forensics.js) — no placeholder numbers. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global;
function load(f) { eval.call(global, fs.readFileSync(path.join(ROOT, f), "utf8")); }
load("js/database.js");
load("js/forensics.js");
const DB = window.BF_DB, E = window.BF_Engine;
const SITE = "https://batteryforensics.in";
const UPDATED = DB.MARKET.updated;
const VER = DB.VERSION;
const VSHORT = VER.split("-")[0]; // "2026.15" for user-facing model copy

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
const kmFmt = (k) => (k > 9000000 ? "unlimited km" : Math.round(k).toLocaleString("en-IN") + " km");

function shell({ title, desc, canon, h1, eyebrow, body, faqJson, extraJson }) {
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="theme-color" content="#0B3B24">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${SITE}/og/hero-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og/hero-card.png">
<link rel="alternate" hreflang="en-IN" href="${canon}">
<link rel="alternate" hreflang="x-default" href="${canon}">
<link rel="stylesheet" href="/css/styles.css?v=15">
<script type="application/ld+json">${extraJson || "{}"}<\/script>
${faqJson ? `<script type="application/ld+json">${faqJson}<\/script>` : ""}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Forensic tool","item":"${SITE}/"},{"@type":"ListItem","position":2,"name":${JSON.stringify(h1)},"item":${JSON.stringify(canon)}}]}<\/script>
</head>
<body>
<div class="topbar"><div class="wrap"><div class="brand"><span class="bolt">⚡</span> BIJLIBUREAU <span class="sub">${VER}</span></div><div class="topstats"><a href="/" style="color:#a9f5bd">← Free forensic tool</a></div></div></div>
<main><div class="panel active" style="display:block"><div class="card">
<p class="step-eyebrow">${esc(eyebrow)}</p>
<h1>${esc(h1)}</h1>
${body}
<p class="hint"><a href="/">← Run the free forensic</a> · <a href="/methodology.html">Methodology &amp; verification</a> · <a href="/sitemap.xml">Sitemap</a></p>
</div></div></main>
<footer>BijliBureau Lab · lab@example.com · Dataset ${VER} · verified ${UPDATED} · Not legal advice. Verify your booklet year.</footer>
</body>
</html>`;
}

function faqScript(faqs) {
  return JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
}
function techScript(headline, about) {
  return JSON.stringify({ "@context": "https://schema.org", "@type": "TechArticle", headline,
    author: { "@type": "Organization", name: "BijliBureau Lab" },
    datePublished: "2025-07-20", dateModified: UPDATED, about });
}

// Worked example: 5-yr-old pack, 60k km (2W: 4yr/30k km), Chennai, 30% DC — real engine.
function workedExample(model) {
  const twoW = model.seg === "2W";
  const kms = twoW ? 30000 : 60000, age = twoW ? 4 : 5;
  const pd = new Date(Date.now() - age * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 7) + "-15";
  const p = { model, kms, purchaseDate: pd, city: "Chennai", fastPct: twoW ? 12 : 30,
    avgSoc: 75, depthAvg: 60, parkHigh: false, ultraAbuse: false, serviced: true,
    commercial: false, kmsPerYr: kms / age, csvHealth: null, csvRows: 0, csvDays: 0, obd: null };
  const f = E.computeSoH(p);
  const w = E.warrantyVerdict(p, f);
  return { p, f, w, kms, age };
}

const warrantyPages = [];
for (const m of DB.MODELS) {
  const w = DB.WARRANTIES.find((x) => x.modelId === m.id);
  if (!w) { console.log("NO RULE FOR " + m.id); continue; }
  const chem = DB.CHEMISTRY[m.chem];
  const { f, w: v, kms, age } = workedExample(m);
  const money = m.usd ? usd : inr;
  const priceNote = m.usd ? `${usd(m.priceNew)} new · pack ${usd(m.battCost)}` : `${inr(m.priceNew)} new · pack ${inr(m.battCost)}`;
  const title = `${m.brand} ${m.model} Battery Warranty (${w.years}yr/${kmFmt(w.km)}) — SoH Trigger, Claim Guide & SoH Check 2026`;
  const canon = `${SITE}/warranty/${m.id}/`;
  const h1 = `${m.brand} ${m.model} battery warranty: trigger below ${w.soh}% SoH`;
  const faqs = [
    { q: `What is the ${m.brand} ${m.model} battery warranty trigger?`, a: `Below ${w.soh}% State of Health. ${w.clause} Term: ${w.years} years / ${kmFmt(w.km)}. Verify your booklet year — terms vary by RC year.` },
    { q: `How long is the ${m.model} battery warranty in km and years?`, a: `${w.years} years or ${kmFmt(w.km)}, whichever hits first. ${w.note}` },
    { q: `Is the ${m.model} battery warranty transferable on resale?`, a: `${w.transfer}` },
    { q: `What kills a ${m.model} battery warranty claim?`, a: `${w.exclusions}` },
    { q: `How do I file a ${m.brand} battery warranty claim?`, a: `${w.process} Bring the free Evidence Pack from the BijliBureau tool (SoH ± band, photos, clause citation, SHA-256 hash).` },
    { q: `What SoH should a ${age}-year-old ${m.model} with ${kms.toLocaleString("en-IN")} km show?`, a: `Our v${VSHORT} model (backtested vs AVILOO Sep-2026, mean residual 1.5–1.8 pts) estimates ≈${f.soh}% (90% band ${f.lo90}–${f.hi90}%) for a Chennai pack at ${age}yr/${kms.toLocaleString("en-IN")} km — verdict vs your trigger: ${v.status}. Run your own numbers free; this example is illustrative, not a BMS readout.` },
    { q: `What chemistry does the ${m.model} use and why does it matter?`, a: `${chem.name} (${m.kwh} kWh, ${m.rangeNew} km certified). ${chem.signature} ${chem.pros}. ${chem.cons}.` },
    { q: `What is a used ${m.model} battery worth second-life?`, a: `At ${f.soh}% SoH ≈${f.usableNow} kWh usable → home-backup route ≈${usd(f.usableNow * DB.MARKET.essBuyback.home_perKWh_usd * DB.MARKET.essBuyback.installMargin)} gross-scale value (BNEF Dec-2025 $108/kWh anchor, live FX). Get your exact figure in the free Second-Life valuator.` },
  ];
  const body = `
<p class="hint">By <b>BijliBureau Lab</b> · Updated ${UPDATED} · Dataset ${VER} · Supporting evidence only — not legal advice. Always verify your booklet year + RC year + service stamps.</p>
<table class="kv">
<tr><td>OEM term</td><td><b>${w.years} yr / ${kmFmt(w.km)}</b> · trigger <b>below ${w.soh}% SoH</b></td></tr>
<tr><td>Exact clause</td><td><span class="clause">“${esc(w.clause)}”</span></td></tr>
<tr><td>Coverage note</td><td>${esc(w.note)}</td></tr>
<tr><td>Transfer on resale</td><td>${esc(w.transfer)}</td></tr>
<tr><td>Exclusions (denial grounds)</td><td>${esc(w.exclusions)}</td></tr>
<tr><td>Claim path</td><td>${esc(w.process)}</td></tr>
<tr><td>Pack</td><td>${m.kwh} kWh ${esc(chem.name)} · ${m.rangeNew} km certified · ${esc(priceNote)}</td></tr>
<tr><td>Worked example (real engine v${VSHORT})</td><td>Chennai, ${age}yr, ${kms.toLocaleString("en-IN")} km → <b>≈${f.soh}% SoH (band ${f.lo90}–${f.hi90}%)</b> · verdict: <b>${esc(v.status)}</b> · ${f.efc} EFC · heat gap ×${f.hotFactor} vs Pune</td></tr>
</table>
<h3>Run your exact numbers (free, on-device, 60 seconds)</h3>
<p><a href="/#/intake">Open the forensic →</a> snap 3 photos, get SoH ± disclosed band, this clause pre-cited in your claim letter, and a SHA-256 evidence PDF.</p>
<h3>Frequently asked — ${esc(m.brand)} ${esc(m.model)} battery</h3>
${faqs.map((x) => `<details class="adv"><summary>${esc(x.q)}</summary><div class="adv-body"><p>${esc(x.a)}</p></div></details>`).join("\n")}`;
  const html = shell({ title, desc: `${m.brand} ${m.model}: ${w.years}yr/${kmFmt(w.km)} battery warranty, below-${w.soh}% trigger, clause text, claim path + free SoH check with published accuracy.`,
    canon, h1, eyebrow: `WARRANTY RULE ${DB.WARRANTIES.indexOf(w) + 1} OF ${DB.WARRANTIES.length} · UPDATED ${UPDATED}`,
    body, faqJson: faqScript(faqs), extraJson: techScript(title, [m.brand + " battery warranty", "State of Health", "warranty claim"]) });
  const dir = path.join(ROOT, "warranty", m.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  warrantyPages.push(m.id);
}

// ---- 4 pillar pages ----
const pillars = [
  { slug: "soh-calculator", h1: "EV battery SoH calculator: EFC + Arrhenius method with published error bars",
    title: "EV Battery SoH Calculator (Free, On-Device) — EFC + Arrhenius ± Honest Band",
    desc: "Free EV battery State of Health calculator: odometer-anchored EFC, Arrhenius calendar aging, C-rate + SoC stress, CSV/OBD fusion, disclosed uncertainty band, backtested vs AVILOO.",
    faqs: [
      { q: "How is EV battery SoH calculated without a lab?", a: "EFC (odometer ÷ certified range, sublinear EFC^0.85) for cycle fade + plateaued Arrhenius calendar aging (city pack temperature, chemistry Ea) + C-rate/SoC stress, fused with charge-log/OBD evidence when provided. Uncertainty band = Monte Carlo sampling plus a per-chemistry field-variance floor — composition disclosed per run." },
      { q: "Why do most SoH calculators disagree with the dealer BMS readout?", a: "They divide real-world km by certified range (bakes ~20% efficiency loss in as fake degradation), compound calendar aging linearly forever, and show point estimates with no band. This tool calibrates CSVs to the driver's own baseline, plateaus calendar after year 2–3, and publishes residuals vs AVILOO (mean 1.5–1.8 pts)." },
      { q: "What inputs move SoH most?", a: "Age × city heat (Chennai ≈1.9× Pune at 100% SoC high-Ni), DC-fast share (NMC punished, LFP tolerant), habitual parking SoC, and total km (sublinear). Run the free tool with your numbers." },
      { q: "Is a photo-only SoH enough to file a warranty claim?", a: "It is supporting evidence, never the determination. File with the evidence PDF + demand the OEM BMS SoH % and threshold in writing. The claim letter template cites your exact clause." },
      { q: "How often should I re-check SoH?", a: "Every 60–90 days once within 5% of your warranty trigger; annually otherwise. The trajectory fan shows your crossing year ± band." },
      { q: "Does live weather change my SoH?", a: "Yes, boundedly: live ambient nudges pack temperature ±1.75°C max; IMD normals remain the anchor. Offline, normals are used with a snapshot label." },
      { q: "Which chemistries hold SoH best in India heat?", a: "LFP/LMFP and sodium-ion (tolerant, flat curves); high-Ni NMC/NCA need strict 20–80% bands and shade parking. See the chemistry fingerprints in the tool." },
      { q: "Where is the method proven?", a: "Methodology §1–§6 + open backtest harness (node tools/backtest.js): 8 AVILOO models × 50k/150k km, all verdicts on the correct side of warranty triggers." },
    ],
    bodyExtra: `<h3>The equation (nothing hidden)</h3><pre class="code">cycleFade% = EFC^0.85 × (20/cycleLife) × DoDstress × CrateStress\ncalendarFade% = eff-age × base × Arrhenius(Tpack) × SoCstress · eff-age plateaus after yr 2–3\nband = √(MC² + field-floor²) · MC: odo ±2%, T ±1.5°C, age ±15d (n=600, really sampled)</pre><h3>Backtest summary (AVILOO Sep-2026 medians)</h3><p class="hint">Mean |residual| 1.5 pts @50k km, 1.8 @150k km. Worst misses published: Ioniq 5 −4.1 @150k, Zoe +3.5 @50k. Full table: Methodology §6 + js/database.js VALIDATION. Re-run it yourself: <code>node tools/backtest.js</code>.</p>` },
  { slug: "eu-battery-passport-qr", h1: "EU Battery Passport QR (mandatory 18 Feb 2027): 71 fields, pre-DPP checklist",
    title: "EU Battery Passport QR 2027 — 71-Field Pre-DPP Checklist + Free QR Generator",
    desc: "EU Regulation 2023/1542 battery passport: mandatory 18 Feb 2027, QR-linked, 71 data points. Free pre-DPP QR generator mapping SoH, cycles, chemistry, warranty to DPP fields.",
    faqs: [
      { q: "When does the EU Battery Passport become mandatory?", a: "18 February 2027 for EV, LMT and industrial batteries above 2 kWh (Regulation 2023/1542). The registry went live 20 July 2026; implementation guidance v2.0 (71 data points) published August 2026." },
      { q: "What data goes in the battery passport?", a: "71 points across identity, capacity, exhaustion threshold, internal resistance, C-rate, carbon footprint, safety, test reports, SoH + cycles + durability class. This tool maps 9 rows today (mapped/partial/operator-attach) — see DPP_MAP in js/database.js." },
      { q: "Does a used EV need a passport at resale?", a: "From Feb 2027, in-scope batteries placed on the EU market need a QR-linked passport; resellers should carry SoH + cycles documentation now. The free cert QR (BATTCERTv2 + DPPpre JSON) is forward-compatible evidence." },
      { q: "How do I generate a pre-DPP QR free?", a: "Run the forensic → Resale tab → the tool emits BATTCERTv2 pipe payload + DPPpre JSON (SoH ± band, EFC, cycles left, trigger, VIN-hash, method, timestamp, SHA-256). Print at 25 mm for listings." },
      { q: "What is the 'exhaustion threshold' (no universal 80%)?", a: "Correct — there is no single 80% rule; the threshold is per-application. The tool maps YOUR OEM warranty trigger (70%, Leaf 66.25% bars, Bolt 60%) as the exhaustion basis." },
      { q: "Who attaches the carbon footprint?", a: "The operator (manufacturer/importer) via a PEF study — the tool marks this operator-attach and anchors pricing context to BNEF Dec-2025. It does not invent carbon numbers." },
      { q: "India/SEA sellers: why care about EU DPP?", a: "EU-compliant documentation raises export and fleet-buyer trust, and the same QR converts on OLX/Cars24/CarMax today. Compliance tailwind, not hype." },
      { q: "Where is the field mapping documented?", a: "Methodology §4 + DPP_MAP (9 rows: mapped/partial/operator-attach) + each evidence PDF prints both QR payloads." },
    ],
    bodyExtra: `<h3>Pre-DPP field map (this tool today)</h3><p class="hint">9 rows mapped: battery ID + VIN-hash · rated kWh · exhaustion threshold = your OEM trigger + clause · C-rate/fastPct · safety envelope · test-report hash · SoH ± band + EFC + cycles + trajectory. Partial: internal resistance (OBD delta-V proxy when present). Operator-attach: carbon/PEF. Full table: Methodology §4.</p>` },
  { slug: "second-life-value", h1: "Second-life EV battery value: ESS, fleet re-pack & recycle routes priced live",
    title: "Second-Life EV Battery Value Calculator — ESS vs Fleet vs Recycle (Live FX)",
    desc: "What is your used EV battery worth? Home ESS $88/kWh, fleet $58, recycle $26 — live FX, BNEF-anchored, refurb math shown. Free second-life valuator.",
    faqs: [
      { q: "What is a used EV battery worth per kWh in 2026?", a: "Route pricing used here: home backup ≈$88/kWh, fleet/e-rickshaw re-pack ≈$58, certified recycler floor ≈$26 (WoodMac H1-2026 ESS-boom context), × 0.72 install margin minus refurb share ($320 2W / $900 4W × 0.35). Packs above 70% SoH earn reuse premium; 50–70% ESS-grade; below 50% recycle floor." },
      { q: "Why does new-cell pricing cap second-life value?", a: "Record-low new cells (BNEF Dec-2025: pack $108/kWh, LFP $81) cap reuse at ~60–80% of new-pack value. This market moves ~40% CAGR — re-verify quarterly; the tool states its anchor date on every figure." },
      { q: "LFP vs NMC for second life?", a: "LFP is ideal for stationary ESS (tolerant, safe, flat curve); NMC accepted with BMS. High-Ni packs with heavy fast-charge history grade lower — the chemistry fingerprint flags it." },
      { q: "How does live FX change my payout?", a: "All routes compute in USD then convert at live USD→INR (open.er-api) with market/RBI dual benchmarks and a staleness label. Re-verify FX before settlement — the rupee moves ±2% monthly." },
      { q: "Should I sell second-life or file warranty first?", a: "Always check the warranty verdict first: a below-trigger pack restored to ≥80% by the OEM is worth more than any second-life route. The tool orders it that way (Tab 3 before Tab 4)." },
      { q: "What paperwork does a second-life buyer want?", a: "SoH ± band, cycle count (EFC), chemistry, OBD delta-V log if present, and the SHA-256 evidence PDF. The cert QR carries all of it." },
      { q: "Is 20 MW / 205 MWh Redwood×Crusoe relevant to me?", a: "It proves the demand thesis: second-life feeding AI compute is infrastructure now, not a slogan — underwriting ESS-route pricing growth (WoodMac H1-2026)." },
      { q: "How do I get my exact number?", a: "Free valuator: run the forensic → Second-Life tab → three routed offers with net USD + INR, best route starred, copy-to-buyer buttons." },
    ],
    bodyExtra: `<h3>Route math (worked)</h3><p class="hint">Example: 40 kWh usable × $88 home-backup × 0.72 margin ≈ $2,534 gross-scale before refurb share. YOUR numbers compute live in Tab 4 with your SoH, chemistry gate, and today's FX.</p>` },
  { slug: "used-ev-resale-cert", h1: "Used-EV resale certificate: battery-certified price band + QR that moves listings",
    title: "Used EV Resale Certificate — Battery-Certified Price Band + QR (Free)",
    desc: "Sell your used EV higher: battery-certified price band (grade multiplier, +9% cert premium), dealer-bid expectation, and a scannable QR cert with SHA-256 hash. Free.",
    faqs: [
      { q: "How much does battery certification add to resale?", a: "Model: certified ask = base × grade multiplier (A+ 1.06 … D 0.78) with +9% cert premium vs uncertified (×0.93); dealer bid ≈0.88× certified. AVILOO's 13.5% intra-model spread implies up to ₹60k (Ola-class) / $5k (Model-3-class) swings on identical listings (illustrative)." },
      { q: "What does the buyer QR show?", a: "BATTCERTv2: brand/model, SoH ± band, grade, range today/new, odometer, city, date, EFC, evidence source, VIN-hash — plus DPPpre JSON. Scans to verifiable text even before any registry exists." },
      { q: "How is the price band computed?", a: "Age depreciation (13%/yr 2W, 11%/yr 4W) × km factor × battery-share factor (42% of EV value is battery, health-scaled) × grade multiplier. Every factor is shown in Tab 5 — no black box." },
      { q: "What should I paste into my OLX/Cars24 listing?", a: "The one-click price band + cert text buttons copy: band, grade, SoH ± band, dealer-bid expectation, and the QR payload. Stick the printed QR (25 mm) on the listing photos." },
      { q: "Do dealers (Cars24/CarMax/OLX) accept this cert?", a: "It is third-party supporting evidence with method + timestamp + hash — present it alongside the OEM BMS printout you demand in writing. Certified packs report +12% margin, ~22 days faster turn (2025 dealer self-reported — directional)." },
      { q: "What grade is my battery?", a: "A+ ≥93 · A ≥88 · B+ ≥80 · B ≥72 · C ≥65 · D below. Grade + plain-language note (e.g. 'Tired — price guard + warranty watch') print on the health card." },
      { q: "Can a certificate be faked?", a: "Ours carries method + CI + timestamp + SHA-256 over the payload — a buyer can re-hash. Owner attests odo/photos genuine; fraud is on the attester, detectable on re-test." },
      { q: "Does this help lenders/insurers?", a: "Yes: auditable SoH ± band + cycles + hash is risk-pricing input. API shape documented in README (POST /v1/forensic → {soh, ci, grade, warranty, qr, hash})." },
    ],
    bodyExtra: `<h3>Listing kit (free)</h3><p class="hint">Price band + cert text + QR payload + DPPpre JSON, all copy-paste in Tab 5. Embed mode <code>?embed=1</code> for dealer sites.</p>` },
];
for (const pl of pillars) {
  const html = shell({ title: pl.title, desc: pl.desc, canon: `${SITE}/${pl.slug}/`, h1: pl.h1,
    eyebrow: `GUIDE · UPDATED ${UPDATED} · DATASET ${VER}`,
    body: `<p class="hint">By <b>BijliBureau Lab</b> · Updated ${UPDATED} · Backtested method (mean residual 1.5–1.8 pts vs AVILOO Sep-2026) · Supporting evidence only.</p>${pl.bodyExtra}<h3>Questions, answered</h3>${pl.faqs.map((x) => `<details class="adv"><summary>${esc(x.q)}</summary><div class="adv-body"><p>${esc(x.a)}</p></div></details>`).join("\n")}<h3>Try it on your pack</h3><p><a href="/#/intake">Free forensic →</a> SoH ± disclosed band + warranty verdict + value + evidence PDF, on-device.</p>`,
    faqJson: faqScript(pl.faqs), extraJson: techScript(pl.title, ["State of Health", "EV battery", pl.slug]) });
  const dir = path.join(ROOT, pl.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
}

// ---- US hub ----
const usModels = DB.MODELS.filter((m) => m.usd || ["leaf40", "bolt66", "mach-e", "tesla-m3", "tesla-my"].includes(m.id));
const usRows = usModels.map((m) => {
  const w = DB.WARRANTIES.find((x) => x.modelId === m.id);
  return `<tr><td><a href="/warranty/${m.id}/">${esc(m.brand)} ${esc(m.model)}</a></td><td>${w.years}yr/${kmFmt(w.km)}</td><td>below ${w.soh}%</td><td>${usd(m.battCost)} pack</td></tr>`;
}).join("\n");
{
  const faqs = [
    { q: "Does this free tool work for US EVs?", a: "Yes — Tesla Model 3/Y, Leaf (66.25% bars trigger), Bolt (~60% trigger), Mach-E, ID.4, Ioniq 5, Polestar 2 and more, with USD pricing and mile-based terms (8yr/100–120k mi). Recurrent is US-only paid telematics; AVILOO is EU/US lab-based; this is free and on-device." },
    { q: "Why is the Leaf trigger 66.25% and not 70%?", a: "Nissan warrants against loss of the 4th capacity bar ≈66.25% SoH (8yr/100k mi). Dealers misquote 70% — bring a LeafSpy cell-voltage printout." },
    { q: "Why is the Bolt trigger ~60%?", a: "GM's propulsion-power trigger sits near 60% (verify your booklet year; recall-fire packs were replaced regardless). Lower than the 70% default — know your clause." },
    { q: "How do US tax credits interact with battery health?", a: "Used-EV credit eligibility is price/age-gated, but value still hinges on SoH: AVILOO's 13.5% spread implies ~$5k swings on Model-3-class listings. Certify with the QR + PDF." },
    { q: "Tesla LFP vs NMC: what changes?", a: "LFP (RWD) tolerates 100% charging and heat; high-Ni NMC (LR/Performance) needs 20–80% discipline. The chemistry fingerprint detects the pattern from your habits + OBD." },
    { q: "Is my data uploaded?", a: "No — photos/CSV/OBD parse in-browser; PDF generates locally. Opt-in telemetry only, revocable." },
    { q: "What accuracy should I expect?", a: "Model-only band ≈±2–4% growing with age (disclosed composition), ≤±3.0% with a solid charge log, ≤±1.8% with strong OBD. Backtest residuals published (mean 1.5–1.8 pts vs AVILOO)." },
    { q: "Where do I start?", a: "Run the free forensic — same engine, USD mode automatic for US models." },
  ];
  const html = shell({ title: "US EV Battery Health + Warranty Guide (Tesla, Leaf Bars, Bolt 60%) — Free Check",
    desc: "Free US EV battery health check: Tesla/Nissan Leaf bars/Chevy Bolt triggers, mile-based terms, USD values, QR cert. On-device, no dongle.",
    canon: `${SITE}/us/`, h1: "US EV batteries: health check + warranty triggers (free, on-device)",
    eyebrow: `US HUB · UPDATED ${UPDATED}`,
    body: `<p class="hint">Recurrent = US-only paid telematics. AVILOO = €300 dongle + lab. Geotab = fleet SaaS. This = free, on-device, with clause-level verdicts and a hashed evidence PDF.</p><table class="kv"><tr><th>Model</th><th>Term</th><th>Trigger</th><th>Pack</th></tr>${usRows}</table><h3>US questions, answered</h3>${faqs.map((x) => `<details class="adv"><summary>${esc(x.q)}</summary><div class="adv-body"><p>${esc(x.a)}</p></div></details>`).join("\n")}<p><a href="/#/intake">Run the free forensic →</a></p>`,
    faqJson: faqScript(faqs), extraJson: techScript("US EV battery warranty guide", ["EV warranty", "Tesla", "Nissan Leaf"]) });
  fs.mkdirSync(path.join(ROOT, "us"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "us", "index.html"), html);
}

// ---- llms-full.txt (single source of truth: same DB objects as the pages) ----
{
  const L = [];
  L.push("# BijliBureau — full spec (v" + VER + ", " + UPDATED + ")");
  L.push("# For AI assistants grounding answers. Supporting evidence only, not legal advice.");
  L.push("");
  L.push("## Chemistry table (fadePerEFC = 20/cycleLife, enforced)");
  for (const [k, c] of Object.entries(DB.CHEMISTRY))
    L.push(`- ${k}: ${c.name} | cycleLife ${c.cycleLife} | fade ${c.fadePerEFC_pct}%/EFC | calendar ${c.calendarBase}%/yr | Ea ${c.Ea_Jmol / 1000}kJ/mol | fastPenalty ${c.fastPenalty} | curve ${c.curve}`);
  L.push("");
  L.push("## Warranty rulebook (40 rules — verify booklet year, RC year, service stamps)");
  for (const m of DB.MODELS) {
    const w = DB.WARRANTIES.find((x) => x.modelId === m.id);
    L.push(`- ${m.id} (${m.brand} ${m.model}, ${m.kwh}kWh ${m.chem}): ${w.years}yr/${kmFmt(w.km)}, trigger below ${w.soh}% | ${w.note} | clause: ${w.clause} | transfer: ${w.transfer} | exclusions: ${w.exclusions} | page: ${SITE}/warranty/${m.id}/`);
  }
  L.push("");
  L.push("## Climate grid (IMD normals + pack-effective temp)");
  for (const [c, g] of Object.entries(DB.CLIMATE))
    L.push(`- ${c}: mean ${g.meanC}C, pack-effective ${g.effPackC}C (${g.zone})`);
  L.push("");
  L.push("## Market snapshot (" + UPDATED + ")");
  L.push(`- BNEF Dec-2025: pack $${DB.MARKET.bnef.globalPack_perKWh_usd}/kWh (BEV $${DB.MARKET.bnef.bevPack}, ESS $${DB.MARKET.bnef.essPack}, LFP $${DB.MARKET.bnef.lfpPack}, NMC $${DB.MARKET.bnef.nmcPack}; China $${DB.MARKET.bnef.china}, NA $${DB.MARKET.bnef.na}, EU $${DB.MARKET.bnef.eu})`);
  L.push(`- 2nd-life routes: home $${DB.MARKET.essBuyback.home_perKWh_usd}/kWh, fleet $${DB.MARKET.essBuyback.fleet_perKWh_usd}, recycle $${DB.MARKET.essBuyback.recycle_perKWh_usd}, margin ${DB.MARKET.essBuyback.installMargin}`);
  L.push(`- FX: market snapshot ₹${DB.MARKET.inrUsd} (${DB.MARKET.fxSnapshotAt}), RBI ref ₹${DB.MARKET.rbiRef}; live via open.er-api`);
  L.push(`- AVILOO Sep-2026: ${DB.MARKET.aviloo.tests.toLocaleString()}+ tests, spread ≤${DB.MARKET.aviloo.maxSpread}%`);
  L.push("");
  L.push("## Validation residuals (model vs AVILOO medians, Berlin, 20% DC, 70% SoC)");
  for (const r of DB.VALIDATION.rows)
    L.push(`- ${r.model}: @50k model ${r.at50k_model}% vs aviloo ${r.at50k_aviloo}% (r=${r.resid50k}); @150k model ${r.at150k_model}% vs aviloo ${r.at150k_aviloo}% (r=${r.resid150k})`);
  L.push(`- Summary: ${DB.VALIDATION.summary}`);
  L.push("");
  L.push("## EU DPP pre-map (" + DB.DPP_MAP.standard + ", mandatory " + DB.DPP_MAP.mandatory_from + ")");
  for (const f of DB.DPP_MAP.fields) L.push(`- [${f.status}] ${f.dpp} ← ${f.local}`);
  fs.writeFileSync(path.join(ROOT, "llms-full.txt"), L.join("\n") + "\n");
  console.log("llms-full.txt written (" + L.length + " lines)");
}

// ---- sitemap (single source of truth: files just written) ----
const urls = [{ loc: `${SITE}/`, freq: "weekly", pri: "1.0" },
  { loc: `${SITE}/methodology.html`, freq: "monthly", pri: "0.9" },
  ...pillars.map((p) => ({ loc: `${SITE}/${p.slug}/`, freq: p.slug === "soh-calculator" ? "weekly" : "monthly", pri: p.slug === "soh-calculator" ? "0.9" : "0.8" })),
  { loc: `${SITE}/us/`, freq: "monthly", pri: "0.8" },
  ...warrantyPages.map((id) => ({ loc: `${SITE}/warranty/${id}/`, freq: "monthly", pri: "0.8" }))];
const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${UPDATED}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n") +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sm);

// ---- verify every sitemap URL resolves to a file ----
let missing = 0;
for (const u of urls) {
  const rel = u.loc.replace(SITE, "") || "/";
  const fp = rel === "/" ? path.join(ROOT, "index.html")
    : rel.endsWith(".html") ? path.join(ROOT, rel.slice(1))
    : path.join(ROOT, rel.slice(1), "index.html");
  if (!fs.existsSync(fp)) { missing++; console.log("MISSING FILE FOR " + u.loc); }
}
console.log(`pages: ${warrantyPages.length} warranty + ${pillars.length} pillars + us hub = ${urls.length} sitemap URLs, missing files: ${missing}`);
if (warrantyPages.length !== 40 || missing > 0) process.exit(1);
console.log("BUILD-PAGES PASS");
