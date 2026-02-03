// docs/static.js
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $("#staticCanvas");
  const blink = $("#blinkLayer");
  const shadowImg = $("#shadowImg");
  const diag = $("#diag");

  const ctx = canvas?.getContext?.("2d", { alpha: false });
  const bctx = blink?.getContext?.("2d", { alpha: true });

  // buttons
  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  // sliders
  const vIntensity = $("#vIntensity");
  const vGlitch = $("#vGlitch");
  const aVol = $("#aVol");
  const aTone = $("#aTone");

  const DIAG = (t) => { if (diag) diag.textContent = t; };

  if (!canvas || !blink || !ctx) {
    console.warn("[STATIC] missing canvas elements");
    DIAG("ERR // MISSING CANVAS");
    return;
  }

  /* =========================
     TRACE (localStorage only)
  ========================= */
  const TRACE_KEY = "wired_trace_v1";
  function pushTrace(type, payload) {
    try {
      const list = JSON.parse(localStorage.getItem(TRACE_KEY) || "[]");
      list.push({ type, payload, at: Date.now() });
      // keep last 120
      if (list.length > 120) list.splice(0, list.length - 120);
      localStorage.setItem(TRACE_KEY, JSON.stringify(list));
    } catch {}
  }

  /* =========================
     STATE
  ========================= */
  let enabled = false;
  let raf = 0;

  let intensity = 0.7; // 0..1
  let glitch = 0.38;   // 0..1
  let volume = 0.26;   // 0..1
  let tone = 0.36;     // 0..1

  let burst = 0;       // 0..1
  let uiOn = true;

  /* =========================
     RESIZE
  ========================= */
  function resize() {
    const w = Math.max(1, innerWidth);
    const h = Math.max(1, innerHeight);
    canvas.width = w;
    canvas.height = h;
    blink.width = w;
    blink.height = h;
  }
  resize();
  addEventListener("resize", resize, { passive: true });

  /* =========================
     LAIN LINES (CANVAS, dissolving)
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
    "make me feel alright",
  ];

  // store a few floating lines so they fade out (not fixed forever)
  const floating = [];
  function spawnLine(line) {
    const w = canvas.width, h = canvas.height;
    floating.push({
      line,
      x: Math.random() * w,
      y: Math.random() * h,
      a: 0.55 + Math.random() * 0.25, // alpha
      life: 22 + (Math.random() * 18 | 0), // frames
      jitter: 0.8 + Math.random() * 1.6,
    });
    // TRACE
    pushTrace("LAIN_LINE", line);
  }

  function maybeSpawnLine() {
    // base probability + boosted by burst/glitch
    const p = 0.008 + burst * 0.06 + glitch * 0.018;
    if (Math.random() < p) {
      const line = LAIN_LINE[(Math.random() * LAIN_LINE.length) | 0];
      spawnLine(line);
    }
  }

  function drawLines() {
    if (!floating.length) return;
    ctx.save();
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.shadowColor = "rgba(120,255,220,.35)";
    ctx.shadowBlur = 10;

    for (let i = floating.length - 1; i >= 0; i--) {
      const f = floating[i];
      const jx = (Math.random() * 2 - 1) * f.jitter;
      const jy = (Math.random() * 2 - 1) * f.jitter;

      ctx.fillStyle = `rgba(180,255,220,${Math.max(0, f.a)})`;
      ctx.fillText(f.line, f.x + jx, f.y + jy);

      // decay
      f.life -= 1;
      f.a *= 0.92;
      f.jitter *= 0.98;

      if (f.life <= 0 || f.a < 0.02) floating.splice(i, 1);
    }
    ctx.restore();
  }

  /* =========================
     TEXT SCRAMBLE (DOM)
  ========================= */
  const SCRAMBLE_CHARS = "▓▒░█#@$%&*+-=/\\<>";

  // cache originals; also refresh originals if DOM text changes later
  const scrambleTargets = $$(
    ".wired-scramble,[data-ui-scramble='1'],[data-scramble='1']"
  ).map(el => ({
    el,
    get original() { return el.dataset._orig ?? (el.dataset._orig = el.textContent); }
  }));

  function scrambleOnce(target) {
    const el = target.el;
    const original = target.original || "";
    const len = original.length || 1;

    let scrambled = "";
    for (let i = 0; i < len; i++) {
      scrambled += SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
    }

    el.textContent = scrambled;
    setTimeout(() => { el.textContent = original; }, 40 + Math.random() * 90);
  }

  function randomScramble() {
    // frequency
    const p = 0.12 + glitch * 0.28 + burst * 0.25;
    if (Math.random() > p) return;
    const t = scrambleTargets[(Math.random() * scrambleTargets.length) | 0];
    if (t) scrambleOnce(t);
  }

  /* =========================
     AUDIO / UI sync
  ========================= */
  function syncUI() {
    if (vIntensity) intensity = vIntensity.value / 100;
    if (vGlitch) glitch = vGlitch.value / 100;
    if (aVol) volume = aVol.value / 100;
    if (aTone) tone = aTone.value / 100;

    try { window.WiredAudio?.set?.({ volume, tone }); } catch {}
  }

  vIntensity?.addEventListener("input", syncUI);
  vGlitch?.addEventListener("input", syncUI);
  aVol?.addEventListener("input", syncUI);
  aTone?.addEventListener("input", syncUI);

  function setUI(on) {
    uiOn = !!on;
    document.body.classList.toggle("ui-off", !uiOn);
    if (btnUI) btnUI.textContent = uiOn ? "UI: ON" : "UI: OFF";
  }

  // iOS: pointerdown を優先（UIが消える事故回避）
  const press = (el, fn) => {
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    }, { passive: false });
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    }, { passive: false });
  };

  /* =========================
     CONTROL
  ========================= */
  function start() {
    if (enabled) return;
    enabled = true;
    if (btnToggle) btnToggle.textContent = "STOP";
    DIAG("STATIC ONLINE");
    loop();
  }

  function stop() {
    enabled = false;
    if (btnToggle) btnToggle.textContent = "START";
    cancelAnimationFrame(raf);
    DIAG("STATIC STANDBY");
  }

  function toggle() { enabled ? stop() : start(); }

  function burstNow() {
    burst = Math.min(1, burst + 0.55);
    try { window.WiredAudio?.burst?.(); } catch {}

    // spawn multiple lines on burst
    for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) {
      const line = LAIN_LINE[(Math.random() * LAIN_LINE.length) | 0];
      spawnLine(line);
    }
  }

  function calm() {
    burst = 0;
    try { window.WiredAudio?.calm?.(); } catch {}
  }

  press(btnToggle, toggle);
  press(btnBurst, burstNow);
  press(btnCalm, calm);
  press(btnUI, () => setUI(!uiOn));

  // ENABLE AUDIO: UIを絶対消さない + diag に表示
  press(btnEnable, async () => {
    try {
      if (!window.WiredAudio) {
        DIAG("AUDIO MISSING // load audio.js");
        return;
      }
      DIAG("AUDIO UNLOCK…");
      await window.WiredAudio.start?.();
      await window.WiredAudio.staticNoise?.();
      syncUI();
      setUI(true);
      DIAG("AUDIO OK");
      pushTrace("AUDIO", "UNLOCK");
    } catch (e) {
      setUI(true);
      DIAG("AUDIO ERR // " + (e?.message || e));
      console.warn(e);
    }
  });

  /* =========================
     DRAW
  ========================= */
  function draw() {
    if (!enabled) return;

    const w = canvas.width, h = canvas.height;

    // trailing fade (keeps flicker alive)
    ctx.fillStyle = `rgba(0,0,0,${0.18 + (1 - intensity) * 0.18})`;
    ctx.fillRect(0, 0, w, h);

    // heavy noise dots
    const dots = 2400 + intensity * 7200 + burst * 8200;
    for (let i = 0; i < dots; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const a = 0.03 + Math.random() * 0.22 + burst * 0.38;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // occasional "tears" (cheap slices)
    if (Math.random() < 0.06 + burst * 0.14 + glitch * 0.08) {
      const y = (Math.random() * h) | 0;
      const hh = (6 + Math.random() * 22) | 0;
      const sx = ((Math.random() * 36 - 18) | 0);
      try {
        const slice = ctx.getImageData(0, y, w, hh);
        ctx.putImageData(slice, sx, y);
      } catch {}
    }

    // blink flash layer
    if (bctx && Math.random() < 0.04 + burst * 0.14) {
      blink.classList.add("on");
      setTimeout(() => blink.classList.remove("on"), 50 + (Math.random() * 70 | 0));
    }

    // shadow apparition
    if (shadowImg) {
      shadowImg.classList.toggle("on", Math.random() < 0.015 + burst * 0.07 + glitch * 0.03);
    }

    // lines + scramble
    maybeSpawnLine();
    drawLines();
    randomScramble();

    // decay burst
    burst = Math.max(0, burst - 0.010);
  }

  function loop() {
    draw();
    raf = requestAnimationFrame(loop);
  }

  // init
  DIAG("STATIC READY // ENABLE AUDIO");
  syncUI();
  setUI(true);

  // keep your original behavior: start after login (event)
  addEventListener("wired-user-ready", start);

  // iOS: resume audio on return
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    try { await window.WiredAudio?.start?.(); } catch {}
  });
})();
