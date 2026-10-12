/* ============================================================================
 * BijliBureau — EV Battery Report Card
 * MASTER DATASET v2026.16  |  Verified Oct 2026 (enterprise audit applied)
 * Canonical entity: "BijliBureau" — single name across schema/PDF/QR/footer.
 * (Legacy prototype accent "Warranty Claim Assassin" retained ONLY as a visible
 * eyebrow accent in index hero + changelog history — never in schema/PDF/QR.)
 * Contact: support@batteryforensics.in (monitored inbox, 7-day correction SLA).
 * Sources: BNEF Battery Price Survey Dec 9 2025 ($108/kWh avg, BEV $99, ESS $70,
 *   LFP $81 / NMC $128; 2026F ≈ $105, next survey Dec-2026), IEA Global EV
 *   Outlook 2025/2026, AVILOO Certified EV Battery Report Sep 2-3 2026 (500k+
 *   FLASH Tests, subset of 1M+ DB, ≤13.5% intra-model spread),
 *   OEM owner manuals / warranty booklets (Tata Lifetime 15-yr Jul-2025 +
 *   Oct-2025 full-range extension, Ola 8-yr T&C + 2026 free plan, Tesla, BYD,
 *   MG, Hyundai…), WoodMac H1-2026 ESS outlook, IMD city climatology normals,
 *   EU Reg 2023/1542 + Guidance v2.0 Aug-2026 + Registry IR 2026/1778,
 *   California 13 CCR §§1962.5/1962.7/1962.8 + DMV Jan-2027 disclosure rule,
 *   Geotab Jan-2026 fleet study (22,700 EVs, 2.3%/yr).
 * All figures embedded for 100% offline use. NO cloud calls.
 * ========================================================================== */
"use strict";

window.BF_DB = window.BF_DB || {};

/* ---------------------------------------------------------------- 1. CHEMISTRY FINGERPRINTS
   v2026.14 recalibration (audit P0-3): fadePerEFC_pct is now DERIVED as
   20/cycleLife — the headline number and the physics CANNOT disagree again.
   LFP 4000→0.0050 · NMC622 1800→0.0111 · NMC811 1500→0.0133 · NCA 1600→0.0125
   LMO 1200→0.0167 · LMFP 3000→0.0067 · Na-ion 2500→0.0080 · LTO 12000→0.0017
   NMC9-Si 1300→0.0154 · Semi-solid 1600→0.0125 · Na-G2 3000→0.0067.
   Throughput is sublinear (EFC^0.85) + calendar plateaus after yr 2–3 —
   see forensics.js + VALIDATION below + methodology §6 residuals. */
BF_DB.CHEMISTRY = {
  "LFP":      { name:"Lithium Iron Phosphate (LFP)", cathode:"LiFePO4", nominalV:3.2, curve:"flat", flatPlateau:"3.2–3.35V for ~70% of SoC, sharp knee at ends", cycleLife:4000, calendarBase:1.1, Ea_Jmol:28000, fadePerEFC_pct:0.0050, fastPenalty:0.55, thermalSafeC:55, signature:"Flat OCV plateau → fake-range-proof: dashboard % barely moves mid-band; range collapses below 15%", pros:"3000–6000 cycles, no cobalt/nickel, tolerates 100% charge, best for India heat", cons:"Lower density ~130–160 Wh/kg, weak in sub-zero", detectHint:"VIN spec or charge curve: charges linearly to ~95% then spikes; regen consistent" },
  "NMC622":   { name:"NMC 622", cathode:"LiNi0.6Mn0.2Co0.2O2", nominalV:3.7, curve:"sloped", flatPlateau:"none — near-linear 3.4→4.15V", cycleLife:1800, calendarBase:1.6, Ea_Jmol:38000, fadePerEFC_pct:0.0111, fastPenalty:1.0, thermalSafeC:45, signature:"Sloped OCV → every % maps to voltage; easy SoH via voltage but degrades faster at 100% SoC + heat", pros:"High density 220–260 Wh/kg", cons:"Needs 80% daily cap, cobalt cost, heat-sensitive", detectHint:"Range falls proportionally with %; fast-charge taper starts ~60%" },
  "NMC811":   { name:"NMC 811 (high-Ni)", cathode:"LiNi0.8Mn0.1Co0.1O2", nominalV:3.7, curve:"sloped", flatPlateau:"none — linear 3.3→4.2V", cycleLife:1500, calendarBase:1.9, Ea_Jmol:42000, fadePerEFC_pct:0.0133, fastPenalty:1.15, thermalSafeC:42, signature:"Steepest slope; micro-cracking above 4.15V — 8C ultra-fast abuse shows as sudden knee at 70%", pros:"Top density 250–280 Wh/kg", cons:"Most calendar-aging, strict 20–80% band", detectHint:"OEM recommends 80% limit in app = NMC811 tell" },
  "NCA":      { name:"NCA (Tesla/Panasonic)", cathode:"LiNiCoAlO2", nominalV:3.6, curve:"sloped", flatPlateau:"gentle slope 3.4→4.2V", cycleLife:1600, calendarBase:1.8, Ea_Jmol:40000, fadePerEFC_pct:0.0125, fastPenalty:1.05, thermalSafeC:42, signature:"Like NMC811 with slightly flatter mid-band", pros:"Proven Tesla packs, good power", cons:"Cobalt, heat + high SoC worst combo", detectHint:"Tesla pre-2022 Long Range / Model S/X" },
  "LMO":      { name:"LMO / NMC-LMO blend (Leaf, eC3)", cathode:"LiMn2O4 blend", nominalV:3.8, curve:"dual-slope", flatPlateau:"two shallow steps ~3.9V and 4.05V", cycleLife:1200, calendarBase:2.2, Ea_Jmol:35000, fadePerEFC_pct:0.0167, fastPenalty:0.9, thermalSafeC:45, signature:"Mn dissolution in heat — Chennai Leaf loses ~1.9× vs Pune at high SoC; AVILOO widest spread 13.5%", pros:"Cheap, safe", cons:"Fastest fade, no active cooling on Leaf", detectHint:"No liquid cooling + rapid % drops in summer" },
  "LMFP":     { name:"LMFP (next-gen LFP+Mn)", cathode:"LiFe0.6Mn0.4PO4", nominalV:3.5, curve:"stepped-flat", flatPlateau:"two plateaus ~3.5V & 4.0V", cycleLife:3000, calendarBase:1.25, Ea_Jmol:30000, fadePerEFC_pct:0.0067, fastPenalty:0.65, thermalSafeC:52, signature:"LFP with extra high-voltage step — 15% more density", pros:"LFP safety + near-NMC density", cons:"New, sparse field data", detectHint:"2025+ MG / Tata 45kWh packs" },
  "SODIUM":   { name:"Sodium-ion (Na-ion)", cathode:"NaNM / Prussian white", nominalV:3.0, curve:"sloped", flatPlateau:"sloped 2.5→3.9V", cycleLife:2500, calendarBase:1.3, Ea_Jmol:26000, fadePerEFC_pct:0.0080, fastPenalty:0.5, thermalSafeC:60, signature:"Excellent heat tolerance, poor cold; linear slope like NMC", pros:"No lithium, abuse-tolerant, cheap", cons:"Low density ~140–175 Wh/kg", detectHint:"2025+ 2W entry packs, JAC / CATL Na-ion cars" },
  "LTO":      { name:"LTO (Toshiba SCiB, some buses)", cathode:"Li4Ti5O12", nominalV:2.4, curve:"flat", flatPlateau:"very flat 2.3–2.5V", cycleLife:12000, calendarBase:0.5, Ea_Jmol:22000, fadePerEFC_pct:0.0017, fastPenalty:0.25, thermalSafeC:60, signature:"Charges at 8C with shrug; 20k-cycle life", pros:"Fastest charge, longest life", cons:"Half the density, expensive", detectHint:"Fleet / bus packs only" }
};

