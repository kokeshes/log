/* =========================================================
   STATIC ROOM // THE WIRED
   full replace static.js (stable + UI scramble + louder audio)
========================================================= */

// static.js (safe full replace)
(() => {
  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn, opt) => { if (el) el.addEventListener(ev, fn, opt); };

  const loading = $("#loading");
  const statusEl = $("#statusText") || $("#status") || $("#diag");

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };
  const hideLoading = () => { if (loading) loading.classList.add("hidden"); };

  // always unfreeze LOADING even if anything fails
  const safe = async (fn) => {
    try { await fn(); }
    catch (e) {
      console.error("[STATIC] ERR", e);
      setStatus("ERR // " + (e?.message || e));
    }
    finally {
      hideLoading();
    }
  };

  // canvas setup (optional)
  const canvas = $("#staticCanvas");
  const ctx = canvas?.getContext?.("2d", { alpha: false });

  const blinkCanvas = $("#blinkLayer");
  const bctx = blinkCanvas?.getContext?.("2d", { alpha: true });

  const bgVideo = $("#bgVideo");       // optional
  const shadowImg = $("#shadowImg");   // optional

  // buttons (optional)
  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  // state
  let enabled = false;
  let burst = 0;
  let uiOn = true;
  let rafId = 0;

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    if (canvas) { canvas.width = w; canvas.height = h; }
    if (blinkCanvas) { blinkCanvas.width = w; blinkCanvas.height = h; }
  }

  function rand(n) { return Math.random() * n; }

  function drawNoise() {
    if (!enabled) return;

    if (ctx && canvas) {
      // cheap noise (no getImageData loop)
      const w = canvas.width, h = canvas.height;
      const count = 120 + Math.floor(burst * 220);
      for (let i = 0; i < count; i++) {
        const x = rand(w), y = rand(h);
        const ww = 1 + rand(3), hh = 1 + rand(3);
        const a = 0.04 + rand(0.12) + burst * 0.18;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(x, y, ww, hh);
      }
      // fade layer
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, 0, w, h);
    }

    if (bctx && blinkCanvas) {
      const w = blinkCanvas.width, h = blinkCanvas.height;
      // occasional blink
      if (Math.random() < (0.02 + burst * 0.08)) {
        bctx.clearRect(0, 0, w, h);
        bctx.fillStyle = `rgba(255,255,255,${(0.12 + burst * 0.25).toFixed(3)})`;
        bctx.fillRect(0, 0, w, h);
        setTimeout(() => bctx.clearRect(0,0,w,h), 50 + rand(90));
      }
    }

    // shadow apparition (optional)
    if (shadowImg) {
      shadowImg.style.opacity = (Math.random() < (0.012 + burst * 0.05)) ? "0.12" : "0";
    }

    // decay burst
    burst = Math.max(0, burst - 0.012);
  }

  function loop() {
    drawNoise();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (enabled) return;
    enabled = true;
    setStatus("STATIC // ONLINE");
    try { window.WiredAudio?.staticNoise?.(); } catch {}
  }

  function stop() {
    enabled = false;
    setStatus("STATIC // STANDBY");
  }

  function toggle() {
    enabled ? stop() : start();
  }

  function burstNow() {
    burst = Math.min(1, burst + 0.35);
    try { window.WiredAudio?.burst?.(); } catch {}
  }

  function calm() {
    burst = 0;
    try { window.WiredAudio?.calm?.(); } catch {}
  }

  function toggleUI() {
    uiOn = !uiOn;
    document.documentElement.classList.toggle("ui-off", !uiOn);
  }

  // init
  safe(async () => {
    resize();
    on(window, "resize", resize, { passive: true });

    // buttons: also accept pointerdown for iOS
    on(btnEnable, "click", () => start());
    on(btnEnable, "pointerdown", () => start(), { passive: true });

    on(btnToggle, "click", () => toggle());
    on(btnToggle, "pointerdown", () => toggle(), { passive: true });

    on(btnBurst, "click", () => burstNow());
    on(btnBurst, "pointerdown", () => burstNow(), { passive: true });

    on(btnCalm, "click", () => calm());
    on(btnCalm, "pointerdown", () => calm(), { passive: true });

    on(btnUI, "click", () => toggleUI());
    on(btnUI, "pointerdown", () => toggleUI(), { passive: true });

    // scroll boosts burst
    on(window, "scroll", () => { burst = Math.min(1, burst + 0.08); }, { passive: true });

    // kick loop
    if (!rafId) loop();

    setStatus("LOADED // STATIC READY");
  });
})();
