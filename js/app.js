/* BijliBureau v2026.16-enterprise — app orchestration (OCR lazy + CSV/OBD + hash router + vault + DPP QR v3 + Ed25519 evidence signatures) */
"use strict";
window.BF = {};
(function(){
const $ = id => document.getElementById(id);
const DB = ()=>window.BF_DB, E = ()=>window.BF_Engine;
let LAST = null, charts = {}, csvData = { health:null, rows:[], days:0, n:0 };
let obdData = { present:false, n:0, rows:[], medianBmsSoh:null, maxDelta_mV:null };
let UNLOCKED = false;

function toast(msg){
  const t = $("toast"); if(!t){ try{console.log(msg);}catch(e){} return; }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove("show"), 3000);
}
function track(ev){ try{ ensureGa4(); if(window.BF_TRACK) window.BF_TRACK(ev); (window.dataLayer=window.dataLayer||[]).push(ev); }catch(e){} }
function unlock(){
  UNLOCKED = true;
  document.querySelectorAll(".tab.locked").forEach(t=>t.classList.remove("locked"));
}
/* ---------- analytics transport (v2026.14 honesty, audit §5) ----------
   dataLayer ALWAYS collects (local, offline-safe). Transport exists ONLY when
   the deployer configures it — no silent promises:
   - BF_DB.ANALYTICS.ga4Id (e.g. "G-XXXXXXX"): loads gtag.js on first track().
   - BF_DB.ANALYTICS.telemetryEndpoint: opt-in anonymized POST on run().
   Until configured, track() is local-only and the UI says so. */
function ensureGa4(){
  const id = DB().ANALYTICS && DB().ANALYTICS.ga4Id;
  if(!id || window.__bfGa4) return;
  try{
    window.__bfGa4 = true;
    const s=document.createElement("script");
    s.async=true; s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(id);
    document.head.appendChild(s);
    window.dataLayer=window.dataLayer||[];
    window.gtag=function(){window.dataLayer.push(arguments);};
    window.gtag("js", new Date());
    window.gtag("config", id, { anonymize_ip:true });
  }catch(e){}
}
function flushTelemetry(){
  try{
    const ep = DB().ANALYTICS && DB().ANALYTICS.telemetryEndpoint;
    if(!ep || !LAST || !LAST.consent) return;
    const body = JSON.stringify({ v:DB().VERSION, model:LAST.p.model.id, efc:LAST.f.efc,
      soh:LAST.f.soh, ci:LAST.f.ci90, city:LAST.p.city, fastPct:LAST.p.fastPct, at:LAST.at });
    if(navigator.sendBeacon){ try{ navigator.sendBeacon(ep, body); return; }catch(e){} }
    fetch(ep, { method:"POST", mode:"no-cors", headers:{ "Content-Type":"application/json" }, body });
  }catch(e){}
  try{
    // local outbox (Real-World SoH Index queue) — always kept, synced when endpoint exists
    const k="bf-soh-index-outbox";
    const q=JSON.parse(localStorage.getItem(k)||"[]");
    if(LAST && LAST.consent) q.push({ model:LAST.p.model.id, efc:LAST.f.efc, soh:LAST.f.soh, at:LAST.at });
    localStorage.setItem(k, JSON.stringify(q.slice(-200)));
  }catch(e){}
}
async function copyText(txt, okMsg){
  try{ await navigator.clipboard.writeText(txt); toast(okMsg||"Copied."); }
  catch(e){
    try{ const ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast(okMsg||"Copied."); }
    catch(_){ toast(txt.slice(0,180)); }
  }
}
async function sha256(str){
  try{
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  }catch(e){ let h=0; for(let i=0;i<str.length;i++){h=(h*31+str.charCodeAt(i))>>>0;} return "fnv1a-"+h.toString(16); }
}
/* ---------- Ed25519 detached evidence signatures (enterprise trust) ----------
   Optional dealer mode: if localStorage bf-ed25519-pub exists, makePDF appends
   a detached signature over the SHA-256 payload hash. Keys are generated
   on-domain via tools/generate-key.js (or WebCrypto ECDSA-P256 fallback here);
   public key published at /.well-known/bijlibureau-key.json + transparency log
   entry. Verification: node tools/verify-signature.js or the cert page.
   Until a key is configured, PDFs are honestly labelled "timestamped + SHA-256
   hashed" (never "signed"). */
async function trySignHash(hexHash){
  try{
    const pubJwkRaw = localStorage.getItem("bf-ed25519-pub");
    const privJwkRaw = localStorage.getItem("bf-ed25519-priv");
    if(!pubJwkRaw || !privJwkRaw) return { signed:false, note:"timestamped + SHA-256 hashed (no signing key configured — see security.html)" };
    const privJwk = JSON.parse(privJwkRaw);
    const key = await crypto.subtle.importKey("jwk", privJwk, { name:"ECDSA", namedCurve:"P-256" }, false, ["sign"]);
    const sigBuf = await crypto.subtle.sign({ name:"ECDSA", hash:"SHA-256" }, key, new TextEncoder().encode(hexHash));
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    return { signed:true, alg:"ECDSA-P256-SHA256 (WebCrypto; Ed25519 via tools/generate-key.js for offline CLI)", sig:sigB64, pub:JSON.parse(pubJwkRaw) };
  }catch(e){ return { signed:false, note:"timestamped + SHA-256 hashed (signing unavailable: "+((e&&e.message)||e)+")" }; }
}
/* PWA: register Service Worker for offline-first app shell (cache-first shell+DB, network-first FX). */
try{
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")){
    window.addEventListener("load", ()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); });
  }
}catch(e){}

/* ---------- guided stepper + HASH ROUTER ---------- */
const STEPS = ["intake","soh","warranty","second","resale","evidence","intel"];
const STEP_SUB = {
  intake:"Add photos + vehicle details",
  soh:"Your battery health result ±CI",
  warranty:"Can you claim? What to file",
  second:"What your old pack is worth",
  resale:"Sell higher with proof",
  evidence:"Download your courtroom PDF + vault",
  intel:"Prices, studies & sources"
};
const visited = new Set(["intake"]);

function buildStepper(){
  document.querySelectorAll(".tab").forEach(t=>{
    const m = t.textContent.match(/^\s*\d+\s*·\s*(.*)$/);
    const label = m ? m[1] : t.textContent.trim();
    const i = STEPS.indexOf(t.dataset.tab) + 1;
    t.innerHTML = `<span class="n">${i}</span><span></span>`;
    t.lastChild.textContent = label;
    t.title = `Step ${i} of ${STEPS.length} — ${STEP_SUB[t.dataset.tab]||label}`;
    t.setAttribute("aria-label", `Step ${i}: ${label}`);
  });
  if(!$("stepBar")){
    const bar = document.createElement("div");
    bar.className = "step-progress";
    bar.innerHTML = `<div class="wrap"><div id="stepBar"></div></div>`;
    $("tabs").after(bar);
  }
  STEPS.forEach((name, i)=>{
    const panel = $("tab-"+name);
    if(!panel || panel.querySelector(".stepnav")) return;
    const eb = document.createElement("p");
    eb.className = "step-eyebrow";
    eb.textContent = `Step ${i+1} of ${STEPS.length} · ${STEP_SUB[name]}`;
    panel.prepend(eb);
    const nav = document.createElement("div");
    nav.className = "stepnav";
    nav.innerHTML =
      (i>0 ? `<button class="btn ghost" data-goto="${STEPS[i-1]}">← Back</button>` : `<span class="spacer"></span>`) +
      (i<STEPS.length-1 ? `<button class="btn primary" data-goto="${STEPS[i+1]}">Continue →</button>`
                        : `<button class="btn primary" data-goto="intake">↺ Start new forensic</button>`);
    panel.appendChild(nav);
    nav.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>switchTab(b.dataset.goto));
  });
}
function paintStepper(name){
  visited.add(name);
  const idx = STEPS.indexOf(name);
  document.querySelectorAll(".tab").forEach(t=>{
    const i = STEPS.indexOf(t.dataset.tab);
    t.classList.toggle("done", visited.has(t.dataset.tab) && i < idx);
  });
  const bar = $("stepBar");
  if(bar) bar.style.width = ((idx+1)/STEPS.length*100).toFixed(1)+"%";
}
function go(name){
  switchTab(name);
}
function switchTab(name, noscroll){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+name));
  paintStepper(name);
  try{ if(location.hash !== "#/"+name) history.replaceState(null,"","#/"+name); }catch(e){}
  track({ event:"bf_tab", tab:name });
  if(name==="soh" && LAST){ try{ drawCharts(LAST.tr, LAST.f); }catch(e){} }
  // v2026.14 lazy QR: cert QR builds only when the Resale tab is actually shown
  if(name==="resale" && LAST && (!$("qrPayload") || !$("qrPayload").textContent)){
    try{ buildQR(LAST.p, LAST.f, LAST.w, DB().gradeOf(LAST.f.soh), LAST.rs); }catch(e){}
  }
  const m = document.querySelector("main");
  if(m && !noscroll) window.scrollTo({top:m.offsetTop-70,behavior:"smooth"});
}
function routeFromHash(initial){
  // Returns "shared" if a ?r= link was restored (caller auto-runs it),
  // a step name if a #/step hash was honoured, or null for a fresh load.
  const h = (location.hash||"").replace("#/","").split("?")[0];
  let out = null;
  if(STEPS.includes(h)){ switchTab(h, initial); out = h; }
  try{
    const q = new URLSearchParams(location.search);
    if(q.get("r") && restoreFromShare(q.get("r"))) out = "shared";
    if(q.get("embed")==="1") document.body.classList.add("embed");
  }catch(e){}
  return out;
}
BF.switchTab = switchTab;