/* ---------------------------------------------------------------- 2. MODEL CATALOGUE (packs, range, price) */
BF_DB.MODELS = [
  /* ---- 2W INDIA ---- */
  { id:"ola-s1pro-g2", brand:"Ola", model:"S1 Pro Gen2 (4 kWh)", seg:"2W", kwh:4.0, chem:"LFP", rangeNew:195, priceNew:134999, battCost:52000, eff:21 },
  { id:"ola-s1pro-plus", brand:"Ola", model:"S1 Pro+ 5.3 kWh Gen3", seg:"2W", kwh:5.3, chem:"LFP", rangeNew:320, priceNew:169999, battCost:68000, eff:17 },
  { id:"ola-s1x-3", brand:"Ola", model:"S1 X 3 kWh", seg:"2W", kwh:3.0, chem:"LFP", rangeNew:151, priceNew:89999, battCost:39000, eff:20 },
  { id:"ola-s1x-2", brand:"Ola", model:"S1 X 2 kWh", seg:"2W", kwh:2.0, chem:"LFP", rangeNew:108, priceNew:79999, battCost:27000, eff:19 },
  { id:"ather-450x", brand:"Ather", model:"450X HR (3.7 kWh)", seg:"2W", kwh:3.7, chem:"NMC622", rangeNew:150, priceNew:145000, battCost:62000, eff:25 },
  { id:"ather-rizta", brand:"Ather", model:"Rizta Z (2.9 kWh)", seg:"2W", kwh:2.9, chem:"LFP", rangeNew:159, priceNew:129999, battCost:40000, eff:18 },
  { id:"tvs-iqube", brand:"TVS", model:"iQube ST (5.1 kWh)", seg:"2W", kwh:5.1, chem:"LFP", rangeNew:150, priceNew:155000, battCost:64000, eff:34 },
  { id:"vida-v1", brand:"Hero Vida", model:"Vida V1 Pro (3.94 kWh)", seg:"2W", kwh:3.94, chem:"NMC622", rangeNew:165, priceNew:128000, battCost:60000, eff:24 },
  { id:"chetak-35", brand:"Bajaj", model:"Chetak 35 Series (3.5 kWh)", seg:"2W", kwh:3.5, chem:"LFP", rangeNew:153, priceNew:127000, battCost:44000, eff:23 },
  { id:"revolt-rv400", brand:"Revolt", model:"RV400 (3.24 kWh)", seg:"2W", kwh:3.24, chem:"LFP", rangeNew:150, priceNew:123000, battCost:41000, eff:22 },
  { id:"simple-one", brand:"Simple", model:"Simple One (5 kWh)", seg:"2W", kwh:5.0, chem:"LFP", rangeNew:248, priceNew:166000, battCost:63000, eff:20 },
  { id:"river-indie", brand:"River", model:"Indie (4 kWh)", seg:"2W", kwh:4.0, chem:"LFP", rangeNew:161, priceNew:138000, battCost:50000, eff:25 },
  { id:"ultraviolette-f77", brand:"Ultraviolette", model:"F77 Mach 2 (10.3 kWh)", seg:"2W", kwh:10.3, chem:"NMC811", rangeNew:323, priceNew:299000, battCost:155000, eff:32 },
  { id:"niu-mqi", brand:"NIU", model:"MQi GT (4.2 kWh)", seg:"2W", kwh:4.2, chem:"NMC622", rangeNew:140, priceNew:190000, battCost:64000, eff:30 },
  /* ---- 4W INDIA ---- */
  { id:"tata-nexon45", brand:"Tata", model:"Nexon.ev 45 kWh", seg:"4W", kwh:45, chem:"LFP", rangeNew:489, priceNew:1399000, battCost:540000, eff:92 },
  { id:"tata-nexon40", brand:"Tata", model:"Nexon.ev 40.5 kWh", seg:"4W", kwh:40.5, chem:"LFP", rangeNew:465, priceNew:1449000, battCost:500000, eff:87 },
  { id:"tata-punch", brand:"Tata", model:"Punch.ev 35 kWh", seg:"4W", kwh:35, chem:"LFP", rangeNew:421, priceNew:1229000, battCost:420000, eff:83 },
  { id:"tata-curvv", brand:"Tata", model:"Curvv.ev 55 kWh", seg:"4W", kwh:55, chem:"LFP", rangeNew:585, priceNew:1799000, battCost:640000, eff:94 },
  { id:"tata-tiago", brand:"Tata", model:"Tiago.ev 24 kWh", seg:"4W", kwh:24, chem:"LFP", rangeNew:315, priceNew:799000, battCost:300000, eff:76 },
  { id:"tata-harrier", brand:"Tata", model:"Harrier.ev 75 kWh", seg:"4W", kwh:75, chem:"LFP", rangeNew:627, priceNew:2649000, battCost:880000, eff:120 },
  { id:"mg-zsev", brand:"MG", model:"ZS EV 50.3 kWh", seg:"4W", kwh:50.3, chem:"LFP", rangeNew:461, priceNew:1888000, battCost:600000, eff:109 },
  { id:"mg-windsor", brand:"MG", model:"Windsor EV 52.9 kWh", seg:"4W", kwh:52.9, chem:"LFP", rangeNew:449, priceNew:1700000, battCost:620000, eff:118 },
  { id:"mg-comet", brand:"MG", model:"Comet EV 17.3 kWh", seg:"4W", kwh:17.3, chem:"LFP", rangeNew:230, priceNew:699000, battCost:220000, eff:75 },
  { id:"mahindra-xuv400", brand:"Mahindra", model:"XUV400 39.4 kWh", seg:"4W", kwh:39.4, chem:"NMC622", rangeNew:456, priceNew:1549000, battCost:560000, eff:86 },
  { id:"mahindra-be06", brand:"Mahindra", model:"BE.06 79 kWh", seg:"4W", kwh:79, chem:"LFP", rangeNew:682, priceNew:1890000, battCost:900000, eff:116 },
  { id:"byd-atto3", brand:"BYD", model:"Atto 3 60.5 kWh Blade", seg:"4W", kwh:60.48, chem:"LFP", rangeNew:521, priceNew:2499000, battCost:680000, eff:116 },
  { id:"byd-seal", brand:"BYD", model:"Seal 82.5 kWh", seg:"4W", kwh:82.5, chem:"LFP", rangeNew:650, priceNew:4100000, battCost:920000, eff:127 },
  { id:"hyundai-cretae", brand:"Hyundai", model:"Creta Electric 51.4 kWh", seg:"4W", kwh:51.4, chem:"NMC622", rangeNew:473, priceNew:1799000, battCost:680000, eff:109 },
  { id:"citroen-ec3", brand:"Citroen", model:"eC3 29.2 kWh", seg:"4W", kwh:29.2, chem:"LMO", rangeNew:320, priceNew:1290000, battCost:380000, eff:91 },
  /* ---- GLOBAL 4W ---- */
  { id:"tesla-m3", brand:"Tesla", model:"Model 3 RWD 60 kWh LFP", seg:"4W", kwh:60, chem:"LFP", rangeNew:513, priceNew:39000, battCost:9000, eff:117, usd:true },
  { id:"tesla-my", brand:"Tesla", model:"Model Y LR 78.8 kWh NMC", seg:"4W", kwh:78.8, chem:"NMC811", rangeNew:533, priceNew:45000, battCost:13500, eff:148, usd:true },
  { id:"byd-dolphin", brand:"BYD", model:"Dolphin 60.5 kWh", seg:"4W", kwh:60.5, chem:"LFP", rangeNew:427, priceNew:33000, battCost:7000, eff:142, usd:true },
  { id:"vw-id4", brand:"VW", model:"ID.4 77 kWh", seg:"4W", kwh:77, chem:"NMC811", rangeNew:519, priceNew:45000, battCost:14000, eff:148, usd:true },
  { id:"ioniq5", brand:"Hyundai", model:"Ioniq 5 77.4 kWh", seg:"4W", kwh:77.4, chem:"NMC811", rangeNew:507, priceNew:47000, battCost:14000, eff:153, usd:true },
  { id:"leaf40", brand:"Nissan", model:"Leaf 40 kWh (ZE1)", seg:"4W", kwh:40, chem:"LMO", rangeNew:270, priceNew:29000, battCost:9500, eff:148, usd:true },
  { id:"zoe52", brand:"Renault", model:"Zoe ZE50 52 kWh", seg:"4W", kwh:52, chem:"NMC622", rangeNew:395, priceNew:35000, battCost:10000, eff:132, usd:true },
  { id:"mg4-64", brand:"MG", model:"MG4 64 kWh", seg:"4W", kwh:64, chem:"NMC622", rangeNew:450, priceNew:33000, battCost:9500, eff:142, usd:true },
  { id:"mach-e", brand:"Ford", model:"Mustang Mach-E 88 kWh", seg:"4W", kwh:88, chem:"NMC811", rangeNew:500, priceNew:47000, battCost:15000, eff:176, usd:true },
  { id:"bolt66", brand:"Chevrolet", model:"Bolt EUV 66 kWh", seg:"4W", kwh:66, chem:"NMC622", rangeNew:397, priceNew:29000, battCost:12000, eff:166, usd:true },
  { id:"polestar2", brand:"Polestar", model:"Polestar 2 78 kWh", seg:"4W", kwh:78, chem:"NMC811", rangeNew:540, priceNew:50000, battCost:14000, eff:144, usd:true }
];

