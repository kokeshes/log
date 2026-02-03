/* =========================================================
   STATIC ROOM // THE WIRED
   full replace static.js (stable + hard burst + ghost text)
========================================================= */

(() => {
  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn, opt) => { if (el) el.addEventListener(ev, fn, opt); };

  const loading = $("#loading");
  const statusEl = $("#statusText") || $("#status") || $("#diag");
  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };
  const hideLoading = () => { if (loading) loading.classList.add("hidden"); };

  // ---- canvas ----
  const canvas = $("#staticCanvas");
  const ctx = canvas?.getContext?.("2d", { alpha: false });
  const blinkCanvas = $("#blinkLayer");
  const bctx = blinkCanvas?.getContext?.("2d", { alpha: true });
  const shadowImg = $("#shadowImg");

  // ---- buttons (optional) ----
  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  // ---- state ----
  let enabled = false;
  let burst = 0;
  let uiOn = true;
  let rafId = 0;

  // ---- ghost text buffer ----
  const ghostChars = [];

  window.addEventListener("wired-text-fragment", (e) => {
    const ch = e?.detail?.text;
    if (!ch || ch.length !== 1) return;
    ghostChars.push({
      ch,
      x: Math.random(),
      y: Math.random(),
      life: 1
    });
    if (ghostChars.length > 120) ghostChars.shift();
  });

  function resize(){
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (canvas){ canvas.width = w; canvas.height = h; }
    if (blinkCanvas){ blinkCanvas.width = w; blinkCanvas.height = h; }
  }

  function rand(n){ return Math.random() * n; }

  function drawNoise(){
    if (!enabled || !ctx || !canvas) return;

    const w = canvas.width, h = canvas.height;

    // ---- soft static ----
    const count = 140 + Math.floor(burst * 240);
    for (let i = 0; i < count; i++){
      ctx.fillStyle = `rgba(255,255,255,${(0.04 + Math.random()*0.12 + burst*0.18).toFixed(3)})`;
      ctx.fillRect(rand(w), rand(h), 1 + rand(3), 1 + rand(3));
    }

    // ---- HARD STATIC (burst only) ----
    if (burst > 0.25){
      const hard = Math.floor(1800 * burst);
      for (let i = 0; i < hard; i++){
        ctx.fillStyle = Math.random() < 0.5
          ? `rgba(255,255,255,${0.2 + Math.random()*0.6})`
          : `rgba(0,0,0,${0.2 + Math.random()*0.6})`;
        ctx.fillRect(rand(w), rand(h), 1, 1);
      }
    }

    // ---- fade ----
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, w, h);

    // ---- blink layer ----
    if (bctx && blinkCanvas && Math.random() < (0.02 + burst * 0.08)){
      bctx.clearRect(0,0,w,h);
      bctx.fillStyle = `rgba(255,255,255,${0.15 + burst*0.3})`;
      bctx.fillRect(0,0,w,h);
      setTimeout(()=>bctx.clearRect(0,0,w,h), 40 + rand(80));
    }

    // ---- shadow apparition ----
    if (shadowImg){
      shadowImg.style.opacity =
        Math.random() < (0.01 + burst*0.05) ? "0.12" : "0";
    }

    // ---- ghost text ----
    ctx.font = "12px monospace";
    ctx.textBaseline = "top";
    for (const g of ghostChars){
      ctx.fillStyle = `rgba(180,255,200,${(g.life*0.6).toFixed(3)})`;
      ctx.fillText(
        g.ch,
        g.x * w + Math.random()*2,
        g.y * h + Math.random()*2
      );
      g.life -= 0.01 + Math.random()*0.01;
    }

    burst = Math.max(0, burst - 0.012);
  }

  function loop(){
    drawNoise();
    rafId = requestAnimationFrame(loop);
  }

  function start(){
    if (enabled) return;
    enabled = true;
    setStatus("STATIC // ONLINE");
    try{ window.WiredAudio?.staticNoise?.(); }catch{}
  }

  function stop(){
    enabled = false;
    setStatus("STATIC // STANDBY");
  }

  function toggle(){ enabled ? stop() : start(); }
  function burstNow(){ burst = Math.min(1, burst + 0.4); }
  function calm(){ burst = 0; }
  function toggleUI(){
    uiOn = !uiOn;
    document.documentElement.classList.toggle("ui-off", !uiOn);
  }

  // ---- init (never freeze) ----
  (async () => {
    try{
      resize();
      on(window,"resize",resize,{passive:true});
      on(window,"scroll",()=>{ burst=Math.min(1,burst+0.08); },{passive:true});

      on(btnEnable,"pointerdown",start,{passive:true});
      on(btnToggle,"pointerdown",toggle,{passive:true});
      on(btnBurst,"pointerdown",burstNow,{passive:true});
      on(btnCalm,"pointerdown",calm,{passive:true});
      on(btnUI,"pointerdown",toggleUI,{passive:true});

      if (!rafId) loop();
      setStatus("LOADED // STATIC READY");
    }catch(e){
      console.error(e);
      setStatus("STATIC ERROR");
    }finally{
      hideLoading();
    }
  })();
})();