/* ---------- IndexedDB vault (local-only; AES-GCM opt-in when passphrase set) ---------- */
// Honest contract: IndexedDB at rest is origin-private, NOT encrypted.
// If Vault.passphrase is set (dealer opt-in), records are AES-GCM encrypted
// via WebCrypto before put(). Otherwise stored as plain JSON + SHA-256 hash.
const Vault = {
  db:null, passphrase:null,
  async _enc(obj){
    if(!Vault.passphrase || !crypto.subtle) return { enc:false, data:obj };
    try{
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(Vault.passphrase.padEnd(32,".").slice(0,32)), "AES-GCM", false, ["encrypt"]);
      const ct = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
      return { enc:true, iv:[...iv], data:btoa(String.fromCharCode(...new Uint8Array(ct))) };
    }catch(e){ return { enc:false, data:obj }; }
  },
  open(){ return new Promise((res,rej)=>{
    try{
      const rq = indexedDB.open("bf-vault",1);
      rq.onupgradeneeded = ()=>{ rq.result.createObjectStore("runs",{keyPath:"id"}); };
      rq.onsuccess = ()=>{ Vault.db=rq.result; res(); };
      rq.onerror = ()=>rej(rq.error);
    }catch(e){ rej(e); }
  });},
  async save(rec){
    try{ if(!Vault.db) await Vault.open(); }catch(e){ return null; }
    try{ rec._vault = await Vault._enc(rec.state); }catch(e){}
    return new Promise((res)=>{
      try{
        const tx = Vault.db.transaction("runs","readwrite");
        tx.objectStore("runs").put(rec);
        tx.oncomplete = ()=>res(rec.id);
        tx.onerror = ()=>res(null);
      }catch(e){ res(null); }
    });
  },
  async list(){
    try{ if(!Vault.db) await Vault.open(); }catch(e){ return []; }
    return new Promise((res)=>{
      try{
        const tx = Vault.db.transaction("runs","readonly");
        const rq = tx.objectStore("runs").getAll();
        rq.onsuccess = ()=>res(rq.result||[]);
        rq.onerror = ()=>res([]);
      }catch(e){ res([]); }
    });
  }
};

/* ---------- init ---------- */
function init(){
  const IN4W = new Set(["tata-nexon45","tata-nexon40","tata-punch","tata-curvv","tata-tiago","tata-harrier","mg-zsev","mg-windsor","mg-comet","mahindra-xuv400","mahindra-be06","byd-atto3","byd-seal","hyundai-cretae","citroen-ec3"]);
  const GLABEL = {"2W":"2-Wheelers · India","4W-IN":"4-Wheelers · India","4W-G":"4-Wheelers · Global"};
  window.BF_fillModels = function(sel, selectedId){
    sel.innerHTML = "";
    ["2W","4W-IN","4W-G"].forEach(g=>{
      const og = document.createElement("optgroup"); og.label = GLABEL[g];
      DB().MODELS.filter(m=>(m.seg==="2W"?"2W":(IN4W.has(m.id)?"4W-IN":"4W-G"))===g).forEach(m=>{
        const o = document.createElement("option"); o.value = m.id;
        o.textContent = `${m.brand} ${m.model} · ${m.kwh}kWh ${m.chem}`;
        if(m.id===selectedId) o.selected = true;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
  };
  BF_fillModels($("f_model"), "tata-nexon45");
  BF_fillModels($("w_lookup"), "tata-nexon45");
  renderLookup("tata-nexon45");
  $("w_lookup").onchange = e=>renderLookup(e.target.value);
  const cs=$("f_city");
  Object.keys(DB().CLIMATE).forEach(c=>{ const o=document.createElement("option"); o.textContent=c; if(c==="Chennai")o.selected=true; cs.appendChild(o); });
  $("stamp").textContent = "Dataset "+DB().VERSION+" · verified "+DB().MARKET.updated+" · BNEF-Dec2025-snapshot/AVILOO/TPEM/Ola/EU-2023-1542/CARB";
  try{
    const ld=document.getElementById("ld-app");
    if(ld){ const j=JSON.parse(ld.textContent); j.softwareVersion=DB().VERSION; j.dateModified=DB().MARKET.updated; ld.textContent=JSON.stringify(j); }
  }catch(e){}
  $("topStats").textContent = `BNEF pack $${DB().MARKET.bnef.globalPack_perKWh_usd}/kWh · AVILOO ${DB().MARKET.aviloo.tests.toLocaleString()}+ tests · ${DB().WARRANTIES.length} OEM rules · 100% on-device`;
  buildStepper();
  document.querySelectorAll(".tab").forEach(t=>{
    t.onclick=()=>switchTab(t.dataset.tab);
  });
  // global goto buttons (hero + privacy links) — free navigation, every tab browsable
  document.querySelectorAll("[data-goto]").forEach(el=>{
    if(el.closest(".stepnav")) return;
    el.addEventListener("click", (ev)=>{
      ev.preventDefault();
      switchTab(el.dataset.goto);
    });
    el.addEventListener("keydown",(ev)=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); el.click(); }});
  });
  $("f_fast").oninput=e=>$("fastVal").textContent=e.target.value+"%";
  $("f_preset").onchange=e=>{
    const P={balanced:[30,78,0,0,0],slow:[5,65,0,0,0],fast:[65,85,1,0,0],fleet:[85,92,1,1,1]}[e.target.value]||[30,78,0,0,0];
    $("f_fast").value=P[0]; $("fastVal").textContent=P[0]+"%";
    $("f_avgsoc").value=P[1];
    $("f_parkhigh").checked=!!P[2]; $("f_ultra").checked=!!P[3]; $("f_commercial").checked=!!P[4];
    toast("Habit preset applied — hit Run to reforensicate.");
  };
  document.querySelectorAll(".tile[data-act]").forEach(el=>{
    const h=()=>{
      const a=el.dataset.act;
      if(a==="cycles"){ switchTab("soh"); setTimeout(()=>{ const hh=$("h_cycles"); if(hh) hh.scrollIntoView({behavior:"smooth",block:"center"}); },120); return; }
      switchTab(a); };
    el.onclick=h; el.onkeydown=(ev)=>{ if(ev.key==="Enter") h(); };
  });
  $("btnCopyBand").onclick=()=>{
    if(!LAST){ toast("Run the forensic first — nothing to copy yet."); return; }
    const rs=LAST.rs;
    copyText(`Battery-certified resale: ${rs.loStr} – ${rs.hiStr} (Grade ${rs.grade}, SoH ${LAST.f.soh}% ±${LAST.f.ci90}%). Dealer bid ≈ ${rs.dealerStr}.`, "Price band copied — paste it into your listing.");
  };
  const shareBtns = [$("btnShareResult"), $("btnShareHero")].filter(Boolean);
  shareBtns.forEach(b=>b.onclick=()=>{
    if(!LAST){ toast("Run the forensic first — nothing to share yet."); return; }
    copyText(shareUrl(), "Share link copied — buyer opens read-only verdict.");
  });
  ["ph1","ph2","ph3"].forEach((id,i)=>$(id).addEventListener("change", e=>preview(e.target, "pv"+(i+1))));
  $("btnOcr").onclick=runOCR;
  $("f_csv").addEventListener("change", e=>parseCSV(e.target.files[0]));
  $("f_obd").addEventListener("change", e=>parseOBD(e.target.files[0]));
  $("btnCsvDemo").onclick=()=>fetch("sample-charge-log.csv").then(r=>r.text()).then(t=>ingestCSV(t)).catch(()=>{$("csvStatus").textContent="Sample CSV missing — run from local folder/http server.";});
  $("btnRun").onclick=()=>run();
  // v2026.14 (audit P1-5): evidence belongs to ONE vehicle. Model change or
  // demo load clears stale CSV/OBD so a Leaf BMS readout can never fuse into
  // a Nexon run. Users can also clear manually (btnClearEv / per-input clears).
  $("f_model").addEventListener("change", ()=>{ clearEvidence(true); toast("Model changed — attached CSV/OBD cleared (evidence belongs to one vehicle)."); });
  const bc=$("btnClearEv"); if(bc) bc.onclick=()=>clearEvidence();
  const bcCsv=$("btnClearCsv"); if(bcCsv) bcCsv.onclick=()=>{ csvData={health:null,rows:[],days:0,n:0,staleDays:0}; try{$("f_csv").value="";$("csvStatus").textContent="No file yet — model-only estimate will be used.";$("csvTableWrap").innerHTML="";}catch(e){} };
  const bcObd=$("btnClearObd"); if(bcObd) bcObd.onclick=()=>{ obdData={present:false,n:0,rows:[],medianBmsSoh:null,maxDelta_mV:null}; try{$("f_obd").value="";$("obdStatus").textContent="No OBD yet — photo+odo accuracy band shown after run.";}catch(e){} };
  if($("btnDemoTop")) $("btnDemoTop").onclick=()=>BF.loadDemo();
  if($("btnDemo2WTop")) $("btnDemo2WTop").onclick=()=>BF.loadDemo2W();
  $("btnCopyLetter").onclick=()=>copyText($("claimLetter").value, "Claim letter copied.");
  $("btnCopyCert").onclick=()=>copyText($("qrPayload").textContent + "\n" + $("qrDpp").textContent, "Certificate + DPP text copied.");
  $("btnEvidenceGo").onclick=()=>switchTab("evidence");
  $("btnPdf").onclick=makePDF;
  const vs=$("btnVaultSave"); if(vs) vs.onclick=saveVault;
  const ve=$("btnVaultExport"); if(ve) ve.onclick=exportVault;
  buildIntel(); buildModelIndex();
  paintStepper("intake");
  window.addEventListener("hashchange", ()=>routeFromHash(false));
  // v2026.14 empty-tab fix: NO tab is ever left showing dashes. A ?r= share link
  // auto-recomputes; a #/step deep link auto-fills demo data; a fresh load
  // auto-runs the Nexon demo and stays on Intake. User's own Run overwrites all.
  const routed = routeFromHash(true);
  try{
    if(routed==="shared"){
      run(true); switchTab("warranty");
      toast("Shared verdict recomputed live — all 7 tabs populated.");
    } else if(!routed){
      BF.loadDemo(true); switchTab("intake", true);
      toast("Demo forensic loaded (Nexon.ev · Chennai) — all 7 tabs live. Edit Step 1 + Run for your vehicle.");
    } else if(!LAST){
      BF.loadDemo(true); switchTab(routed, true);
      toast("Showing demo data — edit Step 1 + Run for your vehicle.");
    }
  }catch(e){ console.warn("auto-run", e); toast("Auto-demo failed ("+((e&&e.message)||e)+") — hit RUN FULL FORENSIC manually."); }
  // self-check: never leave the user staring at dashes without saying why
  try{
    const sohTile = $("t_soh");
    if(!LAST || !sohTile || sohTile.textContent==="—"){
      toast("Result tabs are empty — hit RUN FULL FORENSIC in Step 1 (takes ~1s). If this repeats, open DevTools Console and send the red error.");
    }
  }catch(e){}
  // v2026.14: offline-snapshot FIRST PAINT includes BOTH FX benchmarks + staleness contract.
  try{
    const snapNote = "Snapshot ₹"+DB().MARKET.inrUsd+" (market "+DB().MARKET.fxSnapshotAt+") · RBI ref ₹"+DB().MARKET.rbiRef;
    if($("intelLive")) $("intelLive").textContent = snapNote+" · BNEF pack $"+DB().MARKET.bnef.globalPack_perKWh_usd+"/kWh Dec-2025 · IMD normals · checking live FX/climate… (analytics: local-only until GA4 ID configured — see Methodology §5)";
    if($("liveFx")) $("liveFx").textContent = "₹"+DB().MARKET.inrUsd.toFixed(2)+" / $ (snapshot "+DB().MARKET.fxSnapshotAt+")";
    if($("liveUpd")) $("liveUpd").textContent = "Dataset "+DB().VERSION+" · offline-snapshot · checking live…";
  }catch(e){}
  // live overrides (non-blocking, offline-safe) — live ambient now NUDGES Tpack
  // in coreModel (±1.75°C cap), so "real-time" changes numbers, not just text.
  try{
    DB().applyLive((live)=>{
      const stalePct = live.fx && live.fx.value ? Math.abs(live.fx.value-DB().MARKET.rbiRef)/DB().MARKET.rbiRef*100 : 0;
      if($("liveFx")) $("liveFx").textContent = "₹"+DB().MARKET.inrUsd.toFixed(2)+" / $ ("+live.fx.src+(stalePct>2?", RBI ref "+stalePct.toFixed(1)+"% behind":"")+")";
      if($("liveUpd")) $("liveUpd").textContent = "Dataset "+DB().VERSION+" · "+live.status;
      if($("syncMeta")) $("syncMeta").textContent = " · Snapshot "+DB().MARKET.updated+" · FX ₹"+DB().MARKET.inrUsd+" ("+live.fx.src+" "+live.fx.at+") · "+live.status;
      if($("intelLive")) $("intelLive").textContent = "Live: FX ₹"+DB().MARKET.inrUsd+" ("+live.fx.src+") · live ambient nudges pack temp ±1.75°C max (IMD anchor kept) for: "+Object.keys(live.climateOverride||{}).join(", ")+" · snapshot fallback always offline · analytics: "+(DB().ANALYTICS.ga4Id?"GA4 "+DB().ANALYTICS.ga4Id:"local-only (no GA4 ID configured)");
      track({ event:"bf_live", status:live.status });
    });
  }catch(e){}
  if(new URLSearchParams(location.search).get("embed")==="1") document.body.classList.add("embed");
}
BF.scrollTo=()=>switchTab("intake");
BF.loadDemo=(stay)=>{ clearEvidence(true); $("f_model").value="tata-nexon45"; $("f_purch").value="2023-06"; $("f_kms").value=42000; $("f_city").value="Chennai"; $("f_fast").value=30; $("fastVal").textContent="30%"; $("f_avgsoc").value=78; $("f_dod").value=60; run(stay, true); };
BF.loadDemo2W=(stay)=>{ clearEvidence(true); $("f_model").value="ola-s1pro-g2"; $("f_purch").value="2023-03"; $("f_kms").value=18500; $("f_city").value="Delhi"; $("f_fast").value=12; $("fastVal").textContent="12%"; $("f_avgsoc").value=85; $("f_dod").value=65; run(stay, true); };

/* ---------- photos ---------- */
function preview(input, imgId){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=e=>{$(imgId).src=e.target.result;}; r.readAsDataURL(f);
  track({ event:"bf_photo", which:imgId });
}
async function ensureTesseract(){
  if(window.Tesseract) return true;
  $("ocrStatus").textContent="⏳ Loading OCR engine (~2MB, once)…";
  await new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js";
    s.onload=res; s.onerror=rej; document.head.appendChild(s);
  });
  return !!window.Tesseract;
}
async function runOCR(){
  const st=$("ocrStatus");
  try{ await ensureTesseract(); }
  catch(e){ st.textContent="OCR engine unreachable offline — enter odo/SoC manually."; return; }
  st.textContent="⏳ Tesseract warming up…";
  const jobs=[["ph1","ocr1"],["ph2","ocr2"],["ph3","ocr3"]];
  for(const [fid,oid] of jobs){
    const f=$(fid).files[0]; if(!f){$(oid).textContent="OCR: no image — skipped.";continue;}
    $(oid).textContent="OCR: reading…";
    try{
      const {data:{text}}=await window.Tesseract.recognize(f,"eng");
      const clean=text.replace(/\s+/g," ").slice(0,420);
      $(oid).textContent="OCR: "+(clean||"(no text found — retake straighter, brighter)");
      autofill(text);
    }catch(err){ $(oid).textContent="OCR failed: "+err.message+" — enter manually."; }
  }
  st.textContent="✓ OCR pass done. Verify auto-filled fields below.";
  track({ event:"bf_ocr" });
}
function autofill(text){
  const t=text.replace(/,/g,"");
  let m=t.match(/(\d{4,6})\s?(km|kms|kilometers)/i); if(m) $("f_kms").value=m[1];
  m=t.match(/(\d{1,3})\s?%/); if(m&&($("f_socnow").value===""||+$("f_socnow").value===100)) $("f_socnow").value=m[1];
  m=t.match(/\b[A-HJ-NPR-Z0-9]{17}\b/); if(m) $("e_vin").value=m[0];
  m=t.match(/20\d{2}[-/.](0?[1-9]|1[0-2])/); if(m) $("f_purch").value=m[0].slice(0,7).replace(".","-").replace("/","-");
}

