// docs/static.js
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const canvas = $("#staticCanvas");
  const ctx = canvas?.getContext("2d", { alpha:false });
  const blinkCanvas = $("#blinkLayer");
  const bctx = blinkCanvas?.getContext("2d", { alpha:true });
  const shadowImg = $("#shadowImg");
  const diag = $("#diag");

  const pills = $$('[data-scramble="1"]');

  let enabled = false;
  let burst = 0;
  let raf = 0;

  /* =========================
     CONFIG
     ========================= */
  const LAIN_LINES = [
    "PRESENT TIME. PRESENT DAY.",
    "YOU ARE CONNECTED.",
    "THE WIRED IS LISTENING.",
    "NO CARRIER.",
    "DO NOT PANIC.",
    "OBSERVE.",
    "MEMORY IS NOT LOCAL.",
    "SIGNAL LOST // TRACE REMAINS",
    "HELLO, GOD.",
    "I AM HERE.",
    // added
    "make me sad",
    "make me mad",
    "make me feel alright?",
  ];

  const TRACE_KEY = "wired_static_trace";

  /* =========================
     CANVAS
     ========================= */
  function resize(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas){ canvas.width = w; canvas.height = h; }
    if (blinkCanvas){ blinkCanvas.width = w; blinkCanvas.height = h; }
  }

  function drawNoise(){
    if (!enabled || !ctx) return;

    const w = canvas.width, h = canvas.height;
    const dots = 900 + burst * 2200;

    for (let i=0;i<dots;i++){
      const x = Math.random()*w;
      const y = Math.random()*h;
      const a = 0.04 + Math.random()*0.25 + burst*0.4;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x,y,1,1);
    }

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0,0,w,h);

    // blink
    if (bctx && Math.random() < 0.06 + burst*0.25){
      bctx.fillStyle = "rgba(255,255,255,0.35)";
      bctx.fillRect(0,0,w,h);
      setTimeout(()=>bctx.clearRect(0,0,w,h),80);
    }

    // shadow
    if (shadowImg){
      shadowImg.classList.toggle("on", Math.random() < (0.02 + burst*0.08));
    }

    burst = Math.max(0, burst - 0.015);
  }

  function loop(){
    drawNoise();
    raf = requestAnimationFrame(loop);
  }

  /* =========================
     LAIN TEXT BURST
     ========================= */
  function emitLain(){
    const text = LAIN_LINES[(Math.random()*LAIN_LINES.length)|0];

    // pick a pill
    const pill = pills[(Math.random()*pills.length)|0];
    if (!pill) return;

    pill.textContent = text;
    pill.style.opacity = "1";

    setTimeout(()=>{ pill.style.opacity = ""; }, 420);

    saveTrace(text);
  }

  function saveTrace(text){
    try{
      const now = new Date().toISOString();
      const item = { text, at: now };

      const raw = localStorage.getItem(TRACE_KEY);
      const list = raw ? JSON.parse(raw) : [];

      list.unshift(item);
      localStorage.setItem(TRACE_KEY, JSON.stringify(list.slice(0,50)));
    }catch(e){
      console.warn("[STATIC] trace save failed", e);
    }
  }

  /* =========================
     CONTROL
     ========================= */
  function start(){
    if (enabled) return;
    enabled = true;
    resize();
    loop();
    diag && (diag.textContent = "STATIC ONLINE");
    try{ window.WiredAudio?.staticNoise?.(); }catch{}
  }

  function burstNow(){
    burst = Math.min(1, burst + 0.45);
    emitLain();
    try{ window.WiredAudio?.burst?.(); }catch{}
  }

  /* =========================
     EVENTS
     ========================= */
  window.addEventListener("wired-user-ready", start);
  window.addEventListener("resize", resize);

  window.addEventListener("scroll", ()=>{
    burst = Math.min(1, burst + 0.08);
  }, { passive:true });

  $("#btnBurst")?.addEventListener("click", burstNow);
  $("#btnToggle")?.addEventListener("click", start);

  // random apparition
  setInterval(()=>{
    if (!enabled) return;
    if (Math.random() < 0.12){
      burst = Math.min(1, burst + 0.25);
      emitLain();
    }
  }, 2200);
})();
