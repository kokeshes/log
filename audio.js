// docs/audio.js
// THE WIRED - always-on hum/noise (iOS-safe, stable)
// Exposes window.WiredAudio with: start(), stop(), bootSound(), saveSound(), errorSound(), staticNoise(), burst(), calm()

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

  // ----- init graph -----
  function ensure() {
    if (ac) return;

    ac = new (window.AudioContext || window.webkitAudioContext)();

    master = ac.createGain();
    master.gain.value = 0.0;

    hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 70;

    lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;

    // master -> filters -> out
    master.connect(hp);
    hp.connect(lp);
    lp.connect(ac.destination);

    // hum osc
    humOsc = ac.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 50; // JP-ish hum

    humGain = ac.createGain();
    humGain.gain.value = 0.045;

    humOsc.connect(humGain);
    humGain.connect(master);

    // noise buffer (loop)
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
  }

  async function unlock() {
    if (unlocked) return;
    unlocked = true;
    ensure();
    try {
      if (ac.state === "suspended") await ac.resume();
    } catch {}
  }

  function fadeTo(vol, ms = 160) {
    if (!ac || !master) return;
    const t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    // setTargetAtTime: smooth
    master.gain.setTargetAtTime(vol, t, ms / 1000);
  }

  function startLoop() {
    if (started) return;
    started = true;

    ensure();
    try { humOsc.start(); } catch {}
    try { noiseSrc.start(); } catch {}

    // default texture
    hp.frequency.value = 70;
    lp.frequency.value = 1600;
    noiseGain.gain.value = 0.02;

    // "always-on hum" level
    fadeTo(0.22, 220);
  }

  function blip(freq = 880, dur = 0.05, gain = 0.06, type = "square") {
    if (!ac || !master) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(master);
    const t = ac.currentTime;
    o.start(t);
    o.stop(t + dur);
  }

  // ----- public API -----
  API.start = async () => {
    await unlock();
    startLoop();
  };

  API.stop = () => {
    // keep graph but mute
    fadeTo(0.0, 220);
  };

  API.bootSound = async () => {
    await API.start();
    try { blip(520, 0.05, 0.05); blip(760, 0.05, 0.04); } catch {}
  };

  API.errorSound = async () => {
    await API.start();
    try { blip(170, 0.08, 0.07, "sawtooth"); } catch {}
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
    noiseGain.gain.setTargetAtTime(0.05, ac.currentTime, 0.08);
  };

  // for static room / bursts
  API.burst = async () => {
    await API.start();
    if (!ac) return;
    noiseGain.gain.setTargetAtTime(0.14, ac.currentTime, 0.04);
    lp.frequency.setTargetAtTime(3200, ac.currentTime, 0.05);
    setTimeout(() => {
      if (!ac) return;
      noiseGain.gain.setTargetAtTime(0.02, ac.currentTime, 0.09);
      lp.frequency.setTargetAtTime(1600, ac.currentTime, 0.09);
    }, 220);
  };

  API.calm = async () => {
    await API.start();
    if (!ac) return;
    noiseGain.gain.setTargetAtTime(0.015, ac.currentTime, 0.10);
    lp.frequency.setTargetAtTime(1200, ac.currentTime, 0.10);
  };

  window.WiredAudio = API;

  /**
   * IMPORTANT:
   * iOS/PWAは「ユーザー操作内で start/resume」が必須。
   * → audio.js側で勝手に autostart しない（ブロック→無音化の原因になりやすい）
   *
   * 代わりに index.html で:
   * window.addEventListener("pointerdown", () => WiredAudio.start(), {once:true});
   * を置くのが最も安定。
   */
})();
