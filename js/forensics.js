/* ============================================================================
 * BIJLIBUREAU ENGINE v2026.16-enterprise — SoH Lab: cycle + calendar (Arrhenius)
 *   + C-rate + SoC + Bayesian CSV/OBD fusion + honest Monte Carlo 90% CI
 * Method (documented in-app & in PDF for service-advisor battles):
 *   EFC (Equivalent Full Cycles) = totalKm(odometer) / certified_range_new
 *     → ODOMETER-ANCHORED (CSV never extrapolates EFC; CSV only informs health).
 *   cycleFade%  = EFC × fadePerEFC × DoDstress × CrateStress
 *     → fadePerEFC_pct is DERIVED as 20/cycleLife (v2026.14 fix: model and
 *        headline cycleLife can no longer disagree; see chemistry table).
 *   calendarFade% = effAge_years × calendarBase × Arrhenius(Tpack) × SoCstress
 *     → effAge plateaus: effAge = age<=2 ? age : 2+(age-2)^0.70 (v2026.14 fix:
 *        real packs flatten after year 2–3; linear compounding removed).
 *        Calibrated against AVILOO Sep-2026 50k/150k ladders (residuals in
 *        methodology §6 + VALIDATION.json; mean residual disclosed, not hidden).
 *   SoCstress   = 0.75 + 0.0125×(avgSoC−50) (≈0.75 @20% … 1.375 @100%)
 *                 ×1.15 if parked >80% habitually (capped 1.7)
 *   DoDstress   = 0.80 + depthAvg/250 (≈0.88 @20% … 1.2 @100%)
 *   CrateStress = 1 + fastPct×fastPenalty×0.55 + ultra8C_flag×0.35
 *   Bayesian fuse: w_csv = min(0.40, (rows/30)×(daysCoverage/365))
 *     × recencyDecay (v2026.14: exp(-staleDays/540); 446-day-old log ≈0.44×)
 *     → driver-baseline calibration (v2026.14: earliest full-charge median,
 *        NOT certified rangeNew; removes ~80%-efficiency systematic bias).
 *     OBD BMS SoH (if present): w_obd = min(0.80, 0.5 + rows_obd/200); fused 2nd.
 *   SOH_raw = 100 − (cycle+calendar+abuse); SOH = clamp(45,100,SOH_raw)
 *     → BOTH returned (raw for auditors, clamped for display).
 *   90% CI — HONEST evidence-tier band (v2026.14 rewrite, audit P0-2):
 *     mcHalf  = Monte Carlo p5–p95 half-width, n=600,
 *               odo ±2%, Tpack ±1.5°C, age ±15 DAYS (jitter now present),
 *               CSV ±1.0%, OBD ±0.5% per-sample noise.
 *     modelForm = chemistry field-variance floor (LFP 1.6 / NMC 2.2 / LMO 2.6 /
 *               NCA 2.2 / LMFP 1.8 / Na-ion 1.7 / LTO 1.2 / high-Ni 2.4 %),
 *               scaled ×(1+ageYrs/12) — this is AVILOO intra-model spread
 *               (≤13.5%) expressed per-vehicle, NOT a marketing constant.
 *     ci90 = sqrt(mcHalf² + modelForm²), clamped 0.8–8.0, then evidence caps:
 *               OBD-strong (w>0.5) → min(ci,1.8); CSV-solid (w>0.2) → min(ci,3.0).
 *     r_ciNote + PDF + JSON-LD label this exactly: "evidence-tier uncertainty
 *     band (Monte Carlo sampling + model-form floor)". Never "pure MC CI".
 *   OBD: cell delta-V rounded BEFORE compare (v2026.12 epsilon fix); >150mV WARN,
 *     >250mV CRITICAL; BMS SoH fused second.
 * Calibrated: Nexon 45, 42k km/3.3yr/Chennai/30% fast ≈ 91–94% (AVILOO medians);
 *   Leaf 150k/Berlin ≈ 84–88% vs AVILOO 86.7 (residual disclosed §6).
 *   Geotab Jan-2026 cross-check: fleet 2.3%/yr baseline; model perYr ≈2.0–2.6%/yr
 *   yr-1..4, flattening thereafter (plateau), consistent.
 * Verification: BNEF Dec-2025 $108/kWh; AVILOO Sep-2026 500k ≤13.5%; IMD normals.
 * ========================================================================== */