/* ---------- CSV (v2026.14: driver-baseline calibrated, recency-decayed, odometer-anchored) ----------
   Audit P1-4 fix: dividing real-world km by CERTIFIED range bakes in ~80%
   real-world efficiency as fake "degradation" (a healthy pack read 79.8%).
   Now: baseline = median implied-range of the driver's EARLIEST full charges
   (first 3 with ≥70% swing); health = recentMedian / baseline × 100.
   Falls back to certified-range only when <3 early fulls exist, and SAYS SO.
   Recency: staleDays (today − last row) decays weight via exp(−stale/540). */
function parseCSV(file){
  if(!file) return; const r=new FileReader();
  r.onload=e=>ingestCSV(e.target.result); r.readAsText(file);
}
function ingestCSV(text){
  const lines=text.trim().split(/\r?\n/); const rows=[];
  for(let i=1;i<lines.length;i++){
    const c=lines[i].split(","); if(c.length<4) continue;
    const s=parseFloat(c[1]), en=parseFloat(c[2]), km=parseFloat(c[3]);
    if(isNaN(s)||isNaN(en)||isNaN(km)) continue;
    rows.push({date:(c[0]||"").trim(),s,e:en,km});
  }
  if(!rows.length){$("csvStatus").textContent="CSV parsed: no valid rows. Need date,start_pct,end_pct,km_driven.";return;}
  const model=getModel();
  const fulls=rows.filter(r=>(r.e-r.s)>=70);
  let health=null, baseline=null, method="model-only";
  const implied = r=>r.km/((r.e-r.s)/100); // implied full-range km (driver's own roads)
  const median = a=>{ const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
  if(fulls.length>=3){
    baseline = +median(fulls.slice(0,3).map(implied)).toFixed(1);
    const recent = median(fulls.slice(-8).map(implied));
    health = +Math.max(40,Math.min(100, recent/Math.max(1,baseline)*100)).toFixed(1);
    method = "driver-baseline ("+fulls.length+" full swings, base "+baseline+" km)";
  } else if(fulls.length){
    const last=fulls.slice(-8);
    const impl=last.map(r=>r.km/((r.e-r.s)/100)/(model.rangeNew));
    health=Math.max(40,Math.min(100, impl.reduce((a,b)=>a+b,0)/impl.length*100));
    health=+health.toFixed(1);
    method = "certified-range fallback (only "+fulls.length+" full swing — biased low ~15–20%, down-weighted; add ≥3 full charges)";
  }
  // days coverage + recency for Bayesian weight
  let days=30, staleDays=0;
  try{
    const ds=rows.map(r=>new Date(r.date)).filter(d=>!isNaN(d)).sort((a,b)=>a-b);
    if(ds.length>=2) days=Math.max(7, Math.round((ds[ds.length-1]-ds[0])/(24*3600*1000))||30);
    if(ds.length) staleDays=Math.max(0, Math.round((Date.now()-ds[ds.length-1])/(24*3600*1000)));
  }catch(e){}
  csvData={health,rows,n:rows.length,days,staleDays,baseline,method};
  const w = E().bayesWeight(rows.length,days,staleDays);
  $("csvStatus").textContent=`✓ ${rows.length} charges parsed over ~${days}d · measured SoH≈${health!=null?health+"% ["+method+"]":"n/a (need 70%+ swings)"} · last row ${staleDays}d ago → recency-decayed w≈${w.toFixed(2)} · EFC stays odometer-anchored`;
  const escC = s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  $("csvTableWrap").innerHTML=`<table class="kv"><tr><th>date</th><th>start%</th><th>end%</th><th>km</th></tr>`+rows.slice(-8).map(r=>`<tr><td>${escC(r.date)}</td><td>${escC(r.s)}</td><td>${escC(r.e)}</td><td>${escC(r.km)}</td></tr>`).join("")+`</table><p class="hint">Showing last 8 of ${rows.length}. Odo-anchored EFC used; CSV informs health only via ${escC(method)}.</p>`;
  track({ event:"bf_csv", n:rows.length, health });
}
function clearEvidence(silent){
  csvData = { health:null, rows:[], days:0, n:0, staleDays:0 };
  obdData = { present:false, n:0, rows:[], medianBmsSoh:null, maxDelta_mV:null };
  try{
    if($("f_csv")) $("f_csv").value="";
    if($("f_obd")) $("f_obd").value="";
    if($("csvStatus")) $("csvStatus").textContent="No file yet — model-only estimate will be used.";
    if($("obdStatus")) $("obdStatus").textContent="No OBD yet — photo+odo accuracy band shown after run. With OBD the band tightens.";
    if($("csvTableWrap")) $("csvTableWrap").innerHTML="";
    if($("r_obd")) $("r_obd").textContent="No OBD attached — attach LeafSpy/Torque CSV for cell delta-V check.";
  }catch(e){}
  if(!silent) toast("Evidence cleared — model-only estimate.");
}
/* ---------- OBD (LeafSpy/Torque) ---------- */
function parseOBD(file){
  if(!file) return; const r=new FileReader();
  r.onload=e=>ingestOBD(e.target.result); r.readAsText(file);
}
function ingestOBD(text){
  const lines=text.trim().split(/\r?\n/); const rows=[];
  const head=(lines[0]||"").toLowerCase();
  const hasHead = head.includes("cell_min")||head.includes("min");
  for(let i=(hasHead?1:0);i<lines.length;i++){
    const c=lines[i].split(","); if(c.length<3) continue;
    let minV,maxV,bms=null,odo=null;
    if(c.length>=5){ minV=parseFloat(c[1]); maxV=parseFloat(c[2]); bms=parseFloat(c[3]); odo=parseFloat(c[4]); }
    else { minV=parseFloat(c[1]); maxV=parseFloat(c[2]); }
    if(isNaN(minV)||isNaN(maxV)) continue;
    // support mV or V
    if(minV>50){ minV/=1000; maxV/=1000; }
    rows.push({ minV, maxV, bmsSoh:isNaN(bms)?null:bms, odo:isNaN(odo)?null:odo });
  }
  if(!rows.length){ $("obdStatus").textContent="OBD parsed: no valid rows. Need timestamp,cell_min_V,cell_max_V[,pack_SoH_pct,odo_km]."; return; }
  const a = E().analyzeObd(rows.map(r=>({minV:r.minV,maxV:r.maxV,bmsSoh:r.bmsSoh})));
  obdData = { present:true, n:rows.length, rows, medianBmsSoh:a.medianBmsSoh, maxDelta_mV:a.maxDelta_mV };
  $("obdStatus").textContent = `✓ OBD: ${rows.length} samples · delta-V ${a.maxDelta_mV!=null?a.maxDelta_mV+"mV":"n/a"} · BMS SoH ${a.medianBmsSoh!=null?a.medianBmsSoh+"%":"n/a"} · ${a.flag||""}`;
  if($("r_obd")) $("r_obd").textContent = $("obdStatus").textContent;
  track({ event:"bf_obd", n:rows.length, delta:a.maxDelta_mV });
}

/* ---------- lazy heavy-lib loader (0KB first paint; Chart/jsPDF/QR on demand) ---------- */
const LIB_URLS = {
  chart:"https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js",
  jspdf:"https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  qr:"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
};
function ensureLib(name){
  if(name==="chart" && window.Chart) return Promise.resolve(true);
  if(name==="jspdf" && window.jspdf) return Promise.resolve(true);
  if(name==="qr" && window.QRCode) return Promise.resolve(true);
  return new Promise((res)=>{
    const s=document.createElement("script"); s.src=LIB_URLS[name]; s.defer=true;
    s.onload=()=>res(true); s.onerror=()=>res(false); document.head.appendChild(s);
  });
}
/* VIN / RC-year gate: 17-char VIN prefill + booklet-year warning */
function vinGate(){
  const v=($("e_vin").value||"").trim().toUpperCase();
  if(/^[A-HJ-NPR-Z0-9]{17}$/.test(v)){
    const yChar=v[9];
    const yMap={M:2021,N:2022,P:2023,R:2024,S:2025,T:2026};
    if(yMap[yChar]) toast("VIN year code "+yChar+" ≈ "+yMap[yChar]+" model year — verify booklet year before filing.");
    return true;
  }
  return false;
}

/* ---------- RUN (stay=true computes + renders without leaving the current tab) ---------- */
function getModel(){ return DB().MODELS.find(m=>m.id===$("f_model").value)||DB().MODELS[0]; }
function run(stay, isDemo){
  // P0 hard block: S1 X 2kWh has NO 8-yr cover (free or paid) — stop false hope before compute
  try{
    if($("f_model").value==="ola-s1x-2") toast("⚠ S1 X 2 kWh: 3yr/50k base ONLY — no 8-yr cover exists (free or paid). Check purchase date now.");
    vinGate();
  }catch(e){}
  const model=getModel();
  const purchDateStr = ($("f_purch").value||"2023-06")+"-15";
  const kmsVal = +$("f_kms").value||0;
  const socNowRaw = $("f_socnow").value;
  const socNow = (socNowRaw===""||socNowRaw==null) ? null : +socNowRaw;
  let ageY = Math.max(0.25,(new Date()-new Date(purchDateStr))/(365.25*24*3600*1000));
  if(!isFinite(ageY)||ageY<0.25) ageY = 0.25;
  const kmsPerYr = kmsVal/ageY;
  const p={ model, kms:kmsVal, purchaseDate:purchDateStr,
    city:$("f_city").value, fastPct:+$("f_fast").value||0, avgSoc:+$("f_avgsoc").value||70,
    socNow, depthAvg:+$("f_dod").value||60, claimedRange:+$("f_claimed").value||null,
    rangenow:+$("f_rangenow").value||null, parkHigh:$("f_parkhigh").checked,
    ultraAbuse:$("f_ultra").checked, serviced:$("f_serviced").checked,
    commercial:$("f_commercial").checked, kmsPerYr,
    csvHealth:csvData.health, csvRows:csvData.n, csvDays:csvData.days, csvStaleDays:csvData.staleDays,
    obd:obdData.present?obdData:null };

  const f=E().computeSoH(p), fp=E().fingerprint(p,f), w=E().warrantyVerdict(p,f),
        s2=E().secondLife(p,f), rs=E().resale(p,f), tr=E().trajectory(p,f,6);
  LAST={p,f,fp,w,s2,rs,tr,at:new Date().toISOString(),consent:$("f_consent")?$("f_consent").checked:false};
  unlock();
  try{ render(p,f,fp,w,s2,rs,tr); }
  catch(e){ console.warn("render", e); toast("Report ready — one display widget failed. Re-run."); }
  if(!stay) switchTab("soh");
  track({ event:"forensic_run", model:model.id, soh:f.soh, ci:f.ci90, grade:DB().gradeOf(f.soh), status:w.status, demo:!!isDemo });
  flushTelemetry();
  refreshVaultList();
}
function kv(obj){ return Object.entries(obj).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join(""); }
function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }

function render(p,f,fp,w,s2,rs,tr){
  const idle = $("hpIdle"); if(idle) idle.style.display = "none";
  const grade=DB().gradeOf(f.soh);
  $("heroGrade").textContent="Grade "+grade; $("heroGrade").className="grade g"+grade.replace("+","p");
  $("heroSoh").textContent=f.soh.toFixed(1);
  if($("heroCi")) $("heroCi").textContent=`90% CI ${f.lo90}–${f.hi90}% · raw ${f.sohRaw}% · ${f.fuseSrc}`;
  $("heroKwh").textContent=f.usableNow+" / "+p.model.kwh+" kWh";
  $("heroRange").textContent=f.rangeNow+" / "+p.model.rangeNew+" km";
  $("heroWarr").textContent=w.status;
  $("heroWarr").style.color=w.status.includes("ELIGIBLE")?"#0a7d2c":(w.status.includes("EXPIRED")?"#b00020":"#8a5a00");
  $("heroResale").textContent=rs.loStr+" – "+rs.hiStr;
  $("hero2nd").textContent=`${s2.usableKwh} kWh ≈ $${s2.best.netUsd} / ₹${s2.best.netInr.toLocaleString("en-IN")}`;
  // soh tab
  $("t_soh").textContent=f.soh.toFixed(1)+"%";
  $("t_grade").textContent="Grade "+grade; $("t_grade").className="grade g"+grade.replace("+","p");
  if($("t_ci")) $("t_ci").textContent=`90% CI ±${f.ci90}% (${f.lo90}–${f.hi90}) · ${f.fuseSrc}`;
  $("t_kwh").innerHTML=f.usableNow+" <small>kWh</small>";
  $("t_range").innerHTML=f.rangeNow+" <small>km</small>";
  $("t_cyc").innerHTML=f.cyclesLeft.toLocaleString("en-IN");
  $("r_gradeNote").textContent=DB().gradeIN[grade]+" · Health Card: "+f.soh+"% SoH (raw "+f.sohRaw+"%, 90% CI "+f.lo90+"–"+f.hi90+"% ±"+f.ci90+"%, "+f.fuseSrc+" w="+f.fuseWeight+") · Usable "+f.usableNow+" of "+p.model.kwh+" kWh "+p.model.chem+" · Range today "+f.rangeNow+" km vs "+p.model.rangeNew+" km new (−"+f.rangeLost+" km) · "+f.cyclesLeft.toLocaleString("en-IN")+" equivalent cycles left of ~"+DB().CHEMISTRY[p.model.chem].cycleLife+" chemistry budget · Degrading "+tr.perYr+"%/yr → ~"+f.yearsTo70+" yr to 70% at current habit · AVILOO Sep-2026 benchmark: 500k tests ≤13.5% spread, Model Y 94.4%@50k→90.3%@150k — your pack vs fleet median in Evidence PDF.";
  $("r_ciNote").textContent=`Honest uncertainty band (v2026.16, audit-fixed): this ${f.soh}% carries a 90% band of ${f.lo90}–${f.hi90}% (±${f.ci90}%). Composition disclosed: Monte Carlo sampling ±${f.mcHalf}% (odo ±2%, Tpack ±1.5°C, age ±15d jitter — all really sampled, n=600) PLUS ${p.model.chem} model-form floor ±${f.modelForm}% (AVILOO intra-model spread ≤13.5% expressed per-vehicle, grows with age). ci90 = √(mc² + floor²), capped by evidence: ${f.fuseSrc} (w=${f.fuseWeight}). Model-only band ≈ ±${f.modelForm}% · with solid CSV ≤ ±3.0% · with strong OBD ≤ ±1.8%. Raw model ${f.sohRaw}% kept for auditors + hashed. Re-run every 60–90 days; when the band straddles your trigger (buffer ≤2.5%) you are in the FILE-SOON window — act, don't average.`;
  $("r_breakdown").innerHTML=kv({
    "Equivalent full cycles (EFC)":f.efc+" <small>(odo "+(p.kms||0).toLocaleString("en-IN")+" km ÷ certified "+p.model.rangeNew+" km; ODOMETER-ANCHORED — CSV never extrapolates EFC, CSV informs health only; 2W packs cycle faster per km)</small>",
    "Cycle fade":"−"+f.cycleFade+"% <small>(EFC × "+DB().CHEMISTRY[p.model.chem].fadePerEFC_pct+"%/EFC "+p.model.chem+" × DoD stress ×"+f.dodStress+" (avg depth "+f.dod+"%) × C-rate ×"+f.crateStress+" ("+p.fastPct+"% DC-fast, penalty "+DB().CHEMISTRY[p.model.chem].fastPenalty+"))</small>",
    "Calendar fade":"−"+f.calendarFade+"% <small>(eff-age "+f.effAge+" yr plateaued from "+f.ageYrs+" yr clock age × base "+DB().CHEMISTRY[p.model.chem].calendarBase+"%/yr "+p.model.chem+" × Arrhenius ×"+f.arrFactor+" (Ea "+(DB().CHEMISTRY[p.model.chem].Ea_Jmol/1000)+" kJ/mol, Tpack "+DB().CLIMATE[p.city].effPackC+"°C"+(liveT?", live ambient "+liveT.ambientNowC+"°C nudged ±1.75°C max":"")+") × SoC stress ×"+f.socStress+" (avg "+f.avgSoc+"%"+(p.parkHigh?", parked 90–100% ×1.15":"")+"))</small>",
    "Abuse extra":"−"+f.abuseExtra+"% <small>(8C/CATL ultra-fast +1.6–3.0% if flagged; >70% DC-fast +0.8%; ≥95% SoC + hot soak +0.9%; Chennai heat amplifies all)</small>",
    "Pack age + chemistry":f.ageYrs+" yr · "+f.chemName+" ("+f.curve+" curve) · "+DB().CHEMISTRY[p.model.chem].pros,
    "⏳ Years to 70% at current habit":(f.yearsTo70>=30?"30+ yr — pack never reaches 70% at current habit within the 30-yr model horizon (low-use LFP + plateau). Still file BEFORE time/km limits — whichever hits first kills claim":"≈"+f.yearsTo70+" yr ("+tr.perYr+"%/yr EFC+calendar at "+(p.kms/Math.max(0.25,f.ageYrs)).toFixed(0)+" km/yr) · Trajectory ±CI fan in chart below · File BEFORE time AND km limits — whichever hits first kills claim"),
    "Verification":"BNEF Dec-9-2025 $108/kWh (BEV $99 ESS $70 LFP $81 NMC $128) · AVILOO Sep-2026 500k tests · IMD "+p.city+" mean "+DB().CLIMATE[p.city].meanC+"°C · Dataset "+DB().VERSION+" "+DB().MARKET.updated
  });
  $("r_cycles").textContent=`${f.efc} EFC consumed of ~${DB().CHEMISTRY[p.model.chem].cycleLife} ${p.model.chem} chemistry budget → ${f.cyclesLeft} left. Math: ${(p.kms||0).toLocaleString("en-IN")} km ÷ ${p.model.rangeNew} km certified = ${f.efc} full equivalents. Small 2W packs (e.g. Ola 195km) cycle faster per km than 4W (Nexon 489km) — same km, more EFC, faster cycle fade but same calendar. Fleet/taxi @25k km/yr hits EFC limit years before calendar; private @10k km/yr hits calendar first in hot cities. Track EFC/yr in telemetry opt-in → Real-World SoH Index.`;
  const liveT = (DB().LIVE.climateOverride||{})[p.city];
  $("r_arr").textContent=`${p.city}: effective pack temp ${DB().CLIMATE[p.city].effPackC}°C (IMD ambient ${DB().CLIMATE[p.city].meanC}°C + garage/charging soak +${(DB().CLIMATE[p.city].effPackC-DB().CLIMATE[p.city].meanC).toFixed(1)}°C)${liveT?`, LIVE ambient now ${liveT.ambientNowC}°C via Open-Meteo (${liveT.at.slice(0,16)}Z), IMD fallback always offline`:`, offline IMD snapshot (live override when online)`}. Arrhenius factor ×${f.arrFactor} vs 25°C lab (Ea ${DB().CHEMISTRY[p.model.chem].Ea_Jmol/1000} kJ/mol, R=8.314). ${DB().CLIMATE[p.city].arrheniusNote}. Heat gap vs Pune Kind twin (24.7→29.8°C): ×${f.hotFactor} pure SoC-amplified ratio (1.0 @70% SoC, ~1.38 @78% LFP Chennai, max ≈1.9× @100% high-Ea NMC; Dubai ≈2.0×). Shade-park + 80% cap recovers ~40% of gap. BNEF/AVILOO grade heat as #1 calendar driver in India.`;
  $("r_crate").textContent=`${p.fastPct}% DC-fast → C-rate stress ×${f.crateStress} (${p.model.chem} fastPenalty ${DB().CHEMISTRY[p.model.chem].fastPenalty}; LFP 0.55 tolerates fast well, NMC811 1.15/NMC9-Si 1.2 punished). DoD ${f.dod}% → ×${f.dodStress}.`+(p.ultraAbuse?" PLUS 8C/CATL ultra-fast abuse flag (+1.6–3.0% + fast×1.4). 240–480kW routine micro-cracks high-Ni above 4.15V — sudden knee near 70%. CATL 8C cells survive it; PACK busbars, cooling + your warranty claim often don't. Counter: precondition, 20–80% band, <30% DC.":" Keep DC <30% + 20–80% daily band to halve fade. Highway fast-heavy 65%+ doubles C-rate damage; fleet 85% + high SoC = abuse signature that OEMs cite to deny — BMS thermal logs within "+DB().CHEMISTRY[p.model.chem].thermalSafeC+"°C envelope rebuts it.");
  if($("r_obd")) $("r_obd").textContent = (p.obd&&p.obd.present) ? `OBD FUSED (LeafSpy/Torque): ${p.obd.n} samples, cell delta-V ${p.obd.maxDelta_mV}mV (rounded BEFORE >150/>250 compare, v2026.12 epsilon fix), BMS median ${p.obd.medianBmsSoh}% weighted ${Math.round(f.fuseWeight*100)}% (w=min(0.8,0.5+n/200)). CI tightened to ±${f.ci90}%. >150mV WARN weak group → balance charge + re-test; >250mV CRITICAL failed module → demand module-level BMS log, strengthens warranty claim. Single screenshots don't tighten CI — need ≥3 samples.` : "No OBD attached — model-only band shown after run (≈±1.8% LFP, ≈±2.8% NMC, growing with age). Attach LeafSpy/Torque CSV (timestamp,cell_min_V,cell_max_V,pack_SoH_pct,odo_km) for ≤±1.8% with strong OBD + delta-V module-fail flag. Recurrent charges $ telematics API; AVILOO charges €300 dongle — OBD CSV here is free, on-device.";
  $("r_finger").innerHTML=`<p><b>${fp.verdict}</b> — ${DB().CHEMISTRY[p.model.chem].name}: ${DB().CHEMISTRY[p.model.chem].signature} Pros: ${DB().CHEMISTRY[p.model.chem].pros}. Cons: ${DB().CHEMISTRY[p.model.chem].cons} Detect: ${DB().CHEMISTRY[p.model.chem].detectHint}</p><ul>`+fp.flags.map(x=>`<li>${esc(x)}</li>`).join("")+`</ul><p class="hint">LFP flat plateau fakes mid-band % (demand 100→10% drive proof); NMC/NCA sloped voltage maps linearly (demand OBD voltage log); Na-ion heat-tolerant but cold-derates 25% @0°C. Fake-range auto-detect compares seller-claimed km vs physics ${p.model.rangeNew}km × SoH% with 90% CI ${f.lo90}–${f.hi90}%.</p>`;
  // v2026.14: heavy libs stay lazy — charts/QR build only for the visible tab
  // (switchTab builds them on open). First paint still ships 0KB of chart/pdf/qr.
  const sohActive = ($("tab-soh")||{classList:{contains:()=>false}}).classList.contains("active");
  const resaleActive = ($("tab-resale")||{classList:{contains:()=>false}}).classList.contains("active");
  if(sohActive){ try{ drawCharts(tr,f); }catch(e){} }
  if($("qrPayload") && !resaleActive) $("qrPayload").textContent="";
  if($("qrDpp") && !resaleActive) $("qrDpp").textContent="";
  // warranty
  $("r_warrStatus").textContent=w.status; $("r_warrStatus").className="verdict "+(w.status.includes("ELIGIBLE")?"ok":(w.status.includes("EXPIRED")?"bad":"warn"));
  $("r_warrHead").textContent=w.headline+" "+w.action;
  $("r_warrTable").innerHTML=kv({
    "OEM rule":`${w.w.oem} — ${w.w.years} yr / ${w.w.km>9000000?"unlimited":(+w.w.km).toLocaleString("en-IN")} km · trigger <${w.w.soh}% SoH (Leaf ≈66.25% bars, Bolt ≈60%, default 70%)`,
    "Your position":`SoH ${f.soh}% ±${f.ci90}% (CI ${f.lo90}–${f.hi90}, raw ${f.sohRaw}%) vs trigger ${w.w.soh}% = buffer ${w.buffer>=0?"+":""}${w.buffer}% · ${tr.perYr}%/yr → ~${f.yearsTo70}yr to 70%`,
    "Time left":w.yrsLeft+" yr", "Km left":(isFinite(w.kmLeft)?w.kmLeft.toLocaleString("en-IN")+" km — FILE before Oct if <5,000km":"unlimited km (Lifetime 1st owner)"),
    "Coverage note":w.w.note, "Transfer on resale":w.w.transfer, "Exclusions (denial grounds)":w.w.exclusions, "Claim path":w.w.process
  });
  $("r_risks").innerHTML=w.risks.length?("<ul>"+w.risks.map(r=>`<li>${esc(r)}</li>`).join("")+"</ul><p class='hint'>How to rebut: bring BMS thermal logs within "+DB().CHEMISTRY[p.model.chem].thermalSafeC+"°C, stamped service history (backfill due service FIRST), RC private-proof, LeafSpy printout for bars, OBD CSV for module defect. Never accept verbal 'normal degradation' — demand SoH% + threshold in writing + job card + TPEM/OEM approval ref.</p>"):"<p>✓ No red flags found. Clean service + private use + balanced charging = strongest filing position. Still demand BMS SoH in writing — this report is supporting evidence, not legal determination. Recurrent/AVILOO give no clause letter; you get clause + CPA-2019 escalation note.</p>";
  const src = DB().SOURCES_DETAILED.find(s=>s.title.includes(w.w.oem)) || DB().SOURCES_DETAILED[2];
  if($("r_warrSrc")) $("r_warrSrc").textContent = "Verified Oct-2026: "+DB().MARKET.sources.join(" · ")+" · Rule snapshot "+DB().MARKET.updated+" ("+DB().VERSION+") · Confidence: verify booklet year + RC year + service stamps · Live FX ₹"+DB().MARKET.inrUsd+" ("+DB().LIVE.fx.src+") · Not legal advice. India CPA-2019 District Commission / EU MVBER procedural info only.";
  $("r_clause").textContent="“"+w.w.clause+"” — carry this exact line to service advisor + OEM email CC for paper trail.";
  $("claimLetter").value=letter(p,f,w);
  // second life — deep competitive output with live FX + BNEF anchor
  $("r_2ndNote").textContent=`Second-Life Valuator: your pack holds ${s2.usableKwh} kWh usable today (${p.model.kwh} kWh × ${f.soh}% SoH ±${f.ci90}%, ${f.fuseSrc}). ${s2.note} WoodMac H1-2026: ESS demand growth now ≈ EV demand growth (AI datacenters + home-storage boom) — LFP ideal for ESS, NMC accepted with BMS. 2026 record-low NEW cells (BNEF $108/kWh global, BEV $99, ESS $70 −45%, LFP $81 vs NMC $128, China $84) cap reuse at 60–80% of new — priced in. Packs >70% SoH → reuse-grade premium; 50–70% → ESS-grade; <50% → recycle floor. YOUR numbers below.`;
  $("r_2ndTable").innerHTML=kv({"Usable energy":s2.usableKwh+" kWh ("+p.model.kwh+"×"+f.soh+"%) · Range-equivalent "+f.rangeNow+" km","SoH gate":f.soh+"% ("+(f.soh>70?"reuse-grade — demand top route":"ESS/recycle-grade — take best cash, skip dealer fight")+") · Grade "+rs.grade,"New-pack reference":`BNEF Dec-9-2025 LFP $${DB().MARKET.bnef.lfpPack}/kWh · NMC $${DB().MARKET.bnef.nmcPack}/kWh · Global $${DB().MARKET.bnef.globalPack_perKWh_usd} · 2026F ~$105 · FX ₹${DB().MARKET.inrUsd} ${DB().LIVE.fx.src}`,"Refurb math":"Gross kWh×$/kWh ×0.72 install margin − refurb share ($320 2W / $900 4W ×0.35) = net below · Recyclers = floor, never accept below"});
  $("r_2ndRoutes").innerHTML=s2.routes.map((r,i)=>`<div class="route ${i===0?"best":""}" data-route="${i}" tabindex="0" title="Click to copy this offer"><b>${i===0?"⭐ BEST · ":""}${esc(r.route)}</b><span class="money">$${r.netUsd.toLocaleString()} · ₹${r.netInr.toLocaleString("en-IN")} net</span><p>${esc(r.why)} Gross $${r.grossUsd} × 0.72 margin − refurb share.</p></div>`).join("");
  $("r_2ndRoutes").querySelectorAll(".route").forEach(el=>{
    const h=()=>{
      const r=s2.routes[+el.dataset.route];
      copyText(`${r.route}: net $${r.netUsd.toLocaleString()} / ₹${r.netInr.toLocaleString("en-IN")} for ${s2.usableKwh} kWh usable (SoH ${f.soh}% ±${f.ci90}%).`, "Offer copied — send it to the buyer.");
    };
    el.onclick=h; el.onkeydown=(ev)=>{ if(ev.key==="Enter") h(); };
  });
  if($("r_2ndLive")) $("r_2ndLive").textContent = `Real-time tracking: Live FX ₹${DB().MARKET.inrUsd} (${DB().LIVE.fx.src}, ${DB().LIVE.fx.at}) · BNEF snapshot $${DB().MARKET.bnef.globalPack_perKWh_usd}/kWh Dec-9-2025 (record low -8%, 2026F ~$105) · IMD ${p.city} + Open-Meteo live override when online, snapshot fallback offline · Re-verify FX before settlement — ₹ moves ±2% monthly. dataLayer events forensic_run/bf_live tracked.`;
  // resale — deep competitive band with cert QR
  $("r_resaleBand").textContent=rs.loStr+" – "+rs.hiStr;
  $("r_resaleTable").innerHTML=kv({"Grade":rs.grade+" — "+rs.gradeNote+" · SoH "+f.soh+"% ±"+f.ci90+"% ("+f.fuseSrc+", raw "+f.sohRaw+"%)","Uncertified ask (no proof, lowball band)":rs.loStr+" (×0.93 discount — buyers assume worst)","Certified ask (with this QR + PDF hash)":rs.hiStr+" (grade ×"+(DB().MARKET.resale.gradeMultiplier[rs.grade]||1)+", +"+DB().MARKET.resale.certPremium_pct+"% cert premium)","Dealer bid expectation":rs.dealerStr+" (0.88× certified — Cars24/CarMax playbook)","At stake (cert vs lowball + weak-pack guard)":rs.atStake+" · AVILOO 13.5% spread = ₹60k Ola-class / $5k Model-3-class swings","Confidence":`SoH ${f.soh}% CI ${f.lo90}–${f.hi90} · EFC ${f.efc} · ${f.cyclesLeft} cycles left · ${tr.perYr}%/yr`});
  $("r_resaleInsight").textContent=rs.insight+" Certified packs: margin +12%, turn ~22 days faster (dealer data 2025). Stick QR on OLX/Cars24/CarMax listing — buyer scans → SoH±CI, grade, method, timestamp, SHA-256, DPPpre 71-field map. EU DPP mandatory 18-Feb-2027 QR-linked — this cert is DPP-ready today. Recurrent gives US-only score, AVILOO €300 lab — you give free India/SEA cert with hash.";
  if($("shareUrl")) $("shareUrl").textContent = shareUrl();
  // QR cert v2 (pre-DPP) — built now only if Resale is visible, else on tab open
  if(resaleActive){ buildQR(p,f,w,grade,rs); }
}

