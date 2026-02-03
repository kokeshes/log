// docs/audio.js
// THE WIRED - always-on hum/noise (iOS-safe)
// window.WiredAudio: start(), stop(), bootSound(), saveSound(), errorSound(), staticNoise(), burst(), calm(), set({volume,tone})
//
// ✅ louder overall + soft clipper to reduce harsh clipping

(() => {
  const API = {};
  let ac = null;

  let master = null;     // main gain (volume knob)
  let clip = null;       // soft clipper
  let post = null;       // post gain (final trim)

  let humOsc = null;
  let humGain = null;

  let noiseSrc = null;
  let noiseGain = null;

  let lp = null;
  let hp = null;

  let started = false;
  let unlocked = false;

  // params (UI sends 0..1)
  let _vol = 0.26;   // 0..1
  let _tone = 0.36;  // 0..1

  // --- helpers ---
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function makeSoftClipper(ctx, amount = 0.65) {
    // amount: 0..1 (higher = more limiting)
    const n = 1024;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(n);

    // gentle tanh-like curve
    const k = 1 + amount * 14; // 1..15
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / (n - 1) - 1; // -1..1
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }

    shaper.curve = curve;
    shaper.oversample = "4x";
    return shaper;
  }

  function ensure() {
    if (ac) return;

    ac = new (window.AudioContext || window.webkitAudioContext)();

    // master -> clip -> post -> filters -> destination
    master = ac.createGain();
    master.gain.value = 0.0;

    clip = makeSoftClipper(ac, 0.60);

    post = ac.createGain();
    post.gain.value = 0.92; // final trim to keep it pleasant even when loud

    hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 60;

    lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;

    master.connect(clip);
    clip.connect(post);
    post.connect(hp);
    hp.connect(lp);
    lp.connect(ac.destination);

    // hum (slightly louder base)
    humOsc = ac.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 50;

    humGain = ac.createGain();
    humGain.gain.value = 0.06; // was 0.045

    humOsc.connect(humGain);
    humGain.connect(master);

    // noise buffer (slightly hotter)
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const arr = buf.getChannelData(0);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (Math.random() * 2 - 1) * 0.48; // was 0.35
    }

    noiseSrc = ac.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;

    noiseGain = ac.createGain();
    noiseGain.gain.value = 0.045; // was 0.02

    noiseSrc.connect(noiseGain);
    noiseGain.connect(master);

    applyParams();
  }

  function applyParams() {
    if (!ac) return;

    const targetVol = clamp01(_vol);
    const t = clamp01(_tone);

    // tone mapping (keep your idea, slightly widened)
    const lpHz = 900 + t * 3000;       // 900..3900
    const hpHz = 35 + (1 - t) * 140;   // 175..35 (low end varies)

    try {
      lp.frequency.setTargetAtTime(lpHz, ac.currentTime, 0.04);
      hp.frequency.setTargetAtTime(hpHz, ac.currentTime, 0.04);
    } catch {}

    // hum tracks volume but stays under control
    try { humGain.gain.value = 0.05 + targetVol * 0.10; } catch {} // was smaller
  }

  async function unlock() {
    ensure();
    try {
      if (ac.state === "suspended") await ac.resume();
    } catch {}
    unlocked = true;
  }

  function fadeTo(vol, ms = 160) {
    if (!ac || !master) return;
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    // setTargetAtTime's "timeConstant" expects seconds, so keep similar behavior
    master.gain.setTargetAtTime(vol, t, ms / 1000);
  }

  function startLoop() {
    if (started) return;
    started = true;

    ensure();
    try { humOsc.start(); } catch {}
    try { noiseSrc.start(); } catch {}

    // base texture (a bit louder by default)
    hp.frequency.value = 70;
    lp.frequency.value = 1600;
    noiseGain.gain.value = 0.05; // was 0.02

    // louder overall: map _vol to master gain with higher ceiling
    // UI 0.26 -> about 0.38 (audible), max around 0.72 but clipped softly
    const base = 0.22 + clamp01(_vol) * 0.50; // 0.22..0.72
    fadeTo(base, 220);
  }

  function blip(freq = 880, dur = 0.05, gain = 0.08) {
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(master);
    const t = ac.currentTime;
    o.start(t);
    o.stop(t + dur);
  }

  API.set = ({ volume, tone } = {}) => {
    if (typeof volume === "number") _vol = volume;
    if (typeof tone === "number") _tone = tone;
    applyParams();

    // master gain follows volume even after start (louder curve)
    if (ac && started) {
      const base = 0.22 + clamp01(_vol) * 0.50; // 0.22..0.72
      fadeTo(base, 120);
    }
  };

  API.start = async () => {
    await unlock();
    startLoop();
    API.set({ volume: _vol, tone: _tone });
  };

  API.stop = () => { fadeTo(0.0, 220); };

  API.bootSound = async () => {
    await API.start();
    try { blip(520, 0.05, 0.08); blip(760, 0.05, 0.07); } catch {}
  };

  API.errorSound = async () => {
    await API.start();
    try { blip(170, 0.08, 0.11); } catch {}
    if (!ac) return;

    // harsher noise hit
    lp.frequency.setTargetAtTime(900, ac.currentTime, 0.04);
    noiseGain.gain.setTargetAtTime(0.18, ac.currentTime, 0.04);
    setTimeout(() => {
      if (!ac) return;
      lp.frequency.setTargetAtTime(1600, ac.currentTime, 0.08);
      noiseGain.gain.setTargetAtTime(0.07, ac.currentTime, 0.08);
    }, 260);
  };

  API.saveSound = async () => {
    await API.start();
    try { blip(980, 0.05, 0.09); } catch {}
    if (!ac) return;

    lp.frequency.setTargetAtTime(3000, ac.currentTime, 0.04);
    noiseGain.gain.setTargetAtTime(0.22, ac.currentTime, 0.05);
    setTimeout(() => {
      if (!ac) return;
      lp.frequency.setTargetAtTime(1600, ac.currentTime, 0.09);
      noiseGain.gain.setTargetAtTime(0.07, ac.currentTime, 0.10);
    }, 320);
  };

  API.staticNoise = async () => {
    await API.start();
    if (!ac) return;
    noiseGain.gain.setTargetAtTime(0.11, ac.currentTime, 0.08); // was ~0.06
  };

  API.burst = async () => {
    await API.start();
    if (!ac) return;

    noiseGain.gain.setTargetAtTime(0.28, ac.currentTime, 0.03); // punch
    setTimeout(() => {
      if (!ac) return;
      noiseGain.gain.setTargetAtTime(0.11, ac.currentTime, 0.08);
    }, 180);
  };

  API.calm = async () => {
    await API.start();
    if (!ac) return;

    noiseGain.gain.setTargetAtTime(0.04, ac.currentTime, 0.14);
    setTimeout(() => {
      if (!ac) return;
      noiseGain.gain.setTargetAtTime(0.11, ac.currentTime, 0.20);
    }, 420);
  };

  // debug hook (optional)
  API.__ac = () => ac;

  window.WiredAudio = API;

  // ---- mobile requires gesture; force unlock on multiple events ----
  const unlockOnce = async () => {
    try { await API.start(); } catch {}
    document.removeEventListener("pointerdown", unlockOnce);
    document.removeEventListener("touchstart", unlockOnce);
    document.removeEventListener("click", unlockOnce);
    document.removeEventListener("keydown", unlockOnce);
  };
  document.addEventListener("pointerdown", unlockOnce, { passive: true });
  document.addEventListener("touchstart", unlockOnce, { passive: true });
  document.addEventListener("click", unlockOnce, { passive: true });
  document.addEventListener("keydown", unlockOnce);

  // desktop: attempt autostart
  setTimeout(() => { API.start().catch(() => {}); }, 600);
})();
