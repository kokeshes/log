// docs/audio.js
// THE WIRED - always-on hum/noise (iOS-safe)
// window.WiredAudio: start(), stop(), bootSound(), saveSound(), errorSound(), staticNoise(), burst(), calm(), set({volume,tone})

(() => {
  const API = {};
  let ac = null;
  let master = null;

  let humOsc = null;
  let humGain = null;

  let noiseSrc = null;
  let noiseGain = null;

  let lp = null;
  let hp = null;

  let started = false;
  let unlocked = false;

  // params
  let _vol = 0.26;  // 0..1
  let _tone = 0.36; // 0..1

  function ensure() {
    if (ac) return;

    ac = new (window.AudioContext || window.webkitAudioContext)();

    master = ac.createGain();
    master.gain.value = 0.0;

    hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 60;

    lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;

    master.connect(hp);
    hp.connect(lp);
    lp.connect(ac.destination);

    // hum
    humOsc = ac.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 50;

    humGain = ac.createGain();
    humGain.gain.value = 0.045;

    humOsc.connect(humGain);
    humGain.connect(master);

    // noise buffer
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const arr = buf.getChannelData(0);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = (Math.random() * 2 - 1) * 0.35;
    }

    noiseSrc = ac.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;

    noiseGain = ac.createGain();
    noiseGain.gain.value = 0.02;

    noiseSrc.connect(noiseGain);
    noiseGain.connect(master);

    applyParams();
  }

  function applyParams() {
    if (!ac) return;

    // volume: master target
    const targetVol = Math.max(0, Math.min(1, _vol));
    // tone: map 0..1 -> filters
    const t = Math.max(0, Math.min(1, _tone));
    const lpHz = 900 + t * 2600;   // 900..3500
    const hpHz = 40 + (1 - t) * 120; // 160..40-ish (低域残す/削る)

    try {
      lp.frequency.setTargetAtTime(lpHz, ac.currentTime, 0.04);
      hp.frequency.setTargetAtTime(hpHz, ac.currentTime, 0.04);
    } catch {}

    // keep hum subtle
    try { humGain.gain.value = 0.03 + targetVol * 0.06; } catch {}
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
    master.gain.setTargetAtTime(vol, t, ms / 1000);
  }

  function startLoop() {
    if (started) return;
    started = true;

    ensure();
    try { humOsc.start(); } catch {}
    try { noiseSrc.start(); } catch {}

    // base texture
    hp.frequency.value = 70;
    lp.frequency.value = 1600;
    noiseGain.gain.value = 0.02;

    // bring up
    fadeTo(Math.max(0.12, Math.min(0.45, _vol + 0.06)), 220);
  }

  function blip(freq = 880, dur = 0.05, gain = 0.06) {
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
    // master gain also tracks volume when already started
    if (ac && started) fadeTo(Math.max(0.12, Math.min(0.55, _vol + 0.06)), 120);
  };

  API.start = async () => {
    await unlock();
    startLoop();
    API.set({ volume: _vol, tone: _tone });
  };

  API.stop = () => { fadeTo(0.0, 220); };

  API.bootSound = async () => {
    await API.start();
    try { blip(520, 0.05, 0.05); blip(760, 0.05, 0.04); } catch {}
  };

  API.errorSound = async () => {
    await API.start();
    try { blip(170, 0.08, 0.07); } catch {}
    if (!ac) return;
    lp.frequency.setTargetAtTime(900, ac.currentTime, 0.04);
    noiseGain.gain.setTargetAtTime(0.07, ac.currentTime, 0.04);
    setTimeout(() => {
      if (!ac) return;
      lp.frequency.setTargetAtTime(1600, ac.currentTime, 0.08);
      noiseGain.gain.setTargetAtTime(0.02, ac.currentTime, 0.08);
    }, 240);
  };

  API.saveSound = async () => {
    await API.start();
    try { blip(980, 0.04, 0.05); } catch {}
    if (!ac) return;
    lp.frequency.setTargetAtTime(2600, ac.currentTime, 0.04);
    noiseGain.gain.setTargetAtTime(0.11, ac.currentTime, 0.05);
    setTimeout(() => {
      if (!ac) return;
      lp.frequency.setTargetAtTime(1600, ac.currentTime, 0.09);
      noiseGain.gain.setTargetAtTime(0.02, ac.currentTime, 0.09);
    }, 320);
  };

  API.staticNoise = async () => {
    await API.start();
    if (!ac) return;
    noiseGain.gain.setTargetAtTime(0.06, ac.currentTime, 0.08); // slightly louder
  };

  API.burst = async () => {
    await API.start();
    if (!ac) return;
    noiseGain.gain.setTargetAtTime(0.12, ac.currentTime, 0.03);
    setTimeout(() => {
      if (!ac) return;
      noiseGain.gain.setTargetAtTime(0.06, ac.currentTime, 0.06);
    }, 180);
  };

  API.calm = async () => {
    await API.start();
    if (!ac) return;
    noiseGain.gain.setTargetAtTime(0.02, ac.currentTime, 0.12);
    setTimeout(() => {
      if (!ac) return;
      noiseGain.gain.setTargetAtTime(0.06, ac.currentTime, 0.18);
    }, 420);
  };

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