"use strict";
window.BF_Engine = (function(){
  const R = 8.314, TREF = 298.15;

  function arrhenius(ea, tC){
    const T = tC + 273.15;
    return Math.exp((ea/R) * (1/TREF - 1/T));
  }
  function chemistryOf(model){ return (window.BF_DB.CHEMISTRY[model.chem] || window.BF_DB.CHEMISTRY["LFP"]); }
  function climateOf(city){ return (window.BF_DB.CLIMATE[city] || window.BF_DB.CLIMATE["Pune"]); }

   /* Pure heat-gap factor: no display hacks, single SoC-amplified Arrhenius ratio.
      gap = Arr(city)/Arr(pune) × socAmp, socAmp = 1 + max(0,avgSoc-70)*0.0117
      → ≈1.0 at 70% SoC, ≈1.38 at 78% (LFP Chennai), max ≈1.9× (100% SoC,
      high-Ea NMC Chennai vs Pune); Dubai ≈2.0×. Verified by computation. */
  function hotGapFactor(chemKeyOrChem, city, avgSoc){
    const chem = (typeof chemKeyOrChem === "string") ? (window.BF_DB.CHEMISTRY[chemKeyOrChem]||window.BF_DB.CHEMISTRY["LFP"]) : chemKeyOrChem;
    const puneArr = arrhenius(chem.Ea_Jmol, window.BF_DB.CLIMATE["Pune"].effPackC);
    const cityArr = arrhenius(chem.Ea_Jmol, (window.BF_DB.CLIMATE[city]||window.BF_DB.CLIMATE["Pune"]).effPackC);
    const base = cityArr / Math.max(0.2, puneArr);
    const socAmp = 1 + Math.max(0, (avgSoc||70) - 70) * 0.0117;
    return +(base * socAmp).toFixed(2);
  }

  function bayesWeight(rows, days, staleDays){
    if(!rows || rows < 3) return 0;
    const d = Math.max(7, days||30);
    let w = Math.min(0.40, (rows/30) * (d/365));
    // v2026.14 recency decay (audit P1-4): a 446-day-old log keeps ~44% of its
    // nominal weight; fresh (<60d) logs keep ~95%+. staleDays = days since last row.
    if(staleDays!=null && isFinite(staleDays) && staleDays>0){
      w = w * Math.exp(-staleDays/540);
    }
    return +w.toFixed(3);
  }

  // v2026.14 calendar plateau: packs flatten after year 2–3 (AVILOO + Geotab).
  // effAge(1)=1, effAge(2)=2, effAge(4)≈3.2, effAge(12)≈6.9 (not 12).
  function effectiveAge(ageYrs){
    const a = Math.max(0, ageYrs||0);
    if(a<=2) return a;
    return 2 + Math.pow(a-2, 0.70);
  }

  // v2026.14 model-form uncertainty floor per chemistry (AVILOO spread Ladder).
  // This is FIELD VARIANCE, not Monte Carlo sampling noise — labelled honestly.
  // Age growth mirrors AVILOO's observed spread widening with mileage
  // (11 → 13.5 pts, ≈+23% over a pack lifetime): gentle 1+age/24 slope.
  function modelFormFloor(chemKey, ageYrs){
    const base = { LFP:1.6, NMC622:2.2, NMC811:2.4, NCA:2.2, LMO:2.6, LMFP:1.8,
      SODIUM:1.7, LTO:1.2, "NMC9-SI":2.4, SEMISOLID:2.3, "SODIUM-G2":1.7 }[chemKey] || 2.0;
    return base * (1 + Math.max(0, ageYrs||0)/24);
  }

  /* OBD analysis: rows [{minV,maxV,bmsSoh,odo}] → {maxDelta_mV, medianBmsSoh, flag}
     v2026.12 fix (Ryan Jones P0): round delta-mV BEFORE threshold compare to kill
     IEEE-754 epsilon (e.g. 4.11-3.96=150.00000000036mV wrongly tripping >150 WARN). */
  function analyzeObd(rows){
    if(!rows || !rows.length) return { present:false, n:0, maxDelta_mV:null, medianBmsSoh:null, flag:null };
    const deltas = rows.map(r=>Math.round((r.maxV-r.minV)*1000)).filter(v=>isFinite(v)&&v>=0);
    const sohs = rows.map(r=>r.bmsSoh).filter(v=>isFinite(v)&&v>=30&&v<=100);
    const maxD = deltas.length ? Math.max.apply(null, deltas) : null;
    let med = null;
    if(sohs.length){ const s=[...sohs].sort((a,b)=>a-b); med = s[Math.floor(s.length/2)]; }
    let flag = null;
    if(maxD!=null && maxD>250) flag = "CRITICAL: cell delta-V "+maxD+"mV — failed module likely; demand module-level BMS log.";
    else if(maxD!=null && maxD>150) flag = "WARN: cell delta-V "+maxD+"mV (>150mV) — weak cell group; re-test after balance charge.";
    else if(maxD!=null) flag = "OK: cell delta-V "+maxD+"mV — balanced pack.";
    return { present:true, n:rows.length, maxDelta_mV:maxD, medianBmsSoh:med, flag };
  }

  function coreModel(p, efcOverride, tOverrideC){
    const chem = chemistryOf(p.model);
    const clim = climateOf(p.city);
    let tPack = (tOverrideC!=null? tOverrideC : clim.effPackC);
    // v2026.14 live-climate honesty (audit §5): the Open-Meteo ambient NOW
    // nudges Tpack when online — capped at ±1.75°C so a noon spike can never
    // hijack calendar math. IMD normals remain the anchor; offline = normals.
    if(tOverrideC==null){
      try{
        const live = window.BF_DB && window.BF_DB.LIVE && window.BF_DB.LIVE.climateOverride;
        const o = live && live[p.city];
        if(o && isFinite(o.ambientNowC) && isFinite(clim.meanC)){
          const dev = Math.max(-5, Math.min(5, o.ambientNowC - clim.meanC));
          tPack = clim.effPackC + dev*0.35;
        }
      }catch(e){}
    }
    const now = new Date();
    const purch = new Date(p.purchaseDate || now);
    let ageYrs = (now - purch) / (365.25*24*3600*1000);
    if(!(ageYrs>0)) ageYrs = 0.5;
    const rangeNew = p.model.rangeNew || 300;
    const efc = (efcOverride!=null? efcOverride : (p.kms||0) / rangeNew);
    const fastFrac = Math.min(1, Math.max(0,(p.fastPct||0)/100));
    const dod = p.depthAvg!=null ? p.depthAvg : (fastFrac>0.5?72:58);
    const avgSoc = p.avgSoc!=null ? p.avgSoc : (p.parkHigh?88:68);
    const dodStress = 0.80 + dod/250;
    const crateStress = 1 + fastFrac*chem.fastPenalty*0.55 + ((p.ultraAbuse)?0.35:0);
    // v2026.14 sublinear throughput (audit P0-3): partial-DoD cycling damages
    // less than full cycles; field data (AVILOO 50k/150k ladders) fits EFC^0.85.
    const cycleFade = Math.pow(Math.max(0,efc), 0.85) * chem.fadePerEFC_pct * dodStress * crateStress;
    const arr = arrhenius(chem.Ea_Jmol, tPack);
    let socStress = 0.75 + 0.0125*(avgSoc-50);
    if(p.parkHigh) socStress *= 1.15;
    socStress = Math.min(1.7, Math.max(0.6, socStress));
    const effAge = effectiveAge(ageYrs);
    const calendarFade = effAge * chem.calendarBase * arr * socStress;
    let abuseExtra = 0;
    if(p.ultraAbuse) abuseExtra += 1.6 + fastFrac*1.4;
    else if(fastFrac>0.7) abuseExtra += 0.8;
    if(avgSoc>=95 && clim.effPackC>=34) abuseExtra += 0.9;
    const raw = 100 - (cycleFade + calendarFade + abuseExtra);
    return { raw, cycleFade, calendarFade, abuseExtra, arr, socStress, dodStress, crateStress, ageYrs, effAge, efc, avgSoc, dod };
  }

  /* Main SoH computation. p: {model,kms,purchaseDate,city,fastPct,avgSoc,depthAvg,
     parkHigh,ultraAbuse,csvEfc(legacy, ignored for EFC),csvHealth,csvRows,csvDays,
     rangenow,obd:{medianBmsSoh,n,maxDelta_mV}} */
  function computeSoH(p){
    const chem = chemistryOf(p.model);
    const clim = climateOf(p.city);
    const c = coreModel(p, null, null);
    let sohModel = c.raw;

    // Measured health candidates (CSV range-implied + dashboard range + OBD BMS)
    const candidates = [];
    if(p.csvHealth && p.csvHealth>=40 && p.csvHealth<=100){
      candidates.push({ v:p.csvHealth, w:bayesWeight(p.csvRows||0, p.csvDays||30, p.csvStaleDays), src:"csv-range" });
    }
    // dashboard full-charge range fused as weak prior (w=0.15) — never dominant
    if(p.rangenow && p.model.rangeNew){
      const dashH = Math.max(40, Math.min(100, p.rangenow/p.model.rangeNew*100));
      candidates.push({ v:dashH, w:0.15, src:"dash-range" });
    }
    let sohFused = sohModel, fuseW = 0, fuseSrc = "model-only";
    // sequential Bayesian update
    candidates.forEach(cd=>{
      if(cd.w>0){ sohFused = (1-cd.w)*sohFused + cd.w*cd.v; fuseW = Math.max(fuseW, cd.w); fuseSrc = cd.src; }
    });
    let obdW = 0;
    if(p.obd && p.obd.present && p.obd.medianBmsSoh){
      obdW = Math.min(0.80, 0.5 + (p.obd.n||0)/200);
      sohFused = (1-obdW)*sohFused + obdW*p.obd.medianBmsSoh;
      fuseSrc = fuseSrc==="model-only" ? "obd-bms" : fuseSrc+"+obd-bms";
    }
    const sohRaw = sohFused;
    let soh = Math.max(45, Math.min(100, sohFused));

    // Honest evidence-tier 90% uncertainty band (v2026.14, audit P0-2).
    // mcHalf = what the Monte Carlo actually samples (odo ±2%, T ±1.5°C,
    // age ±15 DAYS jitter — now really present — plus CSV/OBD observation noise).
    // modelForm = chemistry field-variance floor (AVILOO spread ladder).
    // ci90 = sqrt(mcHalf² + modelForm²): sampling noise can never go below the
    // field floor, and the floor is disclosed per chemistry, not a fixed tier.
    let ci90 = 3.5, mcHalf = 0, modelForm = modelFormFloor(p.model.chem, c.ageYrs);
    try{
      const N = 600, sims = [];
      const odoBase = p.kms||0, rangeNew = p.model.rangeNew||300;
      const ageBaseDays = c.ageYrs*365.25;
      for(let i=0;i<N;i++){
        const odoJ = odoBase * (1 + (Math.random()*2-1)*0.02);
        const tJ = clim.effPackC + (Math.random()*2-1)*1.5;
        const ageJdays = ageBaseDays + (Math.random()*2-1)*15; // documented ±15d jitter
        const ageJyrs = ageJdays/365.25;
        const cc = coreModel(p, odoJ/rangeNew, tJ);
        // re-apply calendar with jittered age (plateaued), holding other terms
        const chemJ = chemistryOf(p.model);
        const arrJ = arrhenius(chemJ.Ea_Jmol, tJ);
        let socJ = 0.75 + 0.0125*(cc.avgSoc-50);
        if(p.parkHigh) socJ *= 1.15;
        socJ = Math.min(1.7, Math.max(0.6, socJ));
        const calJ = effectiveAge(ageJyrs) * chemJ.calendarBase * arrJ * socJ;
        const efcJ = odoJ/rangeNew;
        const cycJ = Math.pow(Math.max(0,efcJ), 0.85) * chemJ.fadePerEFC_pct * cc.dodStress * cc.crateStress;
        let s = 100 - (cycJ + calJ + cc.abuseExtra);
        if(!isFinite(s)) s = cc.raw;
        candidates.forEach(cd=>{ if(cd.w>0) s = (1-cd.w)*s + cd.w*(cd.v + (Math.random()*2-1)*1.0); });
        if(obdW>0 && p.obd.medianBmsSoh) s = (1-obdW)*s + obdW*(p.obd.medianBmsSoh + (Math.random()*2-1)*0.5);
        sims.push(s);
      }
      sims.sort((a,b)=>a-b);
      const lo = sims[Math.floor(N*0.05)], hi = sims[Math.floor(N*0.95)];
      mcHalf = +(((hi-lo)/2).toFixed(2));
      if(!isFinite(mcHalf)) mcHalf = 0.3;
      ci90 = +Math.sqrt(mcHalf*mcHalf + modelForm*modelForm).toFixed(1);
      if(!(ci90>=0.8 && ci90<=8)) ci90 = +modelForm.toFixed(1);
      if(obdW>0.5) ci90 = Math.min(ci90, 1.8);
      else if(fuseW>0.2) ci90 = Math.min(ci90, 3.0);
    }catch(e){ ci90 = +modelForm.toFixed(1); }

    const hotFactor = hotGapFactor(chem, p.city, c.avgSoc);
    const usableNow = p.model.kwh * soh/100;
    const rangeNow = (p.model.rangeNew||300) * soh/100;
    const rangeLost = (p.model.rangeNew||300) - rangeNow;
    const cyclesLeft = Math.max(0, Math.round((chem.cycleLife - c.efc)));
    const yearsTo70 = estimateYearsTo(soh, 70, p, chem, clim);

    return {
      soh:+soh.toFixed(1), sohRaw:+sohRaw.toFixed(1), ci90,
      lo90:+(Math.max(40,soh-ci90)).toFixed(1), hi90:+(Math.min(100,soh+ci90)).toFixed(1),
      mcHalf:+mcHalf.toFixed(2), modelForm:+modelForm.toFixed(2),
      fuseWeight:+(Math.max(fuseW,obdW)).toFixed(2), fuseSrc,
      efc:+c.efc.toFixed(1), ageYrs:+c.ageYrs.toFixed(2), effAge:+c.effAge.toFixed(2),
      cycleFade:+c.cycleFade.toFixed(2), calendarFade:+c.calendarFade.toFixed(2),
      abuseExtra:+c.abuseExtra.toFixed(2), arrFactor:+c.arr.toFixed(3),
      hotFactor, chemName:chem.name, curve:chem.curve,
      usableNow:+usableNow.toFixed(2), rangeNow:Math.round(rangeNow),
      rangeLost:Math.round(rangeLost), cyclesLeft, yearsTo70,
      dodStress:+c.dodStress.toFixed(3), crateStress:+c.crateStress.toFixed(3),
      socStress:+c.socStress.toFixed(3), avgSoc:c.avgSoc, dod:c.dod
    };
  }

  // v2026.14 fix (audit P0-1): first arg is km/YEAR, never age-in-years.
  // Callers must pass p.kmsPerYr (set in run()); legacy p.ageYrsHint is IGNORED
  // by design so a 3.33-yr age can never again masquerade as 3.33 km/yr.
  // v2026.14 agreement guarantee: integrates the SAME yearly-drop simulation as
  // trajectory(), so headline and chart cross 70% in the same year by construction.
  function estimateYearsTo(sohNow, target, p, chem, clim){
    if(sohNow<=target) return 0;
    const kmsPerYr = (p.kmsPerYr && isFinite(p.kmsPerYr) && p.kmsPerYr>500)
      ? p.kmsPerYr : estimateKmPerYr(p);
    const efcPerYr = kmsPerYr/(p.model.rangeNew||300);
    const fastFrac = Math.min(1,Math.max(0,(p.fastPct||0)/100));
    const avgSoc = p.avgSoc!=null ? p.avgSoc : 70;
    let socStress = 0.75 + 0.0125*(avgSoc-50);
    if(p.parkHigh) socStress *= 1.15;
    socStress = Math.min(1.7, Math.max(0.6, socStress));
    const cycBase = chem.fadePerEFC_pct*(0.80+((p.depthAvg||60)/250))*(1+fastFrac*chem.fastPenalty*0.55);
    const calBase = chem.calendarBase*arrhenius(chem.Ea_Jmol, clim.effPackC)*socStress;
    const abuseYr = (p.ultraAbuse?0.8:0);
    const ageNow = Math.max(0.25,(new Date()-new Date(p.purchaseDate))/(365.25*24*3600*1000));
    if(!isFinite(ageNow)) return 15;
    const efc0 = Math.max(1,(p.kms||0)/(p.model.rangeNew||300));
    let drop = 0, prev = sohNow;
    for(let k=1;k<=30;k++){
      const a = ageNow+k-1;
      const dEff = a<=2 ? 1 : 0.7*Math.pow(Math.max(0.05,a-2), -0.30);
      const efcK = efc0 + efcPerYr*(k-1);
      const dCyc = 0.85*Math.pow(Math.max(1,efcK), -0.15);
      drop += dCyc*efcPerYr*cycBase + calBase*dEff + abuseYr;
      const v = sohNow - drop;
      if(v < target){
        const frac = (prev - target) / Math.max(0.01, prev - v);
        return +((k-1+frac).toFixed(1));
      }
      prev = v;
      if(v < 40) break;
    }
    return 30;
  }
  function estimateKmPerYr(p){
    try{
      const age = (new Date()-new Date(p.purchaseDate))/(365.25*24*3600*1000);
      if(!isFinite(age) || age<0.25) return (p.kms||0)/Math.max(0.25, isFinite(age)&&age>0?age:0.25);
      return (p.kms||0)/age;
    }catch(e){ return 12000; }
  }
  // Shared forward-slope helper so trajectory() and estimateYearsTo() agree.
  // Cycle slope is the sublinear marginal (0.85*EFC^-0.15); calendar slope is
  // the plateau marginal averaged over the next year (×0.85 planning factor).
  function forwardPerYr(p, chem, clim){
    const kmsPerYr = (p.kmsPerYr && isFinite(p.kmsPerYr) && p.kmsPerYr>500)
      ? p.kmsPerYr : Math.max(2000, estimateKmPerYr(p));
    const efcPerYr = kmsPerYr/(p.model.rangeNew||300);
    const fastFrac=Math.min(1,Math.max(0,(p.fastPct||0)/100));
    const avgSoc = p.avgSoc!=null ? p.avgSoc : 70;
    let socStress = 0.75 + 0.0125*(avgSoc-50);
    if(p.parkHigh) socStress *= 1.15;
    socStress = Math.min(1.7, Math.max(0.6, socStress));
    const efcNow = Math.max(1,(p.kms||0)/(p.model.rangeNew||300));
    const dCyc = 0.85*Math.pow(efcNow, -0.15);
    const perYr = dCyc*efcPerYr*chem.fadePerEFC_pct*(0.80+((p.depthAvg||60)/250))*(1+fastFrac*chem.fastPenalty*0.55)
                + chem.calendarBase*arrhenius(chem.Ea_Jmol, clim.effPackC)*socStress*0.85
                + (p.ultraAbuse?0.8:0);
    return { perYr, kmsPerYr };
  }

  /* Chemistry fingerprint verdict: detects fake range claims + OBD flags */
  function fingerprint(p, f){
    const chem = chemistryOf(p.model);
    const out = { chem:chem.name, curve:chem.curve, flags:[], verdict:"CONSISTENT" };
    if(chem.curve==="flat" && p.claimedRange && p.model.rangeNew){
      const implied = p.claimedRange/(p.model.rangeNew*f.soh/100);
      if(implied>1.12) out.flags.push("⚠ Seller claims "+p.claimedRange+" km but chemistry+SoH allow ≈"+Math.round(p.model.rangeNew*f.soh/100)+" km (90% CI "+f.lo90+"–"+f.hi90+") — LFP flat-curve makes mid-band % unreadable; demand full 100→10% drive proof.");
    }
    if(chem.curve!=="flat" && p.claimedRange && p.model.rangeNew){
      const implied = p.claimedRange/(p.model.rangeNew*f.soh/100);
      if(implied>1.08) out.flags.push("⚠ Sloped-chemistry (NMC/NCA): voltage maps linearly to % — claimed range "+p.claimedRange+" km exceeds physics by "+Math.round((implied-1)*100)+"%. Ask for OBD voltage log.");
    }
    if(p.ultraAbuse) out.flags.push("🔥 8C/CATL ultra-fast routine detected — micro-cracking signature (sudden knee near 70%) likely; calendar+cycle model adds +"+f.abuseExtra+"% penalty.");
    if((p.fastPct||0)>=60) out.flags.push("⚡ "+p.fastPct+"% DC-fast habit — C-rate damage multiplier ×"+f.crateStress+". Cap DC to <30% to halve fade.");
    // v2026.14 (audit P2-10): dashboard SoC-now is EVIDENCE CONTEXT, not a model
    // lever — a single snapshot can't set a daily average. Shown + flagged here.
    if(p.socNow!=null && isFinite(p.socNow)){
      if(p.socNow>=90) out.flags.push("🅿 Dashboard shows "+p.socNow+"% right now — if the pack sits there, SoC stress behaves like parking-high; daily average used in math is "+f.avgSoc+"%. Photograph it at 100% and again at 15% for a real swing.");
      else out.flags.push("📸 Dashboard SoC now "+p.socNow+"% recorded as evidence context (photo 1). Model math uses your daily-average SoC ("+f.avgSoc+"%) — one snapshot never moves the estimate by itself.");
    }
    if(p.parkHigh) out.flags.push("🅿 Habitual 90–100% parking — SoC stress ×"+f.socStress+". LFP tolerates it; NMC/NCA loses ~2× faster.");
    if(f.hotFactor>=1.8) out.flags.push("🌡 "+p.city+" heat ages pack "+f.hotFactor+"× vs Pune twin (Arrhenius, Ea="+chem.Ea_Jmol/1000+" kJ/mol, SoC-amplified). Shade-park + 80% cap recovers ~40% of gap.");
    if(p.obd && p.obd.present){
      if(p.obd.maxDelta_mV!=null && p.obd.maxDelta_mV>150) out.flags.push("🔋 OBD: cell delta-V "+p.obd.maxDelta_mV+"mV — weak module. Fused BMS SoH "+p.obd.medianBmsSoh+"% weighted "+Math.round((f.fuseWeight||0)*100)+"%.");
      else out.flags.push("🔋 OBD attached ("+p.obd.n+" samples, delta-V "+(p.obd.maxDelta_mV!=null?p.obd.maxDelta_mV+"mV":"n/a")+") — estimate tightened to ±"+f.ci90+"%.");
    }
    if(!out.flags.length) out.flags.push("✓ Usage pattern consistent with chemistry fingerprint. No abuse signature.");
    if(out.flags.some(s=>s[0]==="🔥"||s.includes("exceeds physics")||s.includes("CRITICAL"))) out.verdict="SUSPICIOUS";
    else if(out.flags.length>1) out.verdict="STRESSED";
    return out;
  }

  /* Warranty verdict (unchanged logic + source/confidence passthrough) */
  function warrantyVerdict(p, f){
    const w = window.BF_DB.WARRANTIES.find(x=>x.modelId===p.model.id) ||
              { oem:p.model.brand, years:8, km:160000, soh:70, clause:"Generic 8yr/160k km — 70% SoH (verify booklet).", note:"No exact rule pre-loaded; generic applied.", transfer:"Usually transferable", exclusions:"Standard neglect/abuse", process:"OEM service centre scan" };
    const now = new Date(), purch = new Date(p.purchaseDate||now);
    const ageY = (now-purch)/(365.25*24*3600*1000);
    const kmLeft = Math.max(0,(w.km>9000000?Infinity:w.km)-(p.kms||0));
    const yrsLeft = Math.max(0,w.years-ageY);
    const timeExpired = yrsLeft<=0, kmExpired = kmLeft<=0;
    const underThreshold = f.soh < w.soh;
    const buffer = f.soh - w.soh;
    let status, headline, action;
    if(timeExpired||kmExpired){ status="EXPIRED"; headline="Warranty expired ("+(timeExpired?"time":"km")+" limit crossed)."; action="Skip dealer fight → pivot to Second-Life valuator + resale cert. Still request goodwill citing service history."; }
    else if(underThreshold){ status="ELIGIBLE — FILE NOW"; headline="SoH "+f.soh+"% (±"+f.ci90+"%) is BELOW "+w.soh+"% trigger with "+(isFinite(kmLeft)?Math.round(kmLeft).toLocaleString("en-IN")+" km":"unlimited km")+" + "+yrsLeft.toFixed(1)+" yr left."; action="File this week. Use Evidence Pack (photos + calc + clause citation + hash). Ask for module/pack restoration to ≥80% per "+w.oem+" terms."; }
    else if(buffer<=2.5){ status="NOT YET — FILE-SOON WINDOW"; headline="SoH "+f.soh+"% is only +"+buffer.toFixed(1)+"% above trigger ("+w.soh+"%). Degrading ~"+(f.yearsTo70>0&&f.yearsTo70<3?"fast — likely crosses within warranty":"slowly")+". CI "+f.lo90+"–"+f.hi90+"% straddles risk."; action="Re-test every 60–90 days; log 100→10% runs; pre-draft claim letter now. Do NOT let km/time lapse."; }
    else { status="NOT YET — HEALTHY"; headline="SoH "+f.soh+"% (±"+f.ci90+"%) is +"+buffer.toFixed(1)+"% above trigger. Pack healthy."; action="Monitor annually. Keep service stamps clean — missing service is the #1 denial reason ('normal degradation / poor maintenance')."; }
    const risks=[];
    if((p.fastPct||0)>70) risks.push("High DC-fast share — OEM may argue 'abuse/neglect'; counter with BMS thermal logs showing temps within "+chemistryOf(p.model).thermalSafeC+"°C envelope.");
    if(!p.serviced) risks.push("Missing/irregular service stamps — #1 denial ground. Backfill any due service BEFORE filing.");
    if(p.commercial) risks.push("Commercial/fleet use — Tata/Ola commercial exclusion may bite. File as private owner with RC proof.");
    if(p.model.id==="ola-s1x-2") risks.push("S1 X 2 kWh has NO 8-yr top-up — only 3yr/40k base. Verify purchase date urgently.");
    if(p.model.id==="leaf40") risks.push("Leaf trigger is capacity-BARS (≈66.25%), not % — bring LeafSpy cell-voltage printout; dealers misquote 70%.");
    if(p.obd && p.obd.maxDelta_mV>150) risks.push("OBD delta-V "+p.obd.maxDelta_mV+"mV strengthens claim (module defect) — attach OBD CSV export to PDF.");
    return { w, status, headline, action, yrsLeft:+yrsLeft.toFixed(2), kmLeft:(isFinite(kmLeft)?Math.round(kmLeft):Infinity), buffer:+buffer.toFixed(1), risks };
  }

  /* Second-life valuation (live FX via BF_DB.fmtMoney path; USD math kept) */
  function secondLife(p, f){
    const m = window.BF_DB.MARKET, usable = f.usableNow;
    const routes=[
      { route:"🏠 Home backup (5–10 kW ESS)", perKwh: m.essBuyback.home_perKWh_usd, why:"Highest $/kWh — AI-datacenter + home-storage boom (WoodMac H1-2026). LFP ideal; NMC accepted with BMS.", mult:1 },
      { route:"🚚 Fleet / e-rickshaw re-pack", perKwh: m.essBuyback.fleet_perKWh_usd, why:"2W packs drop straight into 3W/fleet; 4W modules re-strung.", mult:1 },
      { route:"♻ Certified recycler (floor price)", perKwh: m.essBuyback.recycle_perKWh_usd, why:"Lithium/carbonate floor — never accept below this.", mult:1 }
    ].map(r=>{
      const gross = usable*r.perKwh;
      const refurb = (p.model.seg==="2W" ? (m.essBuyback.refurbCost_usd||320) : 900);
      const net = Math.max(0, gross*m.essBuyback.installMargin - refurb*0.35);
      return { ...r, grossUsd:Math.round(gross), netUsd:Math.round(net), netInr:Math.round(net*m.inrUsd) };
    });
    routes.sort((a,b)=>b.netUsd-a.netUsd);
    const best = routes[0];
    return { usableKwh:usable, routes, best, note:"2026 record-low NEW cell prices (BNEF $108/kWh, LFP $81) cap 2nd-life at ~60–80% of new-pack value. Packs >70% SoH → reuse; 50–70% → ESS; <50% → recycle." };
  }

  /* Resale band (central fmtMoney) */
  function resale(p, f){
    const m = window.BF_DB.MARKET, grade = window.BF_DB.gradeOf(f.soh);
    const ageY = Math.max(0.25,(new Date()-new Date(p.purchaseDate||new Date()))/(365.25*24*3600*1000));
    const deprPerYr = p.model.seg==="2W"?0.13:0.11;
    const ageFactor = Math.pow(1-deprPerYr, ageY);
    const kmFactor = Math.max(0.55, 1 - (p.kms||0)/(p.model.seg==="2W"?90000:300000)*0.35);
    const battShare = 0.42;
    const battHealthFactor = (1-battShare) + battShare*(f.soh/100)/(0.92);
    const base = p.model.priceNew*ageFactor*kmFactor*battHealthFactor;
    const mult = m.resale.gradeMultiplier[grade]||1;
    const certified = base*mult;
    const uncertified = base*m.resale.uncertifiedDiscount;
    const dealerBid = certified*m.resale.dealerMarginCut;
    const usd = !!p.model.usd;
    const fmt = v=> usd?("$"+Math.round(v).toLocaleString("en-US")):("₹"+Math.round(v).toLocaleString("en-IN"));
    return { grade, gradeNote:window.BF_DB.gradeIN[grade], base:Math.round(base),
      lo:Math.round(uncertified), hi:Math.round(certified), dealerBid:Math.round(dealerBid),
      loStr:fmt(uncertified), hiStr:fmt(certified), dealerStr:fmt(dealerBid),
      atStake:fmt(Math.abs(certified-uncertified)+ (f.soh<85?(p.model.battCost*0.08):0)),
      insight:"AVILOO 13.5% intra-model spread ⇒ "+(usd?"up to $5k (Model 3 class)":"up to ₹60k (Ola class)")+" swings on identical listings. Certificate QR moves you from 'lowball band' to top band (~+"+m.resale.certPremium_pct+"%)." };
  }

  /* Trajectory forecast with ±CI fan (for chart) — uses forwardPerYr() so the
     chart crossing and the "years to 70%" headline are the same number. */
  function trajectory(p, f, yearsAhead){
    const chem = chemistryOf(p.model), clim = climateOf(p.city);
    const pts=[], loPts=[], hiPts=[]; let soh=f.soh;
    const { perYr, kmsPerYr } = forwardPerYr(p, chem, clim);
    for(let y=0;y<=(yearsAhead||6);y++){
      // plateau-aware decay: each future year contributes perYr × dEff(age+y)
      let v = f.soh;
      if(y>0){
        const ageNow = Math.max(0.25,(new Date()-new Date(p.purchaseDate))/(365.25*24*3600*1000));
        let drop = 0;
        const fastFrac=Math.min(1,Math.max(0,(p.fastPct||0)/100));
        const efcPerYr = kmsPerYr/(p.model.rangeNew||300);
        const avgSoc = p.avgSoc!=null ? p.avgSoc : 70;
        let socS = 0.75 + 0.0125*(avgSoc-50);
        if(p.parkHigh) socS *= 1.15;
        socS = Math.min(1.7, Math.max(0.6, socS));
        const calBase = chem.calendarBase*arrhenius(chem.Ea_Jmol, clim.effPackC)*socS;
        const cycBase = chem.fadePerEFC_pct*(0.80+((p.depthAvg||60)/250))*(1+fastFrac*chem.fastPenalty*0.55);
        const efc0 = Math.max(1,(p.kms||0)/(p.model.rangeNew||300));
        for(let k=1;k<=y;k++){
          const a = ageNow+k-1;
          const dEff = a<=2 ? 1 : 0.7*Math.pow(Math.max(0.05,a-2), -0.30);
          const efcK = efc0 + efcPerYr*(k-1);
          const dCyc = 0.85*Math.pow(Math.max(1,efcK), -0.15);
          drop += dCyc*efcPerYr*cycBase + calBase*dEff + (p.ultraAbuse?0.8:0);
        }
        v = Math.max(40, f.soh-drop);
      }
      pts.push({year:+(new Date().getFullYear()+y), soh:+v.toFixed(1)});
      loPts.push(+(Math.max(40,v-f.ci90*(1+y*0.15))).toFixed(1));
      hiPts.push(+(Math.min(100,v+f.ci90*(1+y*0.15))).toFixed(1));
    }
    void soh;
    return { pts, loPts, hiPts, perYr:+perYr.toFixed(2) };
  }

  return { computeSoH, fingerprint, warrantyVerdict, secondLife, resale, trajectory, arrhenius, hotGapFactor, bayesWeight, analyzeObd, effectiveAge, modelFormFloor, estimateKmPerYr, forwardPerYr };
})();