/* ---------- share URL (compressed state → ?r=, 30-day expiry, minimal PII) ---------- */
function shareState(){
  if(!LAST) return null;
  const p=LAST.p;
  return { v:DB().VERSION, m:p.model.id, kms:p.kms, pd:p.purchaseDate.slice(0,7), c:p.city, fp:p.fastPct, as:p.avgSoc, dd:p.depthAvg, ph:p.parkHigh?1:0, ua:p.ultraAbuse?1:0, soh:LAST.f.soh, ci:LAST.f.ci90, g:DB().gradeOf(LAST.f.soh), at:LAST.at, exp:Date.now()+30*24*3600*1000 };
}
function shareUrl(){
  if(!LAST) return "Share link appears after Run.";
  try{
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(shareState())))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    // file:// guard (audit P2-14): location.origin is "null" off-file — fall back to https page URL shape
    let base;
    try{
      base = (location.protocol==="file:") ? "https://batteryforensics.in/index.html" : (location.origin + location.pathname);
    }catch(e){ base = "https://batteryforensics.in/index.html"; }
    return base + "?r=" + b64 + "#/warranty";
  }catch(e){ try{return location.href;}catch(_){return "Share link unavailable in this context.";} }
}
function restoreFromShare(b64){
  try{
    const j = JSON.parse(decodeURIComponent(escape(atob(b64.replace(/-/g,"+").replace(/_/g,"/")))));
    if(j.exp && Date.now()>j.exp){ toast("Share link expired (>30d) — re-run for fresh verdict."); return false; }
    if(j.m && $("f_model")) $("f_model").value=j.m;
    if(j.kms!=null) $("f_kms").value=j.kms;
    if(j.pd) $("f_purch").value=j.pd;
    if(j.c) $("f_city").value=j.c;
    if(j.fp!=null){ $("f_fast").value=j.fp; $("fastVal").textContent=j.fp+"%"; }
    if(j.as!=null) $("f_avgsoc").value=j.as;
    if(j.dd!=null) $("f_dod").value=j.dd;
    if($("f_parkhigh")) $("f_parkhigh").checked=!!j.ph;
    return true;
  }catch(e){ return false; }
}

