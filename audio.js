/* =========================================================
   audio.js // THE WIRED
   iOS/PWA audio recovery + simple UI sounds
========================================================= */

(function(){
  const $ = (s) => document.querySelector(s);

  // Gate UI
  const gate = $("#audioGate");
  const stEl = $("#audioState");
  const btnReconnect = $("#btnAudioReconnect");
  const btnDismiss   = $("#btnAudioDismiss");
  const btnReset     = $("#btnAudioReset");
  const btnTop       = $("#btnAudio"); // optional (index only)

  // Audio nodes
  let ac = null;
  let master = null;
  let comp = null;

  // Low ambience (optional)
  let noiseSrc = null;
  let noiseGain = null;
  let humOsc = null;
  let humGain = null;
  let lp = null;
  let hp = null;

  // State
  let offline = false;
  let mood = 0;

  function setGate(on){
    if (!gate) return;
    gate.classList.toggle("hidden", !on);
  }

  function setStateText(msg){
    try{
      if (stEl) stEl.textContent = msg;
    }catch{}
  }

  function ctxState(){
    return ac ? ac.state : "none";
  }

  function isIOS(){
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function makeNoiseBuffer(ac){
    const seconds = 2;
    const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
    const arr = buffer.getChannelData(0);

    // pink-ish noise
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i=0;i<arr.length;i++){
      const white = Math.random()*2-1;
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      const pink = (b0+b1+b2+b3+b4+b5+b6 + white*0.5362) * 0.11;
      b6 = white*0.115926;
      arr[i] = pink;
    }
    return buffer;
  }

  function ensureAudio(){
    if (ac) return;

    ac = new (window.AudioContext || window.webkitAudioContext)();

    master = ac.createGain();
    master.gain.value = 0.0;

    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 14;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.14;

    // chain master -> comp -> destination
    master.connect(comp);
    comp.connect(ac.destination);

    // ambience (optional)
    const mix = ac.createGain();
    mix.gain.value = 1.0;

    noiseSrc = ac.createBufferSource();
    noiseSrc.buffer = makeNoiseBuffer(ac);
    noiseSrc.loop = true;

    noiseGain = ac.createGain();
    noiseGain.gain.value = 0.18;

    humOsc = ac.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 50;

    humGain = ac.createGain();
    humGain.gain.value = 0.04;

    hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 70;

    lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;

    noiseSrc.connect(noiseGain); noiseGain.connect(mix);
    humOsc.connect(humGain); humGain.connect(mix);

    mix.connect(hp); hp.connect(lp); lp.connect(master);

    noiseSrc.start();
    humOsc.start();

    // keep UI updated
    ac.onstatechange = () => {
      setStateText(`state: ${ac.state}`);
      if (ac.state !== "running") {
        // iOS は勝手に止まる → gate を出す
        setGate(true);
      }
    };

    setStateText(`state: ${ac.state}`);
  }

  async function resumeAudio(){
    ensureAudio();
    try{
      await ac.resume();
    }catch(e){}
    // set level after resume
    applyMasterLevel();
    setStateText(`state: ${ctxState()}`);
    if (ctxState() === "running") setGate(false);
    else setGate(true);
  }

  async function resetAudio(){
    // close old context
    try{
      if (ac) await ac.close();
    }catch(e){}
    ac = null;
    master = null; comp = null;
    noiseSrc = null; noiseGain = null;
    humOsc = null; humGain = null;
    lp = null; hp = null;

    ensureAudio();
    await resumeAudio();
    // a tiny “reconnected” ping
    try{ beep(880, 0.03, 0.08); }catch{}
  }

  function applyMasterLevel(){
    if (!ac || !master) return;
    // offlineなら抑える
    const base = offline ? 0.06 : 0.16;

    // mood -10..10 を軽くゲインに反映
    const m = Math.max(-10, Math.min(10, Number(mood)||0));
    const mod = 1 + (m * 0.02);

    master.gain.setTargetAtTime(base * mod, ac.currentTime, 0.05);
  }

  function setOffline(v){
    offline = !!v;
    applyMasterLevel();
  }

  function applyMood(v){
    mood = v ?? 0;
    applyMasterLevel();
  }

  // simple UI beeps (won't play if suspended)
  function beep(freq=880, dur=0.02, gain=0.08){
    if (!ac || ac.state !== "running") return;
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.value = freq;

    g.gain.value = 0;
    o.connect(g);
    g.connect(master);

    o.start(t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.stop(t0 + dur + 0.01);
  }

  function bootSound(){ beep(640, 0.03, 0.06); }
  function saveSound(){ beep(920, 0.02, 0.08); }
  function errorSound(){ beep(220, 0.05, 0.07); }

  // UI wiring
  function bindUI(){
    btnReconnect?.addEventListener("click", ()=> resumeAudio());
    btnReset?.addEventListener("click", ()=> resetAudio());
    btnDismiss?.addEventListener("click", ()=> setGate(false));
    btnTop?.addEventListener("click", ()=>{
      // top button: try resume; if still not running show gate
      resumeAudio();
      setGate(true);
    });

    // tap anywhere on gate card also reconnect
    gate?.addEventListener("click", (e)=>{
      const card = e.target?.closest?.(".audio-gate-card");
      if (card) resumeAudio();
    });
  }

  // Auto-detect "audio lost" cases:
  function installGuards(){
    // visible again
    document.addEventListener("visibilitychange", ()=>{
      if (document.visibilityState === "visible"){
        // iOS復帰で止まってることが多い
        if (ac && ac.state !== "running") setGate(true);
      }
    });

    window.addEventListener("pageshow", ()=>{
      if (ac && ac.state !== "running") setGate(true);
    });

    window.addEventListener("focus", ()=>{
      if (ac && ac.state !== "running") setGate(true);
    });

    // iOSはユーザー操作が必要なので、最初のタップで復帰できるように
    const unlock = async () => {
      // まだ作ってないなら作る
      ensureAudio();
      if (ac && ac.state !== "running"){
        try{ await ac.resume(); }catch(e){}
      }
      applyMasterLevel();
      setStateText(`state: ${ctxState()}`);
      // runningなら閉じる
      if (ctxState() === "running") setGate(false);
    };

    // どのページでも一発で復帰できるように
    window.addEventListener("pointerdown", unlock, { passive:true });
    window.addEventListener("touchstart", unlock, { passive:true });

    // iOSは特に死にやすいので、gateを最初は出さないが、
    // もしacがsuspendedなら出せる状態にしておく
    if (isIOS()){
      setStateText(`state: ${ctxState()}`);
    }
  }

  // Expose for app.js / static.js
  window.WiredAudio = {
    ensureAudio,
    resumeAudio,
    resetAudio,
    bootSound,
    saveSound,
    errorSound,
    setOffline,
    applyMood,
    // debug
    _state: () => ({ state: ctxState() })
  };

  // boot
  bindUI();
  installGuards();

  // do NOT auto-play; just prepare
  // (app.jsが login ボタンで resumeAudio() を呼ぶ想定)
})();