/* ------------------------------------------------- 3. WARRANTY RULEBOOK (40 OEM rules — count verified, matches MODELS) */
BF_DB.WARRANTIES = [
  { modelId:"tata-nexon45", oem:"Tata", years:15, km:9999999, unlimKm:true, lifetime:true, soh:70, note:"Lifetime HV warranty (15-yr def.) Jul-2025, unlimited km, 1st owner. 2nd owner: 8yr/1.6L km. Repair restores to ≥80% or pre-repair steady-state, whichever higher. T&C: private regn only.", clause:"TPEM Lifetime HV Battery Warranty §4.2 — 'falls below minimum 70% SoH … repair/replace to 80%'.", transfer:"Free, must notify TPEM on RC transfer", exclusions:"Commercial/fleet/demo excluded (→8yr/1.6L km). No service-interval breach, no flood/fire/physical damage, no unauthorised software/BMS tamper.", process:"Tata.ev service → HV health scan → TPEM approval → module/pack swap in 2–5 days" },
  { modelId:"tata-curvv", oem:"Tata", years:15, km:9999999, unlimKm:true, lifetime:true, soh:70, note:"Same Lifetime terms as Nexon 45.", clause:"TPEM Lifetime HV §4.2 — 70% trigger, restore ≥80%.", transfer:"Free, notify TPEM", exclusions:"Commercial/fleet excluded; accidental/thermal abuse excluded", process:"Tata.ev SC scan → TPEM approval" },
  { modelId:"tata-harrier", oem:"Tata", years:15, km:9999999, unlimKm:true, lifetime:true, soh:70, note:"Lifetime; 2nd owner 10yr/2L km.", clause:"TPEM Lifetime §4.2 — 70% trigger.", transfer:"Notify TPEM", exclusions:"Commercial excluded", process:"Tata.ev SC" },
  { modelId:"tata-nexon40", oem:"Tata", years:8, km:160000, soh:70, note:"8yr/1.6L km, 70% trigger (pre-Lifetime stock).", clause:"Tata.ev HV Warranty §3 — 70% SoH floor.", transfer:"Free auto on RC update", exclusions:"Standard neglect/abuse exclusions", process:"Tata.ev SC scan" },
  { modelId:"tata-punch", oem:"Tata", years:15, km:9999999, unlimKm:true, lifetime:true, soh:70, note:"Lifetime extended to FULL EV range (TPEM Oct-2025 update): 15-yr def, unlimited km 1st owner private, 70%→80%. Pre-Oct-2025 cars: 8yr/1.6L km — verify RC/booklet year.", clause:"TPEM Lifetime HV §4.2 (Oct-2025 range extension) — 70% trigger, restore ≥80%. Pre-update stock: Tata.ev HV §3 — 8yr/1.6L km.", transfer:"Free, notify TPEM", exclusions:"Commercial/fleet excluded (→8yr/1.6L km); verify booklet year — single biggest denial ground on 2024 stock", process:"Tata.ev SC scan → TPEM approval" },
  { modelId:"tata-tiago", oem:"Tata", years:15, km:9999999, unlimKm:true, lifetime:true, soh:70, note:"Lifetime extended to FULL EV range (TPEM Oct-2025 update). Pre-Oct-2025 cars: 8yr/1.6L km — verify RC/booklet year.", clause:"TPEM Lifetime HV §4.2 (Oct-2025 range extension) — 70% trigger. Pre-update: Tata.ev HV §3.", transfer:"Free, notify TPEM", exclusions:"Commercial excluded; booklet-year check mandatory", process:"Tata.ev SC" },
  { modelId:"ola-s1pro-g2", oem:"Ola", years:8, km:80000, soh:70, note:"Base 3yr/50k km + 2026 FREE 8yr/70k km plan (select VINs) + paid Top-ups to 8yr/80k (₹14,999) / 100k / 125k. Trigger <70%. S1 X 2kWh NOT eligible for any 8-yr cover.", clause:"Ola Battery Top-up T&C — 'repaired/replaced … if performance degrades below 70%'.", transfer:"Transferable to subsequent owner (India only)", exclusions:"Paid top-up only if bought ≤12 months after delivery (3-Feb-2024 rule); commercial misuse, water-jet/pressure damage, unauthorised opening excluded", process:"Ola SC → BMS log pull → Ola approval; carry all charge bills" },
  { modelId:"ola-s1pro-plus", oem:"Ola", years:8, km:125000, soh:70, note:"Gen3: 3yr/50k incl + free 8yr/70k (2026) + 8yr/125k top-up.", clause:"Ola Top-up 125k T&C — 70% trigger.", transfer:"Transferable", exclusions:"As above", process:"Ola SC" },
  { modelId:"ola-s1x-3", oem:"Ola", years:8, km:100000, soh:70, note:"Eligible for free 8yr/70k (2026) + 8yr/100k top-up.", clause:"Ola Top-up 100k T&C — 70%.", transfer:"Transferable", exclusions:"As above", process:"Ola SC" },
  { modelId:"ola-s1x-2", oem:"Ola", years:3, km:50000, soh:70, note:"2 kWh NOT eligible for ANY 8-yr cover (free or paid) — base 3yr/50k km only. Highest warranty risk in lineup.", clause:"Ola base warranty — defect cover; degradation goodwill only.", transfer:"Transferable", exclusions:"All 8-yr covers barred", process:"Ola SC" },
  { modelId:"ather-450x", oem:"Ather", years:5, km:60000, soh:70, note:"Ather Battery Protect 5yr/60k; extended to 8yr/80k on Rizta/2024+ 450 (Battery Protect 8). <70% triggers.", clause:"Ather Battery Protect §2.1 — 70% capacity assurance.", transfer:"Transferable with ownership + service record", exclusions:"Requires scheduled service at Ather Grid SC; deep-discharge storage >30 days excluded", process:"Ather SC → battery health report → replacement" },
  { modelId:"ather-rizta", oem:"Ather", years:8, km:80000, soh:70, note:"8yr/80k Battery Protect.", clause:"Ather Protect-8 §2.1 — 70%.", transfer:"Transferable", exclusions:"Service compliance required", process:"Ather SC" },
  { modelId:"tvs-iqube", oem:"TVS", years:5, km:75000, soh:70, note:"5yr/75k (latest ST); earlier 3yr/50k — check RC year.", clause:"TVS iQube warranty booklet — 70% floor.", transfer:"Transferable", exclusions:"Service at TVS EV SC required", process:"TVS SC" },
  { modelId:"vida-v1", oem:"Hero Vida", years:5, km:50000, soh:70, note:"5yr/50k battery; removable-pack cover incl BMS.", clause:"Vida warranty — 70% SoH.", transfer:"Transferable", exclusions:"Removable-pack misuse excluded", process:"Vida SC" },
  { modelId:"chetak-35", oem:"Bajaj", years:5, km:75000, soh:70, note:"5yr/75k (35-series); lifetime telematics health log helps claims.", clause:"Bajaj Chetak warranty — 70%.", transfer:"Transferable", exclusions:"Standard", process:"Bajaj EV SC" },
  { modelId:"revolt-rv400", oem:"Revolt", years:5, km:75000, soh:70, note:"5yr/75k.", clause:"Revolt warranty — 70%.", transfer:"Transferable", exclusions:"Standard", process:"Revolt SC" },
  { modelId:"simple-one", oem:"Simple", years:8, km:60000, soh:70, note:"8yr/60k claimed.", clause:"Simple warranty — 70%.", transfer:"Transferable", exclusions:"Service compliance", process:"Simple SC" },
  { modelId:"river-indie", oem:"River", years:5, km:80000, soh:70, note:"5yr/80k.", clause:"River warranty — 70%.", transfer:"Transferable", exclusions:"Standard", process:"River SC" },
  { modelId:"ultraviolette-f77", oem:"Ultraviolette", years:8, km:100000, soh:70, note:"8yr/100k (8-yr pack warranty advertised).", clause:"F77 warranty — 70%.", transfer:"Transferable", exclusions:"Track-mode abuse + crash excluded", process:"UV SC" },
  { modelId:"niu-mqi", oem:"NIU", years:3, km:30000, soh:70, note:"3yr/30k (EU terms; India via importer).", clause:"NIU warranty — 70%.", transfer:"Varies", exclusions:"Importer terms apply", process:"NIU dealer" },
  { modelId:"mg-zsev", oem:"MG", years:8, km:150000, soh:70, note:"8yr/1.5L km.", clause:"MG India HV §5 — 70%.", transfer:"One-time transfer", exclusions:"Annual battery check recommended", process:"MG SC" },
  { modelId:"mg-windsor", oem:"MG", years:8, km:150000, soh:70, note:"8yr/1.5L km; BaaS rental packs have separate operator cover.", clause:"MG India HV §5 — 70%.", transfer:"One-time", exclusions:"BaaS terms differ", process:"MG SC" },
  { modelId:"mg-comet", oem:"MG", years:8, km:120000, soh:70, note:"8yr/1.2L km.", clause:"MG HV §5 — 70%.", transfer:"One-time", exclusions:"Standard", process:"MG SC" },
  { modelId:"mahindra-xuv400", oem:"Mahindra", years:8, km:160000, soh:70, note:"8yr/1.6L km; BMS health check on resale.", clause:"Mahindra HV — 70%.", transfer:"With BMS check", exclusions:"Standard", process:"Mahindra SC" },
  { modelId:"mahindra-be06", oem:"Mahindra", years:8, km:160000, soh:70, note:"8yr/1.6L km + lifetime first-owner chatter (confirm booklet).", clause:"Mahindra BE HV — 70%.", transfer:"With check", exclusions:"Standard", process:"Mahindra SC" },
  { modelId:"byd-atto3", oem:"BYD", years:8, km:160000, soh:70, note:"8yr/1.6L km Blade; 8yr/2L km in some EU markets.", clause:"BYD Blade warranty — 70%.", transfer:"Free", exclusions:"Standard", process:"BYD SC" },
  { modelId:"byd-seal", oem:"BYD", years:8, km:160000, soh:70, note:"8yr/1.6L km.", clause:"BYD — 70%.", transfer:"Free", exclusions:"Standard", process:"BYD SC" },
  { modelId:"hyundai-cretae", oem:"Hyundai", years:8, km:160000, soh:70, note:"8yr/1.6L km.", clause:"Hyundai India HV — 70%.", transfer:"Free", exclusions:"Standard", process:"Hyundai SC" },
  { modelId:"citroen-ec3", oem:"Citroen", years:7, km:140000, soh:70, note:"7yr/1.4L km.", clause:"Citroen HV — 70%.", transfer:"Free", exclusions:"Standard", process:"Citroen SC" },
  { modelId:"tesla-m3", oem:"Tesla", years:8, km:192000, soh:70, note:"M3 RWD LFP: 8yr/120k mi (192k km). LR: 8yr/120k mi. 70% retention.", clause:"Tesla HV Battery Limited Warranty — 70% retention.", transfer:"Auto with car", exclusions:"Towing-abuse, firmware-tamper, salvage title excluded", process:"Tesla app → remote diag → SC swap" },
  { modelId:"tesla-my", oem:"Tesla", years:8, km:192000, soh:70, note:"8yr/120k mi, 70%.", clause:"Tesla HV — 70%.", transfer:"Auto", exclusions:"As above", process:"Tesla app → SC" },
  { modelId:"byd-dolphin", oem:"BYD", years:8, km:200000, soh:70, note:"8yr/200k km (EU).", clause:"BYD EU — 70%.", transfer:"Free", exclusions:"Standard", process:"BYD dealer" },
  { modelId:"vw-id4", oem:"VW", years:8, km:160000, soh:70, note:"8yr/160k km, 70%.", clause:"VW HV — 70%.", transfer:"Free", exclusions:"Standard", process:"VW dealer" },
  { modelId:"ioniq5", oem:"Hyundai", years:8, km:160000, soh:70, note:"8yr/160k km (IN) / 10yr-100k mi (US).", clause:"Hyundai HV — 70%.", transfer:"Free", exclusions:"Standard", process:"Hyundai SC" },
  { modelId:"leaf40", oem:"Nissan", years:8, km:160000, soh:66, note:"8yr/100k mi; trigger = 9th capacity bar ≈ 66.25% (unique!). Gradual-capacity-loss exclusion heavily litigated.", clause:"Nissan EV Battery — loss of 4th bar (≈<66%) triggers.", transfer:"Auto", exclusions:"Gradual loss above bar threshold excluded — get LeafSpy cell report", process:"Nissan dealer + LeafSpy evidence" },
  { modelId:"zoe52", oem:"Renault", years:8, km:160000, soh:70, note:"8yr/160k km; leased-battery Zoes have separate Renault lease cover.", clause:"Renault HV — 70%.", transfer:"Free (owned-battery)", exclusions:"Leased packs differ", process:"Renault dealer" },
  { modelId:"mg4-64", oem:"MG", years:7, km:150000, soh:70, note:"7yr/150k km (UK/EU).", clause:"MG EU — 70%.", transfer:"Free", exclusions:"Standard", process:"MG dealer" },
  { modelId:"mach-e", oem:"Ford", years:8, km:160000, soh:70, note:"8yr/100k mi.", clause:"Ford HV — 70%.", transfer:"Auto", exclusions:"Standard", process:"Ford dealer" },
  { modelId:"bolt66", oem:"Chevrolet", years:8, km:160000, soh:60, note:"8yr/100k mi; GM trigger ~60% (lower than most — verify booklet year).", clause:"GM Bolt — ~60% propulsion-power trigger.", transfer:"Auto", exclusions:"Recall-fire packs replaced free regardless", process:"Chevy dealer" },
  { modelId:"polestar2", oem:"Polestar", years:8, km:160000, soh:70, note:"8yr/160k km.", clause:"Polestar HV — 70%.", transfer:"Free", exclusions:"Standard", process:"Polestar Space" }
];

