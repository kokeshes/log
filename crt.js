// docs/crt.js
// Glitch pulse + Lain image jitter (bfcache-safe / no stuck overlay)

(() => {
  // prevent double init (bfcache or hot reload)
  if (window.__CRT_INITED__) return;
  window.__CRT_INITED__ = true;

  const glitch = document.querySelector(".glitch-layer");
  const lainImg = document.getElementById("lainImg");

  // ---- helpers ----
  function safeResetGlitch(){
    if (!glitch) return;
    glitch.style.opacity = "0";
    glitch.style.transform = "translate(0px,0px)";
  }

  // ---- GLITCH PULSE ----
  let pulseTimer = 0;
  function pulse(){
    if (!glitch) return;

    // if we were left "on" somehow, cancel/reset first
    clearTimeout(pulseTimer);

    glitch.style.opacity = "1";
    glitch.style.transform =
      `translate(${(Math.random()*8-4).toFixed(1)}px, ${(Math.random()*8-4).toFixed(1)}px)`;

    pulseTimer = setTimeout(() => {
      if (!glitch) return;
      glitch.style.opacity = "0";
    }, 60 + Math.random() * 140);
  }

  // single interval (store id so we can stop)
  let intId = 0;
  function startPulseLoop(){
    if (intId) return;
    intId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Math.random() < 0.25) pulse();
    }, 520);
  }
  function stopPulseLoop(){
    if (!intId) return;
    clearInterval(intId);
    intId = 0;
  }

  // ---- LAIN IMG JITTER ----
  let jitterOn = true;
  function jitter(){
    if (!jitterOn) return;
    if (!lainImg) return requestAnimationFrame(jitter);

    const b = (window.__noiseBoost || 0);
    const x = (Math.random()*2 - 1) * (1 + b*2);
    const y = (Math.random()*2 - 1) * (1 + b*2);
    const r = (Math.random()*0.6 - 0.3) * (1 + b);

    lainImg.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
    requestAnimationFrame(jitter);
  }

  // boost on scroll (keep it, but this shouldn't "white out")
  window.addEventListener("scroll", () => {
    window.__noiseBoost = Math.min(1, (window.__noiseBoost || 0) + 0.15);
  }, { passive: true });

  // ---- bfcache / visibility safety ----
  // When page is hidden/frozen, timers may not run -> overlay can get stuck ON.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      // leaving / background
      safeResetGlitch();
      stopPulseLoop();
    } else {
      // coming back
      safeResetGlitch();
      startPulseLoop();
    }
  });

  // bfcache restore: pageshow fires with persisted=true
  window.addEventListener("pageshow", (e) => {
    safeResetGlitch();
    startPulseLoop();
    // resume jitter
    jitterOn = true;
    jitter();
  });

  // pagehide (bfcache freeze)
  window.addEventListener("pagehide", () => {
    safeResetGlitch();
    stopPulseLoop();
    jitterOn = false;
  });

  // ---- boot ----
  safeResetGlitch();
  startPulseLoop();
  jitter();
})();