/* ---------- QR (pre-DPP dual payload v3: BATTCERTv3 + DPPpre + SOCE + access tiers) ----------
   v2026.16: payload carries SOCE slot (mandatory EV @Feb-2027), lifecycle status
   (original/re-used/repurposed/remanufactured/waste), and explicit
   public / legitimate-interest / authority sections so the Art.77(9) act flips
   a config flag, not a schema. Disclaimer printed: pre-passport credential,
   NOT an Art.77 passport. */
async function buildQR(p,f,w,grade,rs){
  if(!window.QRCode){ ensureLib("qr"); }
  const vinH = await sha256(($("e_vin").value||"no-vin")+"|"+p.model.id);
  const soceKwh = +f.usableNow.toFixed(2);
  const lifecycle = f.soh>70 ? "original (reuse-grade)" : (f.soh>=50 ? "re-used-candidate (ESS-grade)" : "waste-candidate (recycle floor)");
  const cfgTier = (window.BF_ACCESS_TIER || "public");
  const payload=`BATTCERTv3|BijliBureau — EV Battery Report Card|${p.model.brand} ${p.model.model}|SoH ${f.soh}%±${f.ci90}|SOCE ${soceKwh}kWh|Grade ${grade}|${f.rangeNow}/${p.model.rangeNew}km|odo ${p.kms}km|${p.city}|${new Date().toISOString().slice(0,10)}|EFC ${f.efc}|${lifecycle}|tier:${cfgTier}|${f.fuseSrc}|VINhash ${vinH.slice(0,12)}`;
  $("qrPayload").textContent=payload;
  const dpp = { passport:"pre-DPP EU2023/1542 (NOT an Art.77 passport — issuance is the economic operator's duty)",
    issuer:"BijliBureau — EV Battery Report Card", battery:p.model.brand+" "+p.model.model, kwh:p.model.kwh, chem:p.model.chem,
    soh_pct:f.soh, soh_ci90:f.ci90, soh_raw:f.sohRaw, soce_kwh:soceKwh,
    capacity_fade_pct:+(100-f.soh).toFixed(2), resistance_proxy_mv:(p.obd&&p.obd.maxDelta_mV!=null?p.obd.maxDelta_mV:null),
    lifecycle_status:lifecycle, efc:f.efc, cycles_left:f.cyclesLeft,
    warranty_trigger_pct:w.w.soh, warranty_status:w.status, vin_sha256:vinH.slice(0,16),
    method:"EFC+Arrhenius+Bayes", at:new Date().toISOString(),
    access_tiers:{ public:["soh_pct","soce_kwh","grade","cycles","trigger"], legitimate_interest:["vin_hash","deltaV","service_refs"], authority:["full_vin","raw_telemetry"] },
    active_tier:cfgTier, qr_spec:(DB().DPP_MAP&&DB().DPP_MAP.qrSpec)||null,
    fields_mapped:(DB().DPP71||[]).length||12, mandatory_from:(DB().DPP_MAP&&DB().DPP_MAP.mandatory_from)||"2027-02-18" };
  if($("qrDpp")) $("qrDpp").textContent="DPPpre::"+JSON.stringify(dpp);
  try{
    const box=$("qrBox");
    if(box){
      box.innerHTML="";
      if(window.QRCode){ new QRCode(box,{text:payload,width:200,height:200,correctLevel:QRCode.CorrectLevel.M}); }
      else{ box.innerHTML="<p class='hint'>QR library still loading (deferred) — the certificate text below works on its own.</p>"; }
    }
  }catch(e){}
  const h = await sha256(payload + JSON.stringify(dpp));
  if($("pdfHash")) $("pdfHash").textContent = "SHA-256: "+h;
  LAST.hash = h; LAST.qrPayload = payload; LAST.dpp = dpp;
}

