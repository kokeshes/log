// docs/static.js
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $("#staticCanvas");
  const blink = $("#blinkLayer");
  const shadowImg = $("#shadowImg");
  const diag = $("#diag");
  const hint = $("#uiHint");

  const ctx = canvas.getContext("2d", { alpha:false });
  const bctx = blink.getContext("2d", { alpha:true });

  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  const vIntensity = $("#vIntensity");
  const vGlitch = $("#vGlitch");
  const aVol = $("#aVol");
  const aTone = $("#aTone");

  const DIAG = (t)=>{ if(diag) diag.textContent=t; };

  /* =========================
     STATE
  ========================= */
  let enabled = false;
  let raf = 0;

  let intensity = 0.7;
  let glitch = 0.38;
  let volume = 0.26;
  let tone = 0.36;

  let burst = 0;
  let uiOn = true;

  /* =========================
     RESIZE
  ========================= */
  function resize(){
    const w = innerWidth;
    const h = innerHeight;
    canvas.width = w;
    canvas.height = h;
    blink.width = w;
    blink.height = h;
  }
  resize();
  addEventListener("resize", resize, { passive:true });

  /* =========================
     LAIN LINES (CANVAS)
  ========================= */
  const LAIN_LINE = [
    "PRESENT TIME. PRESENT DAY.",
    "YOU ARE CONNECTED.",
    "DO NOT PANIC. OBSERVE.",
    "THE WIRED IS ALWAYS LISTENING.",
    "NO CARRIER // DREAMING",
    "LAYER 11 // RESIDUAL SIGNAL",
    "make me sad",
    "make me mad",
    "make me feel alright"
  ];

  function drawLainLine(){
    const line = LAIN_LINE[(Math.random()*LAIN_LINE.length)|0];
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;

    ctx.save();
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = `rgba(180,255,220,${0.18 + Math.random()*0.22})`;
    ctx.shadowColor = "rgba(120,255,220,.35)";
    ctx.shadowBlur = 8;
    ctx.fillText(line, x, y);
    ctx.restore();
  }

  /* =========================
     TEXT SCRAMBLE (DOM)
  ========================= */
  const SCRAMBLE_CHARS = "▓▒░█#@$%&*+-=/\\<>";

  const scrambleTargets = $$(
    ".wired-scramble,[data-ui-scramble='1'],[data-scramble='1']"
  ).map(el => ({
    el,
    original: el.textContent
  }));

  function scrambleOnce(target){
    const { el, original } = target;
    const len = original.length;
    let scrambled = "";
    for(let i=0;i<len;i++){
      scrambled += SCRAMBLE_CHARS[(Math.random()*SCRAMBLE_CHARS.length)|0];
    }
    el.textContent = scrambled;
    setTimeout(()=>{ el.textContent = original; }, 40 + Math.random()*80);
  }

  function randomScramble(){
    if(Math.random() < 0.35){
      const t = scrambleTargets[(Math.random()*scrambleTargets.length)|0];
      if(t) scrambleOnce(t);
    }
  }

  /* =========================
     AUDIO / UI
  ========================= */
  function syncUI(){
    if(vIntensity) intensity = vIntensity.value/100;
    if(vGlitch) glitch = vGlitch.value/100;
    if(aVol) volume = aVol.value/100;
    if(aTone) tone = aTone.value/100;
    try{ window.WiredAudio?.set?.({ volume, tone }); }catch{}
  }

  vIntensity?.addEventListener("input", syncUI);
  vGlitch?.addEventListener("input", syncUI);
  aVol?.addEventListener("input", syncUI);
  aTone?.addEventListener("input", syncUI);

  function start(){
    if(enabled) return;
    enabled = true;
    btnToggle && (btnToggle.textContent="STOP");
    DIAG("STATIC ONLINE");
    loop();
  }

  function stop(){
    enabled=false;
    btnToggle && (btnToggle.textContent="START");
    cancelAnimationFrame(raf);
    DIAG("STATIC STANDBY");
  }

  function toggle(){ enabled ? stop() : start(); }

  function burstNow(){
    burst = Math.min(1, burst+0.45);
    try{ window.WiredAudio?.burst?.(); }catch{}
    drawLainLine();
  }

  function calm(){
    burst = 0;
    try{ window.WiredAudio?.calm?.(); }catch{}
  }

  btnToggle?.addEventListener("click", toggle);
  btnBurst?.addEventListener("click", burstNow);
  btnCalm?.addEventListener("click", calm);
  btnUI?.addEventListener("click", ()=>{
    uiOn=!uiOn;
    document.body.classList.toggle("ui-off",!uiOn);
  });

  btnEnable?.addEventListener("click", async ()=>{
    try{
      await window.WiredAudio?.start?.();
      await window.WiredAudio?.staticNoise?.();
      DIAG("AUDIO OK");
    }catch(e){
      DIAG("AUDIO ERR");
    }
  });

  /* =========================
     DRAW LOOP
  ========================= */
  function draw(){
    if(!enabled) return;

    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0,0,w,h);

    const dots = 1800 + intensity*5200 + burst*6000;
    for(let i=0;i<dots;i++){
      const x = Math.random()*w;
      const y = Math.random()*h;
      const a = 0.04 + Math.random()*0.28 + burst*0.35;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x,y,1,1);
    }

    if(Math.random() < 0.02 + burst*0.12){
      drawLainLine();
    }

    if(Math.random() < 0.25){
      randomScramble();
    }

    if(Math.random() < 0.05){
      blink.classList.add("on");
      setTimeout(()=>blink.classList.remove("on"),60);
    }

    if(shadowImg){
      shadowImg.classList.toggle("on", Math.random() < 0.03 + burst*0.08);
    }

    burst = Math.max(0, burst - 0.012);
  }

  function loop(){
    draw();
    raf = requestAnimationFrame(loop);
  }

  DIAG("STATIC READY // ENABLE AUDIO");
  syncUI();

  addEventListener("wired-user-ready", start);

  /* mobile unlock safety */
  const unlockOnce = ()=>{ try{ window.WiredAudio?.start?.(); }catch{} };
  addEventListener("pointerdown", unlockOnce, { once:true, passive:true });
  addEventListener("touchstart", unlockOnce, { once:true, passive:true });
})();