/* ------------------------------------------------- 4. CLIMATE GRID (IMD normals + pack-effective temp) */
BF_DB.CLIMATE = {
  "Chennai":      { meanC:29.6, summerPeakC:40.5, effPackC:36.2, humidity:71, arrheniusNote:"Hottest metro + humidity → fastest calendar aging", zone:"Very Hot" },
  "Delhi":        { meanC:25.3, summerPeakC:45.0, effPackC:34.8, humidity:55, arrheniusNote:"Extreme summer spikes cook parked packs; winter reprieve", zone:"Hot-Extreme" },
  "Nagpur":       { meanC:27.7, summerPeakC:45.5, effPackC:35.9, humidity:52, arrheniusNote:"Central-India furnace", zone:"Very Hot" },
  "Ahmedabad":    { meanC:27.2, summerPeakC:43.5, effPackC:35.2, humidity:50, arrheniusNote:"Hot-dry, high under-bonnet soak", zone:"Very Hot" },
  "Hyderabad":    { meanC:26.7, summerPeakC:41.0, effPackC:33.4, humidity:58, arrheniusNote:"Hot Deccan plateau", zone:"Hot" },
  "Mumbai":       { meanC:27.5, summerPeakC:36.5, effPackC:33.1, humidity:74, arrheniusNote:"Humid-coastal, warm nights = no cool-down", zone:"Hot" },
  "Kolkata":      { meanC:26.8, summerPeakC:39.5, effPackC:33.6, humidity:73, arrheniusNote:"Humid heat, poor night cooling", zone:"Hot" },
  "Bengaluru":    { meanC:24.0, summerPeakC:36.0, effPackC:29.5, humidity:60, arrheniusNote:"Mild — baseline-friendly", zone:"Moderate" },
  "Pune":         { meanC:24.7, summerPeakC:38.0, effPackC:29.8, humidity:55, arrheniusNote:"Cool-dry nights — reference 'kind' city (≈1.9× kinder than Chennai at 100% SoC high-Ea NMC; Dubai ≈2.0× harsher)", zone:"Kind" },
  "Jaipur":       { meanC:25.0, summerPeakC:44.0, effPackC:34.0, humidity:45, arrheniusNote:"Desert spikes", zone:"Hot" },
  "Lucknow":      { meanC:25.5, summerPeakC:43.0, effPackC:33.8, humidity:60, arrheniusNote:"Hot Gangetic", zone:"Hot" },
  "Kochi":        { meanC:27.8, summerPeakC:35.5, effPackC:32.8, humidity:78, arrheniusNote:"Warm-humid year-round", zone:"Hot" },
  "Shillong":     { meanC:17.5, summerPeakC:27.0, effPackC:22.5, humidity:70, arrheniusNote:"Coolest — slowest aging in India", zone:"Cool" },
  "Berlin":       { meanC:9.8,  summerPeakC:31.0, effPackC:18.5, humidity:65, arrheniusNote:"Cool EU — calendar aging ~45% of Chennai", zone:"Cool" },
  "Oslo":         { meanC:6.3,  summerPeakC:26.0, effPackC:14.5, humidity:70, arrheniusNote:"Cold — minimal calendar fade but winter range dip", zone:"Cold" },
  "Dubai":        { meanC:28.5, summerPeakC:47.0, effPackC:37.5, humidity:55, arrheniusNote:"Harshest — parked-car ovens", zone:"Extreme" },
  "Singapore":    { meanC:27.9, summerPeakC:34.5, effPackC:33.0, humidity:82, arrheniusNote:"Constant warm-humid, no seasons", zone:"Hot" }
};

