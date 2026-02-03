// docs/static.js
// STATIC ROOM // THE WIRED
// SW触らない前提：このJS自体で「LOADING解除」「原因を画面表示」「強め砂嵐」「Lain文字フラッシュ」「local保存」までやる

(() => {
  const $ = (s) => document.querySelector(s);
  const diag = $("#diag");
  const hint = $("#uiHint");

  // ---- fail-safe: never stuck on LOADING ----
  const DIAG = (msg) => {
    try {
      if (diag) diag.textContent = msg;
      console.log("[STATIC]", msg);
    } catch {}
  };

  const showHint = (msg, ms = 900) => {
    if (!hint) return;
    hint.textContent = msg;
    hint.classList.add("on");
    setTimeout(() => hint.classList.remove("on"), ms);
  };

  // ここに来れている時点で「JSは読み込めてる」
  DIAG("STATIC JS LOADED…");

  // ---- elements ----
  const canvas = $("#staticCanvas");
  const blink = $("#blinkLayer");
  const shadowImg = $("#shadowImg");
  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  const vIntensity = $("#vIntensity");
  const vGlitch = $("#vGlitch");
  const aVol = $("#aVol");
  const aTone = $("#aTone");

  if (!canvas || !blink) {
    DIAG("ERR: canvas missing (#staticCanvas / #blinkLayer)");
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  const bctx = blink.getContext("2d", { alpha: true });

  // ---- state ----
  let enabled = false;
  let raf = 0;

  let intensity = 0.70; // 0..1
  let glitch = 0.38;    // 0..1
  let volume = 0.26;    // 0..1 (WiredAudio側に渡す)
  let tone = 0.36;      // 0..1 (WiredAudio側に渡す)
  let burst = 0;        // 0..1
  let uiOn = true;

  // ---- local trace storage (index側で読む想定) ----
  const TRACE_KEY = "wired_static_trace_v1";
  const TRACE_MAX = 80;

  function readTrace() {
    try { return JSON.parse(localStorage.getItem(TRACE_KEY) || "[]"); }
    catch { return []; }
  }
  function pushTrace(line) {
    try {
      const arr = readTrace();
      arr.unshift({ at: Date.now(), line });
      while (arr.length > TRACE_MAX) arr.pop();
      localStorage.setItem(TRACE_KEY, JSON.stringify(arr));
    } catch {}
  }

  // ---- Lain lines ----
  const LAIN_LINE = [
    "PRESENT TIME. PRESENT DAY.",
    "YOU ARE CONNECTED.",
    "DO NOT PANIC. OBSERVE.",
    "THE WIRED IS ALWAYS LISTENING.",
    "NO CARRIER // DREAMING",
    "LAYER 11 // RESIDUAL SIGNAL",
    "make me sad",
    "make me mad",
    "make me feel alright?"
  ];

  function pickLine() {
    return LAIN_LINE[(Math.random() * LAIN_LINE.length) | 0];
  }

  // ---- resize (CSS size -> drawing size) ----
  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    canvas.width = w;
    canvas.height = h;
    blink.width = w;
    blink.height = h;
  }
  resize();
  addEventListener("resize", resize, { passive: true });

  // ---- UI binds ----
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  function syncUI() {
    if (vIntensity) intensity = clamp01((Number(vIntensity.value) || 0) / 100);
    if (vGlitch) glitch = clamp01((Number(vGlitch.value) || 0) / 100);
    if (aVol) volume = clamp01((Number(aVol.value) || 0) / 100);
    if (aTone) tone = clamp01((Number(aTone.value) || 0) / 100);

    // Audioへ（存在すれば）
    try {
      window.WiredAudio?.set?.({ volume, tone });
    } catch {}
  }

  vIntensity?.addEventListener("input", syncUI, { passive: true });
  vGlitch?.addEventListener("input", syncUI, { passive: true });
  aVol?.addEventListener("input", syncUI, { passive: true });
  aTone?.addEventListener("input", syncUI, { passive: true });

  function toggleUI() {
    uiOn = !uiOn;
    document.body.classList.toggle("ui-off", !uiOn);
    if (btnUI) btnUI.textContent = uiOn ? "UI: ON" : "UI: OFF";
    showHint(uiOn ? "UI ON" : "UI OFF");
  }

  function start() {
    if (enabled) return;
    enabled = true;
    if (btnToggle) btnToggle.textContent = "STOP";
    DIAG("STATIC ONLINE");
    try { window.WiredAudio?.staticNoise?.(); } catch {}
    loop();
  }

  function stop() {
    enabled = false;
    if (btnToggle) btnToggle.textContent = "START";
    DIAG("STATIC STANDBY");
    if (raf) cancelAnimationFrame(raf);
  }

  function toggle() {
    enabled ? stop() : start();
  }

  function burstNow() {
    burst = clamp01(burst + 0.45);
    try { window.WiredAudio?.burst?.(); } catch {}
    const line = pickLine();
    flashLine(line);
    pushTrace(line);
  }

  function calm() {
    burst = 0;
    try { window.WiredAudio?.calm?.(); } catch {}
    showHint("CALM");
  }

  btnEnable?.addEventListener("click", () => {
    // iOS向け：ユーザー操作でAudio解錠
    window.WiredAudio?.start?.().catch?.(()=>{});
    showHint("AUDIO ENABLE");
  }, { passive: true });

  btnToggle?.addEventListener("click", toggle);
  btnBurst?.addEventListener("click", burstNow);
  btnCalm?.addEventListener("click", calm);
  btnUI?.addEventListener("click", toggleUI);

  // キーボード U でUI toggle
  addEventListener("keydown", (e) => {
    if ((e.key || "").toLowerCase() === "u") toggleUI();
    if (e.key === " "){ e.preventDefault(); burstNow(); }
  });

  // scrollでもちょいバースト（indexと同じ）
  addEventListener("scroll", () => {
    burst = clamp01(burst + 0.10);
  }, { passive: true });

  // ---- text flash (uses existing .scramble-pill nodes) ----
  const pills = Array.from(document.querySelectorAll("[data-scramble='1']"));

  function flashLine(line) {
    // 画面上部に一瞬
    showHint(line, 1100);

    // pillもランダムに差し替え（レイアウト崩さない）
    if (pills.length) {
      const p = pills[(Math.random() * pills.length) | 0];
      p.textContent = line;
    }
  }

  // ---- aggressive noise drawing (fast + strong) ----
  function rand(n) { return Math.random() * n; }

  function draw() {
    if (!enabled) return;

    const w = canvas.width, h = canvas.height;

    // base fade (残像)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 0, w, h);

    // noise density
    const baseDots = 2200 + (intensity * 6000);
    const extra = Math.floor(burst * 9000);
    const dots = baseDots + extra;

    // pixel noise
    for (let i = 0; i < dots; i++) {
      const x = (rand(w)) | 0;
      const y = (rand(h)) | 0;

      const a = 0.06 + rand(0.28) + burst * 0.35;
      // 白だけだと単調なので少し色ズレ
      const r = 200 + (rand(55) | 0);
      const g = 200 + (rand(55) | 0);
      const b = 200 + (rand(55) | 0);
      ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // horizontal tear
    if (Math.random() < (0.08 + glitch * 0.14 + burst * 0.18)) {
      const y = (rand(h)) | 0;
      const hh = 6 + (rand(28) | 0);
      const shift = ((rand(80) - 40) * (1 + burst)) | 0;
      try {
        const slice = ctx.getImageData(0, y, w, hh);
        ctx.putImageData(slice, shift, y);
      } catch {
        // getImageDataが遅い端末もあるので握りつぶす
      }
    }

    // blink mosaic
    if (Math.random() < (0.05 + burst * 0.25)) {
      blink.classList.add("on");
      bctx.clearRect(0, 0, w, h);
      bctx.globalAlpha = 0.15 + burst * 0.55;
      // ざっくり矩形モザイク
      for (let i = 0; i < 40 + burst * 120; i++) {
        const x = rand(w);
        const y = rand(h);
        const ww = 6 + rand(90);
        const hh = 6 + rand(60);
        bctx.fillStyle = `rgba(255,255,255,${(0.06 + rand(0.18)).toFixed(3)})`;
        bctx.fillRect(x, y, ww, hh);
      }
      setTimeout(() => {
        blink.classList.remove("on");
        bctx.clearRect(0, 0, w, h);
      }, 60 + rand(120));
    }

    // shadow apparition
    if (shadowImg) {
      const on = Math.random() < (0.02 + burst * 0.08 + glitch * 0.03);
      shadowImg.classList.toggle("on", on);
      if (on) {
        shadowImg.style.transform = `translate(${(rand(10) - 5).toFixed(1)}px, ${(rand(10) - 5).toFixed(1)}px)`;
      }
    }

    // random text event
    if (Math.random() < (0.010 + burst * 0.020)) {
      const line = pickLine();
      flashLine(line);
      pushTrace(line);
    }

    // decay
    burst = Math.max(0, burst - (0.010 + intensity * 0.008));
  }

  function loop() {
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ---- boot behavior ----
  // まず “止まって見える” を防ぐ：ここまで来たらREADYを出す
  syncUI();
  DIAG("STATIC READY // PRESS START");
  showHint("STATIC READY");

  // 自動起動はしない（事故防止）：
  // ただし「前はログイン完了イベントで起動」したいならこれ
  window.addEventListener("wired-user-ready", () => {
    DIAG("WIRED USER READY");
    start();
  });

  // iOS: タッチでAudioもついでに解錠
  const unlockOnce = () => {
    try { window.WiredAudio?.start?.(); } catch {}
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("touchstart", unlockOnce);
  };
  window.addEventListener("pointerdown", unlockOnce, { passive: true });
  window.addEventListener("touchstart", unlockOnce, { passive: true });

})();
