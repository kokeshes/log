/* =========================================================
   STATIC ROOM // THE WIRED
   full replace static.js (stable + UI scramble + louder audio)
========================================================= */

const $ = (s) => document.querySelector(s);
const Timeout = (fn, ms) => window.setTimeout(fn, ms);

/* ---------- DOM ---------- */
const badge = $("#diag");
const uiHint = $("#uiHint");

const canvas = $("#staticCanvas");
const ctx = canvas?.getContext("2d", { alpha: false });

const blinkCanvas = $("#blinkLayer");
const bctx = blinkCanvas?.getContext("2d", { alpha: true });

const bgVideo = $("#bgVideo");
const shadowImg = $("#shadowImg");

const btnEnable = $("#btnEnable");
const btnToggle = $("#btnToggle");
const btnBurst  = $("#btnBurst");
const btnCalm   = $("#btnCalm");
const btnUI     = $("#btnUI");

const vIntensity = $("#vIntensity");
const vGlitch    = $("#vGlitch");
const aVol       = $("#aVol");
const aTone      = $("#aTone");

if (!canvas || !ctx){
  throw new Error("staticCanvas not found or 2D context failed");
}

function logDiag(msg){
  try{
    if (badge) badge.textContent = msg;
    console.log(msg);
  }catch{}
}

/* =========================================================
   UI TOGGLE
========================================================= */
const UI_KEY = "wired_static_ui_off_v1";

function hintOnce(){
  if (!uiHint) return;
  uiHint.classList.add("on");
  Timeout(()=> uiHint.classList.remove("on"), 650);
}

function UIOff(off, showHint=false){
  document.body.classList.toggle("ui-off", !!off);
  try{ localStorage.setItem(UI_KEY, off ? "1" : "0"); }catch{}
  if (btnUI) btnUI.textContent = off ? "UI: OFF" : "UI: ON";
  if (showHint) hintOnce();
}

function getUIOff(){
  try{ return (localStorage.getItem(UI_KEY) === "1"); }catch{ return false; }
}

UIOff(getUIOff(), false);

btnUI?.addEventListener("click", ()=>{
  const off = !document.body.classList.contains("ui-off");
  UIOff(off, off);
});

/* =========================================================
   AUDIO (iOS SAFE)
========================================================= */
let audioCtx = null;
let master = null;
let noiseSrc = null;
let noiseGain = null;
let humOsc = null;
let humGain = null;
let filterLP = null;
let filterHP = null;
let wobbleOsc = null;
let wobbleGain = null;
let comp = null;

function makeNoiseBuffer(ac){
  const seconds = 2;
  const buffer = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const arr = buffer.getChannelData(0);

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
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.0;

  noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = makeNoiseBuffer(audioCtx);
  noiseSrc.loop = true;

  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.26;

  humOsc = audioCtx.createOscillator();
  humOsc.type = "sine";
  humOsc.frequency.value = 50;

  humGain = audioCtx.createGain();
  humGain.gain.value = 0.06;

  filterHP = audioCtx.createBiquadFilter();
  filterHP.type = "highpass";
  filterHP.frequency.value = 80;

  filterLP = audioCtx.createBiquadFilter();
  filterLP.type = "lowpass";
  filterLP.frequency.value = 2200;

  wobbleOsc = audioCtx.createOscillator();
  wobbleOsc.type = "sine";
  wobbleOsc.frequency.value = 0.22;

  wobbleGain = audioCtx.createGain();
  wobbleGain.gain.value = 12;

  wobbleOsc.connect(wobbleGain);
  wobbleGain.connect(humOsc.frequency);

  const mix = audioCtx.createGain();
  noiseSrc.connect(noiseGain); noiseGain.connect(mix);
  humOsc.connect(humGain); humGain.connect(mix);

  mix.connect(filterHP);
  filterHP.connect(filterLP);
  filterLP.connect(master);

  comp = audioCtx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 14;
  comp.ratio.value = 10;
  comp.attack.value = 0.003;
  comp.release.value = 0.14;

  master.connect(comp);
  comp.connect(audioCtx.destination);

  noiseSrc.start();
  humOsc.start();
  wobbleOsc.start();
}

function applyAudioParams(){
  if (!audioCtx) return;

  const vol = Number(aVol?.value ?? 26) / 100;
  const tone = Number(aTone?.value ?? 36) / 100;

  master.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.03);
  filterLP.frequency.setTargetAtTime(900 + tone * 5200, audioCtx.currentTime, 0.05);
  filterHP.frequency.setTargetAtTime(60 + (1-tone) * 140, audioCtx.currentTime, 0.05);
}

aVol?.addEventListener("input", applyAudioParams);
aTone?.addEventListener("input", applyAudioParams);

/* ===== iOS AUDIO UNLOCK (CRITICAL FIX) ===== */
let audioUnlocked = false;

async function unlockAudioOnce(){
  if (audioUnlocked) return;
  audioUnlocked = true;

  try{
    ensureAudio();
    await audioCtx.resume();

    // ★ 修正点：ここで初めて鳴らす
    window.WiredAudio?.staticNoise?.();

    if (master && master.gain.value === 0){
      master.gain.value = 0.18;
    }

    if (btnEnable) btnEnable.textContent = "AUDIO READY";
  }catch(e){
    console.warn("unlockAudioOnce failed:", e);
    audioUnlocked = false;
  }
}

window.addEventListener("pointerdown", unlockAudioOnce, { passive:true });
window.addEventListener("touchstart", unlockAudioOnce, { passive:true });
btnEnable?.addEventListener("click", unlockAudioOnce);

/* =========================================================
   LOOP (visual only / unchanged)
========================================================= */
function loop(){
  requestAnimationFrame(loop);
}
loop();