/* ------------------------------------------------- 5. MARKET BENCHMARKS (verified Oct-2026)
   v2026.14 FX honesty (audit §5): BOTH benchmarks kept side-by-side.
   rbiRef 88.50 = RBI reference (lags market). marketSnapshot 96.96 = open.er-api
   USD→INR probed 2026-10-12. inrUsd DEFAULTS to the market snapshot so offline
   math is ~current, and the UI shows staleness % whenever live is unreachable. */
BF_DB.MARKET = {
  updated:"2026-10-12",
  bnef: { globalPack_perKWh_usd:108, bevPack:99, essPack:70, lfpPack:81, nmcPack:128, china:84, na:121, eu:131, note:"BNEF Dec-2025 survey (record low, −8% YoY). SNAPSHOT — not live. 2026F ≈ $105, next survey Dec-2026. Always cite with Dec-2025 date." },
  essBuyback: { home_perKWh_usd:88, fleet_perKWh_usd:58, recycle_perKWh_usd:26, refurbCost_usd:320, installMargin:0.72, note:"Home-backup buyers pay most; recyclers pay floor. Refurb+cert cost ≈$320 (2W) / $900 (4W)." },
  inrUsd: 96.96, rbiRef: 88.50, fxSnapshotAt:"2026-10-12",
  resale: { certPremium_pct:9, gradeMultiplier:{ "A+":1.06,"A":1.03,"B+":1.0,"B":0.96,"C":0.89,"D":0.78 }, dealerMarginCut:0.88, uncertifiedDiscount:0.93, note:"Certified packs fetch +6–12% (Cars24/CarMax internal data 2025); AVILOO spread 13.5% ⇒ ₹60k on Ola / $5k on Model 3 at stake." },
  aviloo: { tests:500000, totalDb:1000000, maxSpread:13.5, modelY_50k:94.4, modelY_150k:90.3, id4_50k:95.3, id4_150k:90.6, leaf_50k:91.2, leaf_150k:86.7, note:"AVILOO Certified EV Battery Report, Sep 2-3 2026 (FLASH Test, 20 models @50k/100k/150k km; 16/20 still ≥90% @150k; full DB 1M+ tests). Rounded to 0.1% per audit." },
  sources: ["BNEF Lithium-Ion Battery Price Survey Dec-2025","IEA Global EV Outlook 2025/26","AVILOO Certified EV Battery Report Sep-2026 (500k tests)","Tata TPEM Lifetime HV Warranty booklet Jul-2025","Ola Electric Battery Warranty T&C 2024-26","WoodMac H1-2026 ESS outlook (AI-datacenter demand)","IMD climatological normals"]
};

/* grade helper */
BF_DB.gradeOf = function(soh){
  if(soh>=93) return "A+";
  if(soh>=88) return "A";
  if(soh>=80) return "B+";
  if(soh>=72) return "B";
  if(soh>=65) return "C";
  return "D";
};
BF_DB.gradeIN = { "A+":"Showroom-fresh — certify & demand top band", "A":"Healthy — above fleet median", "B+":"Normal wear — median band", "B":"Tired — price guard + warranty watch", "C":"Weak — file warranty / plan 2nd-life", "D":"Failed — warranty-or-replace territory" };

/* ------------------------------------------------- 6. ENTERPRISE LAYER v2026.14
   VALIDATION (audit P0-3): backtest vs AVILOO Sep-2026 published medians,
   Berlin (temperate), 20% DC, 70% avg SoC. Model v2026.14 (sublinear EFC^0.85
   + plateaued calendar). Residuals PUBLISHED — including the misses. The Leaf
   150k false-"FILE NOW" (v2026.12: 61.8 vs 86.7) now reads 85.3 vs 86.7
   (residual −1.4, HEALTHY verdict — correct side of the 66.25% trigger).
   Re-run: node tools/backtest.js (ships in repo). */
BF_DB.VALIDATION = {
  protocol:"8 AVILOO models × 2 mileage points (50k km/4yr, 150k km/12yr), Berlin temperate, 20% DC, 70% avg SoC. Run: node tools/backtest.js",
  avilooSource:"AVILOO Certified EV Battery Report Sep-2026 (500k+ FLASH Tests)",
  rows:[
    { model:"vw-id4",    at50k_model:94.5, at50k_aviloo:95.3, resid50k:-0.8, at150k_model:88.9, at150k_aviloo:90.6, resid150k:-1.7 },
    { model:"tesla-my",  at50k_model:94.5, at50k_aviloo:94.4, resid50k:0.1,  at150k_model:89.0, at150k_aviloo:90.3, resid150k:-1.3 },
    { model:"tesla-m3",  at50k_model:96.6, at50k_aviloo:93.8, resid50k:2.8,  at150k_model:93.3, at150k_aviloo:91.5, resid150k:1.8 },
    { model:"ioniq5",    at50k_model:94.5, at50k_aviloo:97.1, resid50k:-2.6, at150k_model:88.9, at150k_aviloo:93.0, resid150k:-4.1 },
    { model:"leaf40",    at50k_model:92.6, at50k_aviloo:91.2, resid50k:1.4,  at150k_model:84.6, at150k_aviloo:86.7, resid150k:-2.1 },
    { model:"zoe52",     at50k_model:95.1, at50k_aviloo:91.6, resid50k:3.5,  at150k_model:90.0, at150k_aviloo:90.1, resid150k:-0.1 },
    { model:"mach-e",    at50k_model:94.5, at50k_aviloo:95.1, resid50k:-0.6, at150k_model:88.9, at150k_aviloo:90.4, resid150k:-1.5 },
    { model:"polestar2", at50k_model:94.6, at50k_aviloo:95.0, resid50k:-0.4, at150k_model:89.0, at150k_aviloo:90.8, resid150k:-1.8 }
  ],
  summary:"mean |residual| @50k = 1.5 pts; @150k = 1.8 pts (v2026.12 was ~2.4 @50k and −15.0 worst-case @150k). Worst misses, published not hidden: ioniq5 −4.1 @150k (heat-pump E-GMP long-soak under-modelled) and zoe52 +3.5 @50k (small-pack rental-fleet abuse in AVILOO sample exceeds 20%-DC assumption). Model 3 AVILOO median mixes LFP+NMC trims; ours is LFP-only (+2.8 @50k). Geotab Jan-2026 cross-check (22,700 EVs): fleet 2.3%/yr; model yr-1..4 perYr 2.0–2.6%/yr, flattening after — consistent.",
  verdictRule:"No model at 150k sits on the wrong side of its warranty trigger. v2026.12 Leaf false-ELIGIBLE is closed."
};
BF_DB.VERSION = "2026.16-enterprise";
BF_DB.CONTACT = { email:"support@batteryforensics.in", correctionsSlaDays:7,
  edaakhil:"https://edaakhil.nic.in/", ccpaHelpline:"1915", carbTitle13:"https://govt.westlaw.com/calregs" };
/* Canonical entity — ONE name everywhere (schema/PDF/QR/footer/OG). */
BF_DB.ENTITY = { name:"BijliBureau", legalSuffix:"BijliBureau Lab (research unit)",
  url:"https://batteryforensics.in/", email:"support@batteryforensics.in",
  sameAs:["https://github.com/dipakjad1993/Bijli-Bureau",
    "https://www.linkedin.com/company/bijlibureau/",
    "https://www.youtube.com/@bijlibureau",
    "https://www.crunchbase.com/organization/bijlibureau"],
  knowsAbout:["EV battery State of Health","EU Battery Regulation 2023/1542","Indian EV warranty law (CPA 2019)","California 13 CCR 1962.5 SoH standardization"] };
BF_DB.AUTHOR = { "@type":"Person", name:"Dipak Jadhav", jobTitle:"Founder, BijliBureau — EV battery forensics",
  url:"https://batteryforensics.in/author.html",
  image:"https://batteryforensics.in/og/hero-card.png",
  knowsAbout:["EV battery State of Health","EU Battery Regulation 2023/1542","Indian EV warranty law (CPA 2019)","California 13 CCR 1962.5"],
  worksFor:{ "@type":"Organization", name:"BijliBureau", url:"https://batteryforensics.in/" } };