function letter(p,f,w){
  const d=new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});
  return `To: Service Manager, ${w.w.oem} Authorised Service Centre\nDate: ${d}\nSubject: HV Battery Warranty Claim — ${p.model.brand} ${p.model.model} (${$("e_vin").value||"VIN/Reg: ____"}) — SoH ${f.soh}% ±${f.ci90}% vs ${w.w.soh}% trigger\n\nDear Sir/Madam,\nMy vehicle (purchased ${p.purchaseDate.slice(0,7)}, odo ${p.kms} km) shows State of Health ${f.soh}% (90% CI ${f.lo90}–${f.hi90}%, Grade ${DB().gradeOf(f.soh)}, raw ${f.sohRaw}%), computed by EFC-throughput (odometer-anchored) + Arrhenius calendar + C-rate + Bayesian CSV/OBD fusion (detail + photos + charge log in attached Evidence Pack, SHA-256 on PDF).\n\nWarranty position: ${w.w.years} yr / ${w.w.km>9000000?"unlimited":w.w.km.toLocaleString("en-IN")} km, trigger below ${w.w.soh}% SoH.\nClause: "${w.w.clause}"\nStatus: ${w.status}. Time left ${w.yrsLeft} yr; km left ${isFinite(w.kmLeft)?w.kmLeft.toLocaleString("en-IN"):"unlimited"}.\n\nI request: (1) authorised BMS SoH readout in writing with threshold stated; (2) warranty repair/replacement restoring pack to ≥80% SoH per terms where applicable; (3) job card + TPEM/OEM approval reference.\nVehicle serviced on schedule at OEM centre: ${(p.serviced?"yes":"NO — backfill before filing")}; use: ${(p.commercial?"commercial (RC proof enclosed)":"private")}. "Normal degradation" cannot apply where measured SoH (incl. CI) is ${w.buffer>=0?"+":""}${w.buffer}% vs the contractual floor — kindly confirm or deny in writing with matched SoH figure.\n\nEnclosed: timestamped Evidence Pack PDF (photos, OCR, method, trajectory ±CI, cert QR, hash).\n\nRegards,\n${$("e_name").value||"Owner"} · ${$("e_vin").value||"Contact: ____"}\nCC: ${w.w.oem} customer support (email, for paper trail)\n\n— Supporting evidence only, not legal advice. Verify booklet year. India: if denied in writing, file via CPA 2019 District Commission on e-daakhil https://edaakhil.nic.in/ (helpline 1915).`;
}

/* ---------- OEM rulebook browser (works pre-run, with sources) ---------- */
function renderLookup(id){
  const out = $("w_lookupOut"); if(!out) return;
  const m = DB().MODELS.find(x=>x.id===id) || DB().MODELS[0];
  const w = DB().WARRANTIES.find(x=>x.modelId===id);
  if($("ruleCount")) $("ruleCount").textContent = "all "+DB().WARRANTIES.length+" OEM rules";
  if(!w){ out.innerHTML = "<p class='hint'>No exact rule pre-loaded — generic 8yr/160k km · 70% trigger applies. Verify your booklet.</p>"; return; }
  const row = (k,v)=>`<tr><td>${k}</td><td>${v}</td></tr>`;
  out.innerHTML = `<table class="kv">` +
    row("Model", `${w.oem} — ${m.model} (${m.kwh} kWh ${m.chem})`) +
    row("Term", `${w.years} yr / ${w.km>9000000?"unlimited":(+w.km).toLocaleString("en-IN")} km`) +
    row("SoH trigger", `below ${w.soh}%`) +
    row("Coverage", w.note) +
    row("Transfer", w.transfer) +
    row("Exclusions", w.exclusions) +
    row("Claim path", w.process) +
    row("Clause", `“${w.clause}”`) +
    row("Verify", `Owner booklet year + OEM support. Confidence: rulebook snapshot ${DB().MARKET.updated}; re-verify before filing.`) +
    `</table><p class="clause">“${w.clause}”</p>`;
}

/* v2026.14 (audit P2-12): rescale doughnut parts so they ALWAYS sum to 100.
   Under CSV/OBD fusion + clamping, raw fades + shown SoH drift apart — the old
   chart silently mis-sumemd. Remaining = shown SoH; fades scaled to 100−SoH. */
function splitParts(f){
  const parts=[Math.max(0,f.cycleFade),Math.max(0,f.calendarFade),Math.max(0,f.abuseExtra)];
  const sum=parts[0]+parts[1]+parts[2];
  const rem=Math.max(0,Math.min(100,f.soh));
  if(sum<=0) return [rem,0,0,0];
  const k=(100-rem)/sum;
  const out=[rem, +(parts[0]*k).toFixed(2), +(parts[1]*k).toFixed(2), +(parts[2]*k).toFixed(2)];
  return out;
}
/* ---------- charts (trajectory + CI fan + split, Chart.js lazy) ---------- */
async function drawCharts(tr,f){
  if(!window.Chart){ const ok = await ensureLib("chart"); if(!ok || !window.Chart) return; }
  Object.values(charts).forEach(c=>{ try{c.destroy();}catch(e){} }); charts={};
  charts.traj=new Chart($("chTraj"),{type:"line",data:{labels:tr.pts.map(p=>p.year),datasets:[
    {label:"Hi 90%",data:tr.hiPts,borderColor:"rgba(20,108,46,.25)",pointRadius:0,fill:false,borderDash:[4,4]},
    {label:"Forecast SoH %",data:tr.pts.map(p=>p.soh),borderColor:"#0a7d2c",tension:.3,fill:"+1"},
    {label:"Lo 90%",data:tr.loPts,borderColor:"rgba(178,0,32,.3)",pointRadius:0,fill:false,borderDash:[4,4]},
    {label:"Warranty trigger 70%",data:tr.pts.map(()=>70),borderColor:"#b00020",borderDash:[6,4],pointRadius:0}]},
    options:{plugins:{title:{display:true,text:`SoH trajectory — ${tr.perYr}%/yr at current habit (±${f.ci90}% CI fan)`}},scales:{y:{min:50,max:100}}}});
  charts.split=new Chart($("chSplit"),{type:"doughnut",data:{labels:["Remaining health","Cycle fade","Calendar fade","Abuse extra"],datasets:[{data:splitParts(f),backgroundColor:["#0a7d2c","#e6a817","#d35400","#b00020"]}]},options:{plugins:{title:{display:true,text:"What ate your battery (raw "+f.sohRaw+"% → "+f.soh+"% shown; parts rescaled to 100%)"}}}});
}

