// docs/static.js
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $("#staticCanvas");
  const blink = $("#blinkLayer");
  const shadowImg = $("#shadowImg");
  const diag = $("#diag");

  const ctx = canvas.getContext("2d", { alpha:false });
  const bctx = blink.getContext("2d", { alpha:true }); // bctxは今は未使用だけど残す

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
     TEXT SCRAMBLE (DOM)  ✅SAFE
     - 絶対に label/button など “コンテナ” を textContent で潰さない
     - data-ui-scramble / data-scramble のテキスト専用ノードだけ触る
  ========================= */
  const SCRAMBLE_CHARS = "▓▒░█#@$%&*+-=/\\<>";

  // 対象: data-ui-scramble / data-scramble のみ（.wired-scramble は触らない）
  // さらに form/control 系は除外（念のため）
  const BLOCK_TAG = /^(INPUT|TEXTAREA|SELECT|BUTTON|A|LABEL)$/i;

  function buildScrambleTargets(){
    const els = $$("[data-ui-scramble='1'],[data-scramble='1']")
      .filter(el => !BLOCK_TAG.test(el.tagName));

    return els.map(el => {
      // 初回だけオリジナルを保存（あとで戻す用）
      if (el.dataset.__origText == null) {
        el.dataset.__origText = el.textContent ?? "";
      }
      return { el };
    });
  }

  function scrambleOnce(target){
    const el = target.el;
    const original = el.dataset.__origText ?? (el.textContent ?? "");
    const len = original.length;

    // 空や短すぎるものはスキップ（無駄にチカチカしない）
    if (len <= 0) return;

    let scrambled = "";
    for(let i=0;i<len;i++){
      scrambled += SCRAMBLE_CHARS[(Math.random()*SCRAMBLE_CHARS.length)|0];
    }

    el.textContent = scrambled;

    // すぐ戻す
    setTimeout(() => {
      // origが変わってる可能性もあるので dataset を優先
      el.textContent = (el.dataset.__origText ?? original);
    }, 40 + Math.random()*80);
  }

  function randomScramble(){
    if (Math.random() < 0.35){
      const targets = buildScrambleTargets();
      if (!targets.length) return;
      const t = targets[(Math.random()*targets.length)|0];
      if (t) scrambleOnce(t);
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

  function setUI(on){
    uiOn = !!on;
    document.body.classList.toggle("ui-off", !uiOn);
    if(btnUI) btnUI.textContent = uiOn ? "UI: ON" : "UI: OFF";
  }

  btnToggle?.addEventListener("click", toggle);
  btnBurst?.addEventListener("click", burstNow);
  btnCalm?.addEventListener("click", calm);

  btnUI?.addEventListener("click", () => setUI(!uiOn));

  // iOSで click が遅延/スクロール扱いされるのを避ける
  const press = (el, fn) => {
    if(!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    }, { passive:false });
  };

  // ENABLE AUDIO: 絶対にUIをOFFにしない / 状態をdiagに出す
  press(btnEnable, async () => {
    try{
      if(!window.WiredAudio){
        DIAG("AUDIO MISSING // load audio.js in static.html");
        return;
      }
      DIAG("AUDIO UNLOCK…");
      await window.WiredAudio.start?.();

      await window.WiredAudio.staticNoise?.();

      syncUI();

      // UIは絶対ONに戻す（事故防止）
      setUI(true);

      let st = "OK";
      try{
        const ac = window.WiredAudio.__ac;
        if(ac) st = ac.state;
      }catch{}
      DIAG("AUDIO OK // " + st);
    }catch(e){
      setUI(true);
      DIAG("AUDIO ERR // " + (e?.message || e));
      try{ console.warn(e); }catch{}
    }
  });

  press(btnToggle, () => toggle());
  press(btnBurst, () => burstNow());
  press(btnCalm, () => calm());
  press(btnUI, () => setUI(!uiOn));

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
  setUI(true);

  // ログイン後に起動（いままで通り）
  addEventListener("wired-user-ready", start);

  // 画面復帰で音が止まる対策（iOS）
  document.addEventListener("visibilitychange", async () => {
    if(document.visibilityState !== "visible") return;
    try{
      await window.WiredAudio?.start?.();
    }catch{}
  });
})();