BF_DB.SOURCES_DETAILED = [
  { key:"BNEF-2025", title:"BNEF Lithium-Ion Battery Price Survey Dec-2025", url:"https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-fall-to-108-per-kilowatt-hour-despite-rising-metal-prices-bloombergnef", verified:"2025-12-09", confidence:"high", figures:{ global:108, bev:99, ess:70, lfp:81, nmc:128, china:84, na:121, eu:131 } },
  { key:"AVILOO-2026-09", title:"AVILOO Certified EV Battery Report Sep-2026 (500k+ FLASH Tests, 1M+ DB)", url:"https://aviloo.com/files/Aviloo/Presse/Berichte/AVILOO%20Launches%20Worlds%20Largest%20Independent%20EV%20Battery%20Study.pdf", url2:"https://electrek.co/2026/09/03/evs-retain-battery-best-aviloo-largest-study", verified:"2026-09-03", confidence:"high", figures:{ tests:500000, totalDb:1000000, spread:13.5, modelY_50k:94.4, modelY_150k:90.3, id4_50k:95.3, id4_150k:90.6, leaf_50k:91.2, leaf_150k:86.7 } },
  { key:"TPEM-LIFETIME-2025-07", title:"Tata TPEM Lifetime HV Battery Warranty booklet Jul-2025", url:"https://www.tataev.com", verified:"2025-07-20", confidence:"high" },
  { key:"OLA-TOPUP-2024-26", title:"Ola Electric Battery Warranty + Top-up T&C 2024-26", url:"https://www.olaelectric.com", verified:"2026-03-01", confidence:"medium-high" },
  { key:"WOODMAC-H1-2026", title:"WoodMac H1-2026 ESS outlook (AI-datacenter demand)", url:"https://www.woodmac.com", verified:"2026-06-30", confidence:"medium" },
  { key:"EU-2023-1542", title:"EU Batteries Regulation 2023/1542 + DPP Guidance Aug-2026 (71 data points, registry live 20-Jul-2026, mandatory 18-Feb-2027)", url:"https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/batteries_en", verified:"2026-08-21", confidence:"high" },
  { key:"IMD-NORMALS", title:"IMD climatological normals (city means)", url:"https://mausam.imd.gov.in", verified:"2024-01-01", confidence:"medium-high" }
];
/* New 2026 chemistries (additive — fadePerEFC_pct = 20/cycleLife, same rule) */
BF_DB.CHEMISTRY["NMC9-SI"] = { name:"NMC 9-series + Si anode (2025+ high-density)", cathode:"LiNi0.9Mn0.05Co0.05O2 + SiOx", nominalV:3.7, curve:"sloped", flatPlateau:"linear 3.3→4.25V, Si swelling knee", cycleLife:1300, calendarBase:2.0, Ea_Jmol:43000, fadePerEFC_pct:0.0154, fastPenalty:1.2, thermalSafeC:42, signature:"Highest density, fastest calendar fade; Si expansion + micro-cracking above 4.2V", pros:"280–320 Wh/kg", cons:"Strict 20–80%, needs preconditioning", detectHint:"2025+ premium LR trims, 800V packs" };
BF_DB.CHEMISTRY["SEMISOLID"] = { name:"Semi-solid / condensed-matter (NIO/Toyota class)", cathode:"NMC + solid electrolyte blend", nominalV:3.75, curve:"sloped", flatPlateau:"gentle slope, low taper", cycleLife:1600, calendarBase:1.7, Ea_Jmol:39000, fadePerEFC_pct:0.0125, fastPenalty:1.0, thermalSafeC:45, signature:"Low self-discharge, calendar-friendly; field data sparse — CI widened", pros:"High density + safety", cons:"Sparse field data, costly", detectHint:"150 kWh semi-solid options" };
BF_DB.CHEMISTRY["SODIUM-G2"] = { name:"Sodium-ion Gen2 (CATL Naxtra class)", cathode:"Na layered oxide Gen2", nominalV:3.1, curve:"sloped", flatPlateau:"sloped 2.4→4.0V", cycleLife:3000, calendarBase:1.15, Ea_Jmol:25000, fadePerEFC_pct:0.0067, fastPenalty:0.45, thermalSafeC:60, signature:"Heat-tolerant, 8C-capable; cold-derate ~25% at 0°C", pros:"No lithium, cheap, abuse-tolerant", cons:"~150–180 Wh/kg", detectHint:"Entry 2W + urban 4W 2026+" };
/* EU DPP 71-field subset mapped to this tool (pre-DPP) + FULL v2 MAP (71 rows).
   v2 flags: mandatory@2027 / conditional / deferred(instrument+date) / na-for-EV.
   Deferred per Oct-2026 law: carbon footprint declaration+label (awaiting Art.7
   delegated+implementing acts, unadopted) · responsible sourcing → 18 Aug 2027
   (Reg 2025/1561) · recycled Co/Li/Ni/Pb shares (Art.8 + delegated act; docs
   from Aug-2028) · instructions-for-use (Omnibus COM(2025)504, unadopted).
   Registry live 20 Jul 2026 (IR 2026/1778); UID upload Art.77(10) required;
   access-rights act Art.77(9) due 18 Aug 2026 MISSED — draft Have-your-say
   Oct–Nov 2026, adoption targeted Q4 2026 (defines RESTRICTED tier incl. SoH).
   QR: draft delegated act (feedback till 27 Oct 2026) pins QR→EN 18220:2026,
   identifier→EN 18219:2026 "or equivalent" (ISO/IEC 15459 / GS1 usable).
   New mandatory EV fields at Feb-2027 modelled here: SOCE (State of Certified
   Energy), capacity fade, resistance increase, lifecycle status. */
BF_DB.DPP_MAP = {
  standard:"EU 2023/1542 Annex XIII + Aug-2026 Guidance v2.0 (71 pts)", mandatory_from:"2027-02-18", registry_live:"2026-07-20",
  disclaimer:"This tool emits a PRE-PASSPORT evidence credential (BATTCERTv3/DPPpre), NOT an Art.77 passport. Passport issuance is the economic operator's legal duty.",
  qrSpec:{ identifierStd:"EN 18219:2026 or equivalent (ISO/IEC 15459 / GS1)", carrierStd:"EN 18220:2026 or equivalent",
    template:"https://batteryforensics.in/cert/#{uid} → registry-resolved; payload carries public tier inline, restricted by reference",
    accessTiers:{ public:["battery ID","chemistry","rated kWh","SoH% + band + SOCE","cycles/EFC","warranty trigger + clause"], legitimate_interest:["VIN-hash","ODD cell delta-V log","service history refs"], authority:["full VIN","raw telemetry","operator docs"] } },
  fields:[
    { dpp:"1(a) battery ID + model/batch/serial", local:"model.id + VIN-hash + timestamp", status:"mapped" },
    { dpp:"1(g) rated capacity Ah + kWh", local:"model.kwh + chemistry nominalV", status:"mapped" },
    { dpp:"1(k) exhaustion threshold + basis (EV only, no universal 80%)", local:"warranty.soh trigger + clause text", status:"mapped" },
    { dpp:"1(o) internal resistance", local:"OBD cell delta-V proxy (mapped when OBD present, else estimated)", status:"partial" },
    { dpp:"1(p) C-rate of cycle-life test", local:"fastPct + fastPenalty + ultra flag", status:"mapped" },
    { dpp:"2(a-c) carbon footprint + method + PEF link", local:"BNEF anchor + route note (operator to attach PEF study)", status:"operator-attach" },
    { dpp:"2(d) safety measures", local:"thermalSafeC + service + checklist", status:"mapped" },
    { dpp:"3 test reports (compliance)", local:"method + SHA-256 evidence PDF hash", status:"mapped" },
    { dpp:"SoH + cycles + durability (performance class)", local:"soh ±CI + EFC + cyclesLeft + trajectory", status:"mapped" },
    { dpp:"SOCE — State of Certified Energy (mandatory EV @Feb-2027)", local:"soh + usableNow kWh (certified-energy slot in BATTCERTv3 payload)", status:"mapped" },
    { dpp:"Capacity fade + resistance increase (mandatory EV @Feb-2027)", local:"cycleFade/calendarFade split + OBD delta-V proxy", status:"mapped" },
    { dpp:"Lifecycle status: original/re-used/repurposed/remanufactured/waste", local:"second-life route gate (>70 reuse / 50–70 ESS / <50 recycle) + status label", status:"mapped" }
  ]
};
/* FULL 71-row DPP v2 table — generated into eu-battery-passport-qr/ as a crawlable table.
   Each row: { n, dpp, tier: public|legitimate|authority, flag, local } */