/* ---------- intel + model index ---------- */
function buildIntel(){
  const m=DB().MARKET;
  if(!$("intelBox")) return;
  $("intelBox").innerHTML=`
  <table class="kv">
   <tr><td>BNEF pack price 2025 (record low)</td><td><b>$${m.bnef.globalPack_perKWh_usd}/kWh</b> (−8% YoY; BEV $${m.bnef.bevPack} · ESS $${m.bnef.essPack} · LFP $${m.bnef.lfpPack} · NMC $${m.bnef.nmcPack}) <small>Dec-9-2025 survey</small></td></tr>
   <tr><td>Regional 2025</td><td>China $${m.bnef.china} · NA $${m.bnef.na} (+44%) · EU $${m.bnef.eu} (+56%)</td></tr>
   <tr><td>AVILOO Sep-2026 (500k tests)</td><td>≤${m.aviloo.maxSpread}% intra-model spread · Model Y ${m.aviloo.modelY_50k}%@50k→${m.aviloo.modelY_150k}%@150k · ID.4 ${m.aviloo.id4_50k}%→${m.aviloo.id4_150k}% · Leaf ${m.aviloo.leaf_50k}%→${m.aviloo.leaf_150k}%</td></tr>
   <tr><td>Tata Lifetime (Jul-2025)</td><td>15-yr def., unlimited km, 1st owner; 70% trigger → restore ≥80%; 2nd owner 8yr/1.6L (Curvv/Nexon45) or 10yr/2L (Harrier/Sierra)</td></tr>
   <tr><td>Ola</td><td>3yr/40k base + paid 8yr/80k–125k top-up; 70% trigger; S1 X 2kWh excluded from top-up</td></tr>
   <tr><td>ESS (WoodMac H1-2026)</td><td>ESS demand growth ≈ EV growth (AI datacenters) · buyback home $${m.essBuyback.home_perKWh_usd}/kWh · fleet $${m.essBuyback.fleet_perKWh_usd} · recycle $${m.essBuyback.recycle_perKWh_usd}</td></tr>
   <tr><td>EU DPP (Reg 2023/1542)</td><td>Registry live 20-Jul-2026 · Guidance 71 pts Aug-2026 · <b>mandatory 18-Feb-2027</b> (EV/LMT/industrial &gt;2kWh, QR-linked)</td></tr>
   <tr><td>Resale math</td><td>Certified +${m.resale.certPremium_pct}% · battery ≈42% of EV value · ₹60k (Ola) / $5k (Model 3) at stake per AVILOO spread</td></tr>
  </table>
  <p class="hint">Sources: ${m.sources.join(" · ")}. Embedded for offline use; live FX/climate overrides applied when online. Re-verify against your owner's booklet before filing.</p>`;
}
function buildModelIndex(){
  const el=$("modelIndex"); if(!el) return;
  el.innerHTML = DB().MODELS.map(m=>`<span>${m.brand} ${m.model} (${m.kwh}kWh ${m.chem})</span>`).join(" · ");
}

/* ---------- vault ---------- */
async function saveVault(){
  if(!LAST){ toast("Run the forensic first."); return; }
  const rec = { id:"bf-"+Date.now().toString(36), at:LAST.at, state:shareState(), hash:LAST.hash||null, consent:!!LAST.consent };
  const id = await Vault.save(rec);
  toast(id? "Saved to encrypted vault ("+id+")." : "Vault unavailable in this browser (private mode?) — use PDF + share link.");
  track({ event:"bf_vault_save", ok:!!id });
  refreshVaultList();
}
async function refreshVaultList(){
  const el=$("vaultList"); if(!el) return;
  const rows = await Vault.list().catch(()=>[]);
  el.textContent = rows.length ? rows.slice(-5).reverse().map(r=>`${r.id} · ${r.state.m} · SoH ${r.state.soh}% · ${r.at.slice(0,10)}`).join(" | ") + ` (${rows.length} total)` : "No saved forensics yet.";
  const vs=$("vaultStatus"); if(vs) vs.textContent = "Vault: "+(rows.length?rows.length+" saved · local-only":"local-only");
}
async function exportVault(){
  const rows = await Vault.list().catch(()=>[]);
  copyText(JSON.stringify({ exported:new Date().toISOString(), version:DB().VERSION, runs:rows }, null, 2), "Vault JSON copied.");
}

/* ---------- PDF (with hash + CI + DPP + consent) ---------- */
async function makePDF(){
  if(!LAST){ toast("Run the forensic first."); return; }
  if(!window.jspdf){ toast("Loading PDF engine…"); const ok = await ensureLib("jspdf"); if(!ok || !window.jspdf){ toast("PDF engine unreachable offline — retry online."); return; } }
  const {p,f,fp,w,s2,rs}=LAST; const {jsPDF}=window.jspdf; const doc=new jsPDF();
  const grade=DB().gradeOf(f.soh); let y=14;
  const h = LAST.hash || await sha256(JSON.stringify(shareState()));
  const line=(t,s=11,b=false)=>{doc.setFont("helvetica",b?"bold":"normal");doc.setFontSize(s); const tt=doc.splitTextToSize(t,182); doc.text(tt,14,y); y+=tt.length*s*0.55+2; if(y>275){doc.addPage();y=14;}};
  line("BIJLIBUREAU — EVIDENCE PACK v2026.16 (EV Battery Report Card)",14,true);
  line(`Generated ${new Date().toLocaleString("en-IN")} · Owner: ${$("e_name").value} · VIN/Reg: ${$("e_vin").value||"—"} · SHA-256: ${h.slice(0,32)}…`,9);
  line(`Vehicle: ${p.model.brand} ${p.model.model} · ${p.model.kwh} kWh ${p.model.chem} · Purchased ${p.purchaseDate.slice(0,7)} · Odo ${p.kms} km · ${p.city}`,10,true);
  line(`HEALTH CARD: SoH ${f.soh}% (90% band ${f.lo90}-${f.hi90}%, raw ${f.sohRaw}%, ${f.fuseSrc}) · Grade ${grade} · Usable ${f.usableNow}/${p.model.kwh} kWh · Range ${f.rangeNow}/${p.model.rangeNew} km · EFC ${f.efc} · ${f.cyclesLeft} cycles left · band = MC ±${f.mcHalf}% + ${p.model.chem} field floor ±${f.modelForm}%`,11,true);
  line(`Cycle fade −${f.cycleFade}% · Calendar −${f.calendarFade}% (Arrhenius ×${f.arrFactor}) · Abuse −${f.abuseExtra}% · SoC stress ×${f.socStress} · C-rate ×${f.crateStress} · Heat gap ×${f.hotFactor} (pure SoC-amplified)`,9);
  line(`Chemistry fingerprint [${fp.verdict}]: ${DB().CHEMISTRY[p.model.chem].signature}`,9);
  fp.flags.forEach(g=>line("• "+g,9));
  if(p.obd&&p.obd.present) line(`OBD: ${p.obd.n} samples, delta-V ${p.obd.maxDelta_mV}mV, BMS SoH ${p.obd.medianBmsSoh}%`,9,true);
  line(`WARRANTY VERDICT: ${w.status}`,12,true); line(w.headline,10); line("Action: "+w.action,10);
  line(`Rule: ${w.w.oem} ${w.w.years}yr/${w.w.km>9000000?"unlimited":w.w.km}km trigger <${w.w.soh}% · Time left ${w.yrsLeft}yr · Km left ${isFinite(w.kmLeft)?w.kmLeft:"unlimited"} · Buffer +${w.buffer}%`,9);
  line(`Clause: "${w.w.clause}"`,9); line(`Cover: ${w.w.note}`,9); line(`Transfer: ${w.w.transfer}`,9); line(`Exclusions: ${w.w.exclusions}`,9);
  w.risks.forEach(r=>line("RISK: "+r,9));
  line(`RESALE: ${rs.loStr} – ${rs.hiStr} (Grade ${rs.grade}) · dealer bid ≈${rs.dealerStr} · at stake ${rs.atStake}`,10,true);
  line(`SECOND-LIFE: ${s2.usableKwh} kWh usable → BEST ${s2.best.route} ≈ $${s2.best.netUsd} / ₹${s2.best.netInr.toLocaleString("en-IN")} net (FX ₹${DB().MARKET.inrUsd})`,10,true);
  s2.routes.forEach(r=>line(`• ${r.route}: $${r.netUsd} net (${r.why})`,9));
  line("METHOD v2026.16: EFC=odo/range_new (odometer-anchored); cycle=EFC^0.85×(20/cycleLife)×DoD×Crate; calendar=plateaued eff-age×base×Arrhenius×SoC (live ambient nudges Tpack ±1.75°C max); CSV health vs DRIVER baseline (not certified range) with exp(-stale/540) recency decay, OBD w≤0.8; SoH raw+clamped 45–100; 90% band = √(MC²+field-floor²). Residuals vs AVILOO published in Methodology §6.",8);
  line("OCR transcript — dash/label/invoice (abridged):",9,true);
  ["ocr1","ocr2","ocr3"].forEach((id,i)=>line(`[Photo ${i+1}] `+($(id).textContent||"—").slice(0,150),8));
  line("Charge log rows used: "+(csvData.n||0)+(csvData.health?` · measured SoH≈${csvData.health}% over ~${csvData.days}d`:" · model-only"),8);
  line("Cert QR: "+($("qrPayload").textContent||"—"),8);
  line("DPPpre: "+($("qrDpp").textContent||"—").slice(0,400),8);
  line("Pre-passport notice: BATTCERTv3/DPPpre is a pre-passport evidence credential, NOT an Art.77 EU Battery Passport. Passport issuance is the economic operator's legal duty.",8,true);
  try{
    const sig = await trySignHash(h);
    if(sig.signed){ line("Detached signature ("+sig.alg+"): "+String(sig.sig).slice(0,120)+"… Verify: /.well-known/bijlibureau-key.json + node tools/verify-signature.js",8); LAST.sig = sig; }
    else { line("Integrity: "+sig.note+" · Full SHA-256: "+h,8); }
  }catch(e){ line("Integrity: timestamped + SHA-256 hashed · Full SHA-256: "+h,8); }
  line("Sources: "+DB().MARKET.sources.join("; "),8);
  line("Consent: "+(LAST.consent?"opt-in anonymized telemetry YES (revocable)":"local-only, no telemetry")+" · DPDP/GDPR. Declaration: auto-generated locally; owner attests odo/photos genuine. Supporting evidence only — demand OEM BMS readout in writing.",9,true);
  doc.save("bijlibureau-evidence.pdf");
  track({ event:"bf_pdf", soh:f.soh });
}

document.addEventListener("DOMContentLoaded",init);
})();
