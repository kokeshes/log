/* =========================================================
   STATIC ROOM // THE WIRED
   full replace static.js (stable + UI scramble + louder audio)
========================================================= */
/* =========================================================
   STATIC ROOM // THE WIRED
   static.js (full replace) — always-render + iOS audio unlock
========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn, opt) => { if (el) el.addEventListener(ev, fn, opt); };

  /* ---------- DOM ---------- */
  const badge     = $("#diag");
  const uiHint    = $("#uiHint");

  const canvas    = $("#staticCanvas");
  const ctx       = canvas?.getContext?.("2d", { alpha: false });

  const blinkCv   = $("#blinkLayer");
  const bctx      = blinkCv?.getContext?.("2d", { alpha: true });

  const shadowImg = $("#shadowImg");

  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  const vIntensity = $("#vIntensity");
  const vGlitch    = $("#vGlitch");
  const aVol       = $("#aVol");
  const aTone      = $("#aTone");

  if (!canvas || !ctx) {
    console.error("[STATIC] staticCanvas missing / ctx failed");
    if (badge) badge.textContent = "ERR // staticCanvas missing";
    return;
  }

  /* ---------- helpers ---------- */
  const Timeout = (fn, ms) => window.setTimeout(fn, ms);

  function logDiag(msg){
    try{
      if (badge) badge.textContent = msg;
      console.log("[STATIC]", msg);
    }catch{}
  }

  function hintOnce(){
    if (!uiHint) return;
    uiHint.classList.add("on");
    Timeout(()=> uiHint.classList.remove("on"), 650);
  }

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  /* ---------- UI toggle ---------- */
  const UI_KEY = "wired_static_ui_off_v1";
  function getUIOff(){
    try{ return localStorage.getItem(UI_KEY) === "1"; }catch{ return false; }
  }
  function setUIOff(off, showHint=false){
    // ✅ static.html のCSSは body.ui-off を見てるので body に付ける
    document.body.classList.toggle("ui-off", !!off);
    try{ localStorage.setItem(UI_KEY, off ? "1" : "0"); }catch{}
    if (btnUI) btnUI.textContent = off ? "UI: OFF" : "UI: ON";
    if (showHint) hintOnce();
  }
  setUIOff(getUIOff(), false);

  on(btnUI, "click", ()=> setUIOff(!document.body.classList.contains("ui-off"), true));
  on(btnUI, "pointerdown", ()=> setUIOff(!document.body.classList.contains("ui-off"), true), { passive:true });

  /* ---------- rendering state ---------- */
  let running = true;     // ✅ 起動時から必ず砂嵐が出る
  let burst = 0;          // 0..1
  let raf = 0;

  /* ---------- resize (DPR aware) ---------- */
  function resize(){
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);

    // size in CSS pixels
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    if (blinkCv){
      blinkCv.style.width = w + "px";
      blinkCv.style.height = h + "px";
      blinkCv.width  = Math.floor(w * dpr);
      blinkCv.height = Math.floor(h * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bctx) bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  on(window, "resize", resize, { passive:true });

  /* ---------- audio unlock (iOS safe) ---------- */
  let audioUnlocked = false;
  function readAudioSlider(){
    const vol  = Number(aVol?.value ?? 26) / 100;
    const tone = Number(aTone?.value ?? 36) / 100;
    return { vol, tone };
  }

  function applyAudioParams(){
    // audio.js 側が対応してたら反映（無くてもOK）
    const { vol, tone } = readAudioSlider();
    try{ window.WiredAudio?.setStaticParams?.({ vol, tone }); }catch{}
  }
  on(aVol, "input", applyAudioParams, { passive:true });
  on(aTone, "input", applyAudioParams, { passive:true });

  function unlockAudioOnce(){
    if (audioUnlocked) return;
    audioUnlocked = true;

    try{
      // ✅ “ユーザー操作”中に呼ぶのが重要
      window.WiredAudio?.staticNoise?.();
      applyAudioParams();
      if (btnEnable) btnEnable.textContent = "AUDIO READY";
      logDiag("AUDIO UNLOCKED // HISS READY");
    }catch(e){
      console.warn("[STATIC] unlockAudio failed", e);
      audioUnlocked = false;
      logDiag("AUDIO LOCKED // TAP AGAIN");
    }
  }

  // 画面どこでも1回タップで解除（ボタンに依存しない）
  on(window, "pointerdown", unlockAudioOnce, { passive:true });
  on(window, "touchstart",  unlockAudioOnce, { passive:true });
  on(btnEnable, "click", unlockAudioOnce);
  on(btnEnable, "pointerdown", unlockAudioOnce, { passive:true });

  /* ---------- controls ---------- */
  function updateStartButton(){
    if (!btnToggle) return;
    btnToggle.textContent = running ? "STOP" : "START";
  }

  function start(){
    running = true;
    updateStartButton();
    logDiag("STATIC // ONLINE");
    // 音はタップ解除されていれば鳴る
    try{ window.WiredAudio?.staticNoise?.(); }catch{}
  }
  function stop(){
    running = false;
    updateStartButton();
    logDiag("STATIC // STANDBY");
  }
  function toggle(){
    running ? stop() : start();
  }
  function burstNow(){
    burst = clamp01(burst + 0.38);
    try{ window.WiredAudio?.burst?.(); }catch{}
  }
  function calm(){
    burst = 0;
    try{ window.WiredAudio?.calm?.(); }catch{}
  }

  on(btnToggle, "click", toggle);
  on(btnToggle, "pointerdown", toggle, { passive:true });
  on(btnBurst, "click", burstNow);
  on(btnBurst, "pointerdown", burstNow, { passive:true });
  on(btnCalm, "click", calm);
  on(btnCalm, "pointerdown", calm, { passive:true });

  // scroll boosts burst
  on(window, "scroll", ()=> { burst = clamp01(burst + 0.10); }, { passive:true });

  // keyboard U for UI
  on(window, "keydown", (e)=>{
    if ((e.key || "").toLowerCase() === "u"){
      setUIOff(!document.body.classList.contains("ui-off"), true);
    }
  });

  /* ---------- main loop ---------- */
  function loop(){
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);

    const intensity = clamp01(Number(vIntensity?.value ?? 70) / 100);
    const glitchAmt = clamp01(Number(vGlitch?.value ?? 38) / 100);

    // ✅ running=false でも「完全停止」ではなく暗転して“砂嵐が消えた感”を出す
    const live = running ? 1 : 0;
    const liveIntensity = intensity * (0.10 + 0.90 * live);

    // fade
    ctx.fillStyle = `rgba(0,0,0,${(0.18 + (1-live)*0.25).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);

    // speckles
    const speck = Math.floor(120 + liveIntensity * 520 + burst * 520);
    for (let i=0; i<speck; i++){
      const x = Math.random() * w;
      const y = Math.random() * h;
      const sz = 1 + Math.random() * (2 + liveIntensity*2);
      const a  = (0.03 + Math.random()*0.12) * (0.35 + liveIntensity) + burst*0.25;
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(x, y, sz, sz);
    }

    // glitch lines
    if (Math.random() < (0.04 + glitchAmt*0.10 + burst*0.10) * (0.30 + liveIntensity)){
      const y = Math.random()*h;
      const hh = 1 + Math.random()*3;
      const a = 0.06 + Math.random()*0.18 + burst*0.25;
      ctx.fillStyle = `rgba(120,255,170,${a.toFixed(3)})`;
      ctx.fillRect(0, y, w, hh);
    }

    // blink layer
    if (bctx && blinkCv){
      if (Math.random() < (0.02 + burst*0.10) * (0.25 + liveIntensity)){
        bctx.clearRect(0,0,w,h);
        bctx.fillStyle = `rgba(255,255,255,${(0.10 + burst*0.30).toFixed(3)})`;
        bctx.fillRect(0,0,w,h);
        Timeout(()=> bctx.clearRect(0,0,w,h), 40 + Math.random()*90);
      }
    }

    // shadow apparition
    if (shadowImg){
      const p = (0.010 + burst*0.07) * (0.30 + liveIntensity);
      shadowImg.classList.toggle("on", Math.random() < p);
    }

    // decay
    burst = Math.max(0, burst - 0.012);

    raf = requestAnimationFrame(loop);
  }

  // start
  updateStartButton();
  logDiag("LOADED // STATIC READY (AUTO)");
  raf = requestAnimationFrame(loop);
})();