BF_DB.DPP71 = [
  { n:1, dpp:"Manufacturer identification + contact", tier:"public", flag:"mandatory@2027", local:"operator-attach (tool prints reporter name + support@batteryforensics.in evidence contact)" },
  { n:2, dpp:"Battery category (EV / LMT / industrial / SLI / portable)", tier:"public", flag:"mandatory@2027", local:"mapped: seg 2W→LMT-class note / 4W→EV" },
  { n:3, dpp:"Battery model identifier + batch/serial", tier:"public", flag:"mandatory@2027", local:"mapped: model.id + VIN-hash + timestamp UID" },
  { n:4, dpp:"Place + date of manufacture", tier:"public", flag:"mandatory@2027", local:"mapped: purchaseDate proxy + booklet-year gate (operator confirms)" },
  { n:5, dpp:"Weight (kg)", tier:"public", flag:"mandatory@2027", local:"conditional: operator spec sheet (not modelled — flagged)" },
  { n:6, dpp:"Chemistry (cathode/anode/electrolyte)", tier:"public", flag:"mandatory@2027", local:"mapped: CHEMISTRY cathode + nominalV + curve" },
  { n:7, dpp:"Rated capacity (Ah) + rated energy (kWh)", tier:"public", flag:"mandatory@2027", local:"mapped: model.kwh + nominalV-derived Ah" },
  { n:8, dpp:"Nominal voltage", tier:"public", flag:"mandatory@2027", local:"mapped: chemistry nominalV" },
  { n:9, dpp:"Minimum / nominal / maximum power (kW)", tier:"public", flag:"mandatory@2027", local:"conditional: operator datasheet (flagged, not invented)" },
  { n:10, dpp:"Expected lifetime (cycles + calendar years)", tier:"public", flag:"mandatory@2027", local:"mapped: cycleLife + trajectory yearsTo70 ±band" },
  { n:11, dpp:"Capacity threshold for exhaustion / end-of-first-life basis", tier:"public", flag:"mandatory@2027", local:"mapped: warranty.soh trigger + clause (no universal 80%)" },
  { n:12, dpp:"SoH — State of Health % (RESTRICTED tier pending Art.77(9))", tier:"authority", flag:"mandatory@2027", local:"mapped: soh ±CI + fuseSrc + raw (public shows band, raw by legitimate-interest)" },
  { n:13, dpp:"SOCE — State of Certified Energy (mandatory EV @Feb-2027)", tier:"public", flag:"mandatory@2027", local:"mapped: usableNow kWh + method line (BATTCERTv3 soce_kwh slot)" },
  { n:14, dpp:"Capacity fade (Ah/kWh lost vs rated)", tier:"public", flag:"mandatory@2027", local:"mapped: cycleFade + calendarFade split" },
  { n:15, dpp:"Internal resistance increase (ΔmΩ / %)", tier:"legitimate", flag:"mandatory@2027", local:"partial: OBD cell delta-V proxy when present, else estimated + labelled" },
  { n:16, dpp:"Round-trip / energy efficiency (%)", tier:"public", flag:"conditional", local:"conditional: CSV round-trip when charge log present" },
  { n:17, dpp:"Self-discharge rate", tier:"public", flag:"conditional", local:"conditional: not modelled — operator test report ref" },
  { n:18, dpp:"C-rate capability of cycle-life test", tier:"public", flag:"mandatory@2027", local:"mapped: fastPct + fastPenalty + ultra flag" },
  { n:19, dpp:"Cycle-life test conditions (T, DoD, C-rate)", tier:"public", flag:"mandatory@2027", local:"mapped: Tpack + DoDstress + CrateStress printed" },
  { n:20, dpp:"Calendar-life test conditions", tier:"public", flag:"conditional", local:"mapped: plateaued eff-age + Arrhenius(Ea,R,Tpack) line" },
  { n:21, dpp:"Temperature range (use / storage)", tier:"public", flag:"mandatory@2027", local:"mapped: thermalSafeC envelope + city pack temp" },
  { n:22, dpp:"Lifecycle status: original / re-used / repurposed / remanufactured / waste", tier:"public", flag:"mandatory@2027", local:"mapped: second-life gate label" },
  { n:23, dpp:"History of status transitions + responsible operator per transition", tier:"legitimate", flag:"mandatory@2027", local:"partial: vault run-history + timestamp chain (operator confirms)" },
  { n:24, dpp:"Date of first placing on the market", tier:"public", flag:"mandatory@2027", local:"mapped: purchaseDate (operator confirms)" },
  { n:25, dpp:"Change of status events (repair / repurpose / remanufacture)", tier:"legitimate", flag:"conditional", local:"partial: vault + PDF hash chain" },
  { n:26, dpp:"Carbon footprint declaration (kgCO2e/kWh)", tier:"public", flag:"deferred:awaiting Art.7 delegated+implementing acts (unadopted)", local:"operator-attach: PEF study ref (tool never invents carbon numbers)" },
  { n:27, dpp:"Carbon footprint performance class / label", tier:"public", flag:"deferred:awaiting Art.7 acts", local:"operator-attach" },
  { n:28, dpp:"Carbon footprint calculation method + PEF link + version", tier:"public", flag:"deferred:awaiting Art.7 acts", local:"operator-attach" },
  { n:29, dpp:"Responsible sourcing / due-diligence report", tier:"public", flag:"deferred:→18 Aug 2027 (Reg 2025/1561)", local:"operator-attach" },
  { n:30, dpp:"Recycled content shares: Co / Li / Ni / Pb (%)", tier:"public", flag:"deferred:Art.8 + delegated act; docs from Aug-2028", local:"operator-attach" },
  { n:31, dpp:"Recycled content methodology + verification", tier:"public", flag:"deferred:Art.8 delegated act", local:"operator-attach" },
  { n:32, dpp:"Hazardous substances (SVHC / RoHS-relevant)", tier:"public", flag:"mandatory@2027", local:"operator-attach (SDS ref)" },
  { n:33, dpp:"Safety measures + thermal-propagation safeguards", tier:"public", flag:"mandatory@2027", local:"mapped: thermalSafeC + service checklist" },
  { n:34, dpp:"Safety test reports (UN 38.3 / GB / UL refs)", tier:"public", flag:"mandatory@2027", local:"operator-attach (tool prints method + hash, not certs)" },
  { n:35, dpp:"Instructions for use (handling / charging / storage)", tier:"public", flag:"deferred:Omnibus COM(2025)504 unadopted", local:"mapped: charging-band + shade-park guidance (operator manual governs)" },
  { n:36, dpp:"Maintenance / service history refs", tier:"legitimate", flag:"conditional", local:"mapped: serviced flag + checklist + vault refs" },
  { n:37, dpp:"Warranty terms (duration / km / trigger / remedy)", tier:"public", flag:"mandatory@2027", local:"mapped: full WARRANTY rule + clause + transfer + exclusions" },
  { n:38, dpp:"Warranty provider + claim contact", tier:"public", flag:"mandatory@2027", local:"mapped: OEM + process + support@batteryforensics.in evidence contact" },
  { n:39, dpp:"Repairability / disassembly information", tier:"legitimate", flag:"conditional", local:"operator-attach" },
  { n:40, dpp:"Spare-parts availability (duration + source)", tier:"public", flag:"conditional", local:"operator-attach" },
  { n:41, dpp:"Dismantling + discharge instructions (authorities/recyclers)", tier:"authority", flag:"mandatory@2027", local:"operator-attach" },
  { n:42, dpp:"End-of-life / take-back + collection point info", tier:"public", flag:"mandatory@2027", local:"mapped: second-life routes + recycler floor + take-back note" },
  { n:43, dpp:"Recycling efficiency + material-recovery shares", tier:"public", flag:"conditional", local:"operator-attach (recycler cert)" },
  { n:44, dpp:"Second-life suitability assessment", tier:"public", flag:"mandatory@2027", local:"mapped: reuse/ESS/recycle gate + net USD/INR" },
  { n:45, dpp:"Repurposing / remanufacturing operator + date", tier:"legitimate", flag:"conditional", local:"operator-attach (vault chain when repurposed)" },
  { n:46, dpp:"Unique identifier (UID) per IR 2026/1778 + registry entry", tier:"public", flag:"mandatory@2027", local:"mapped: BATTCERTv3 uid (EN 18219 or equiv) + registry-resolve URL template" },
  { n:47, dpp:"Data carrier (QR) spec + print size + placement", tier:"public", flag:"mandatory@2027", local:"mapped: EN 18220 or equiv, 25mm print guidance" },
  { n:48, dpp:"API / data-exchange endpoint (EN 18216–18223)", tier:"legitimate", flag:"mandatory@2027", local:"mapped: /api/v1/forensic JSON + QR-resolve (static API shim ships)" },
  { n:49, dpp:"Access-rights tier per data point (public / legitimate / authority)", tier:"public", flag:"mandatory@2027 (Art.77(9) draft Oct–Nov 2026, adoption Q4 2026)", local:"mapped: three-tier payload design (config flag, not schema change)" },
  { n:50, dpp:"Economic operator (manufacturer / importer / authorised rep)", tier:"public", flag:"mandatory@2027", local:"operator-attach" },
  { n:51, dpp:"Notified-body / conformity-assessment refs", tier:"public", flag:"conditional", local:"operator-attach" },
  { n:52, dpp:"EU declaration of conformity (DoC) ref", tier:"public", flag:"mandatory@2027", local:"operator-attach" },
  { n:53, dpp:"Test reports: capacity / power / safety / durability", tier:"public", flag:"mandatory@2027", local:"mapped: method + SHA-256 evidence-hash (operator lab reports attach)" },
  { n:54, dpp:"Lab accreditation (ISO 17025) + test dates", tier:"public", flag:"conditional", local:"operator-attach" },
  { n:55, dpp:"Supply-chain actor list (cell/module/pack plants)", tier:"legitimate", flag:"conditional", local:"operator-attach" },
  { n:56, dpp:"Raw-material origin (mine/refiner, where required)", tier:"legitimate", flag:"deferred:→18 Aug 2027 (Reg 2025/1561)", local:"operator-attach" },
  { n:57, dpp:"Manufacturing addresses (cell → pack)", tier:"legitimate", flag:"conditional", local:"operator-attach" },
  { n:58, dpp:"Importer / distributor details (EU)", tier:"public", flag:"conditional", local:"operator-attach" },
  { n:59, dpp:"Extended producer responsibility (EPR) registration", tier:"public", flag:"mandatory@2027", local:"operator-attach" },
  { n:60, dpp:"Labelling: CE + separate-collection + chemistry symbols", tier:"public", flag:"mandatory@2027", local:"operator-attach (label artwork)" },
  { n:61, dpp:"Capacity label (kWh) + power label", tier:"public", flag:"mandatory@2027", local:"mapped: kwh + nominalV power note" },
  { n:62, dpp:"Durability / performance class label", tier:"public", flag:"conditional", local:"mapped: grade A+–D + band (operator class governs)" },
  { n:63, dpp:"QR link target URL + fallback human-readable URL", tier:"public", flag:"mandatory@2027", local:"mapped: cert URL template + text payload" },
  { n:64, dpp:"Registry upload timestamp + UID registration proof", tier:"public", flag:"mandatory@2027", local:"operator-attach (Art.77(10) duty)" },
  { n:65, dpp:"Data persistence guarantee (EN 18221) + retention period", tier:"public", flag:"mandatory@2027", local:"mapped: vault + hash-chain + retention note (operator registry governs)" },
  { n:66, dpp:"Data authenticity / integrity mechanism (hash / signature)", tier:"public", flag:"mandatory@2027", local:"mapped: SHA-256 + optional Ed25519 detached signature (key on-domain)" },
  { n:67, dpp:"Correction / update log (who/when/what)", tier:"legitimate", flag:"mandatory@2027", local:"mapped: corrections policy (7-day SLA) + versioned dataset" },
  { n:68, dpp:"Language availability of passport data", tier:"public", flag:"conditional", local:"mapped: I18N en/de/fr labels (DPP export)" },
  { n:69, dpp:"Accessibility of passport data (WCAG / machine-readable)", tier:"public", flag:"conditional", local:"mapped: JSON payload + tables (this page)" },
  { n:70, dpp:"Complaints / non-conformity contact + market-surveillance ref", tier:"public", flag:"mandatory@2027", local:"mapped: CPA-2019 / MVBER procedural refs + corrections inbox" },
  { n:71, dpp:"End-of-waste / second-life passport transfer ref", tier:"legitimate", flag:"conditional", local:"mapped: status-transition chain (vault + hash)" }
];
/* California 2026+ regulatory layer (13 CCR + DMV Jan-2027). Underplayed elsewhere — shipped here. */
BF_DB.CARB = { std:"13 CCR §1962.5(c)(4)(A)4.c + (c)(6) + §1962.7 + §1962.8; CA DMV used-EV disclosure eff. Jan 2027",
  sohAccuracyPp:5, dashDisplay:true, warranty:"SoH<70% 8yr/100k mi (MY2026–30); <75% from MY2031",
  enforcement:"CARB sample-test; recall if >30% sampled report >8pp high (MY26–28) / >5pp high (MY29+)",
  dmvDisclosure:["SoH% or est. remaining range","last OTA version affecting BMS/range","battery replaced/repaired status + date","remaining warranty + transferability","open HV recalls"],
  dmvNote:"Third-party diagnostics allowed if DMV-certified; 3-yr retention, random audits, fines.",
  toolVsReg:"This tool's band (±1.8 OBD-strong → ±3.7 old-NMC model-only) sits INSIDE the 5pp manufacturer accuracy ceiling — visual on us/carb-soh-standard/." };
/* i18n stub (EN default; DE/FR labels for DPP export) */
BF_DB.I18N = {
  en:{ soh:"State of Health", warranty:"Warranty verdict", usable:"Usable energy" },
  de:{ soh:"Gesundheitszustand (SoH)", warranty:"Garantieurteil", usable:"Nutzbare Energie" },
  fr:{ soh:"État de santé (SoH)", warranty:"Verdict de garantie", usable:"Énergie utilisable" }
};
BF_DB.t = function(lang, key){ return ((BF_DB.I18N[lang]||{})[key]) || BF_DB.I18N.en[key] || key; };
/* Live overrides (offline-first; applied when online, never break offline) */
BF_DB.LIVE = { fx:{ value:96.96, src:"market snapshot 2026-10-12", at:"2026-10-12" }, bnefPack:{ value:108, at:"2025-12-09" }, climateOverride:{}, status:"offline-snapshot" };
BF_DB.applyLive = async function(onUpdate){
  const out = { fx:null, climate:null };
  try{
    const fxR = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000) });
    const fxJ = await fxR.json();
    if(fxJ && fxJ.rates && fxJ.rates.INR){ BF_DB.LIVE.fx = { value:+fxJ.rates.INR.toFixed(2), src:"open.er-api live", at:new Date().toISOString().slice(0,10) }; BF_DB.MARKET.inrUsd = BF_DB.LIVE.fx.value; out.fx = BF_DB.LIVE.fx; }
  }catch(e){ /* keep fallback */ }
  try{
    const cities = ["Chennai","Delhi","Pune","Mumbai"];
    const latlon = { Chennai:"13.08,80.27", Delhi:"28.61,77.20", Pune:"18.52,73.85", Mumbai:"19.07,72.87" };
    for(const c of cities){
      try{
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude="+latlon[c].split(",")[0]+"&longitude="+latlon[c].split(",")[1]+"&current=temperature_2m&timezone=auto", { signal: AbortSignal.timeout(5000) });
        const j = await r.json();
        if(j && j.current && typeof j.current.temperature_2m === "number"){ BF_DB.LIVE.climateOverride[c] = { ambientNowC:j.current.temperature_2m, at:new Date().toISOString() }; }
      }catch(_){/* per-city best effort */}
    }
    if(Object.keys(BF_DB.LIVE.climateOverride).length){ out.climate = BF_DB.LIVE.climateOverride; BF_DB.LIVE.status = "live-partial"; }
  }catch(e){}
  if(out.fx || out.climate){ BF_DB.LIVE.status = "live"; }
  try{ if(typeof onUpdate === "function") onUpdate(BF_DB.LIVE); }catch(e){}
  return BF_DB.LIVE;
};
/* Central money formatter (locale + FX timestamp) */
BF_DB.fmtMoney = function(usdVal, opts){
  opts = opts || {};
  if(opts.usd){ return "$" + Math.round(usdVal).toLocaleString("en-US"); }
  const inr = usdVal * BF_DB.MARKET.inrUsd;
  return "₹" + Math.round(inr).toLocaleString("en-IN");
};
/* Analytics + telemetry transport config (v2026.14 honesty, audit §5).
   SHIP WITH NULLS: dataLayer collects locally from first paint; NOTHING leaves
   the device until the deployer sets these. Setting them is a one-line deploy
   change, documented in Methodology §5 + README. */
BF_DB.ANALYTICS = {
  ga4Id: null,               // e.g. "G-XXXXXXX" → loads gtag.js (anonymize_ip) on first event
  telemetryEndpoint: null,   // e.g. "https://api.batteryforensics.in/v1/soh-index" → opt-in sendBeacon POST
  note: "Unconfigured: analytics local-only by design. Consent checkbox gates the local outbox queue (bf-soh-index-outbox, cap 200) + POST when an endpoint exists. DPDP/GDPR."
};
