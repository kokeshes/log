const $ = (s) => document.querySelector(s);

const canvas = $("#staticCanvas");
const ctx = canvas?.getContext("2d", { alpha: false });

const blinkCanvas = $("#blinkLayer");
const bctx = blinkCanvas?.getContext("2d", { alpha: true });

const bgVideo = $("#bgVideo");
const shadowImg = $("#shadowImg");

const btnEnable = $("#btnEnable");
const btnToggle = $("#btnToggle");
const btnBurst = $("#btnBurst");
const btnCalm = $("#btnCalm");

const vIntensity = $("#vIntensity");
const vGlitch = $("#vGlitch");
const aVol = $("#aVol");
const aTone = $("#aTone");

if (!canvas || !ctx){
  // ここに来るならDOMかidが違う
  document.body.style.background = "#05080c";
  throw new Error("staticCanvas not found or context failed");
}

let W = 0, H = 0, DPR = 1;

let imageData = null;
let data = null;

function resize(){
  DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  W = Math.max(2, Math.floor(window.innerWidth * DPR));
  H = Math.max(2, Math.floor(window.innerHeight * DPR));
  canvas.width = W;
  canvas.height = H;

  if (blinkCanvas){
    blinkCanvas.width = W;
    blinkCanvas.height = H;
  }

  // ✅ ここが重要：ImageDataは使い回す（重くて落ちるのを防ぐ）
  imageData = ctx.createImageData(W, H);
  data = imageData.data;
}
window.addEventListener("resize", resize);
resize();

/* ========= AUDIO (WebAudio) ========= */
let audioCtx = null;
let master = null;

let noiseSrc = null, noiseGain = null;
let humOsc = null, humGain = null;
let filterLP = null, filterHP = null;
let wobbleOsc = null, wobbleGain = null;

let running = false;

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
  noiseGain.gain.value = 0.28;

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
  mix.gain.value = 1;

  noiseSrc.connect(noiseGain); noiseGain.connect(mix);
  humOsc.connect(humGain); humGain.connect(mix);

  mix.connect(filterHP);
  filterHP.connect(filterLP);
  filterLP.connect(master);
  master.connect(audioCtx.destination);

  noiseSrc.start();
  humOsc.start();
  wobbleOsc.start();

  applyAudioParams();
}

function applyAudioParams(){
  if (!audioCtx) return;
  const vol = Number(aVol?.value ?? 25) / 100;
  const tone = Number(aTone?.value ?? 35) / 100;

  master.gain.setTargetAtTime(vol * 0.36, audioCtx.currentTime, 0.03);
  filterLP.frequency.setTargetAtTime(900 + tone * 5200, audioCtx.currentTime, 0.05);
  filterHP.frequency.setTargetAtTime(60 + (1-tone) * 140, audioCtx.currentTime, 0.05);

  humGain.gain.setTargetAtTime(0.03 + tone * 0.10, audioCtx.currentTime, 0.06);
  noiseGain.gain.setTargetAtTime(0.18 + (1-tone) * 0.22, audioCtx.currentTime, 0.06);
}

aVol?.addEventListener("input", applyAudioParams);
aTone?.addEventListener("input", applyAudioParams);

btnEnable?.addEventListener("click", async ()=>{
  ensureAudio();
  await audioCtx.resume();
  btnEnable.textContent = "AUDIO READY";
});

/* ========= visuals ========= */
let t = 0;
let burst = 0;

function glitchPulse(){
  const g = document.querySelector(".glitch-layer");
  if (!g) return;
  g.style.opacity = "1";
  g.style.transform = `translate(${(Math.random()*10-5).toFixed(1)}px, ${(Math.random()*10-5).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 80 + Math.random()*140);
}

/* blink mosaic */
let nextBlinkAt = performance.now() + 2200 + Math.random()*2600;
let blinkUntil = 0;

function triggerBlink(){
  if (!bctx || !blinkCanvas) return;
  const dur = 120 + Math.random()*160;
  blinkUntil = performance.now() + dur;
  nextBlinkAt = performance.now() + 2200 + Math.random()*3200;

  bctx.clearRect(0,0,W,H);
  const block = Math.max(10, Math.floor((10 + Math.random()*26) * DPR));
  const alphaBase = 0.22 + Math.random()*0.32;

  for (let y=0; y<H; y+=block){
    for (let x=0; x<W; x+=block){
      if (Math.random() < 0.22){
        const v = 180 + Math.random()*70;
        bctx.fillStyle = `rgba(${Math.floor(v*0.8)},${Math.floor(v)},${Math.floor(v*0.85)},${alphaBase})`;
        bctx.fillRect(x, y, block, block);
      }
    }
  }

  const lines = 4 + Math.floor(Math.random()*8);
  for (let i=0;i<lines;i++){
    const y = Math.floor(Math.random()*H);
    const h = Math.max(2, Math.floor((1+Math.random()*3)*DPR));
    bctx.fillStyle = `rgba(170,255,210,${0.10 + Math.random()*0.18})`;
    bctx.fillRect(0, y, W, h);
  }

  blinkCanvas.classList.add("on");
}

/* shadow apparition */
let nextShadowAt = performance.now() + 3800 + Math.random()*4200;
let shadowUntil = 0;

function triggerShadow(){
  if (!shadowImg) return;
  const dur = 100 + Math.random()*120;
  shadowUntil = performance.now() + dur;
  nextShadowAt = performance.now() + 4000 + Math.random()*6000;

  const dx = (Math.random()*18 - 9).toFixed(1);
  const dy = (Math.random()*18 - 9).toFixed(1);
  shadowImg.style.transform = `translate(${dx}px, ${dy}px) translateZ(0)`;

  shadowImg.classList.add("on");
  if (Math.random() < 0.7) glitchPulse();
}

/* controls */
btnBurst?.addEventListener("click", ()=>{
  burst = 1.0;
  glitchPulse();
  if (Math.random() < 0.6) triggerBlink();
  if (Math.random() < 0.55) triggerShadow();
});

btnCalm?.addEventListener("click", ()=>{
  burst = 0.0;
  blinkCanvas?.classList.remove("on");
  bctx?.clearRect(0,0,W,H);
  shadowImg?.classList.remove("on");
});

btnToggle?.addEventListener("click", async ()=>{
  running = !running;
  btnToggle.textContent = running ? "STOP" : "START";

  try{
    if (running) await bgVideo?.play?.();
    else bgVideo?.pause?.();
  }catch(e){}

  if (running){
    burst = Math.max(burst, 0.2);
    if (audioCtx){ try{ await audioCtx.resume(); }catch(e){} }
  }
});

/* main loop */
function draw(){
  requestAnimationFrame(draw);
  t += 1;

  const baseIntensity = Number(vIntensity?.value ?? 70)/100;
  const baseGlitch = Number(vGlitch?.value ?? 38)/100;

  const inten = baseIntensity * (running ? 1 : 0.35);
  const g = (baseGlitch + burst*0.8) * (running ? 1 : 0.4);
  burst = Math.max(0, burst - 0.01);

  const drift = Math.sin(t*0.03) * 2.0 * DPR;

  // ✅ ここも軽量化：data配列に直接書く（毎回createしない）
  for (let y=0; y<H; y++){
    const tear = (Math.random() < (0.002 + g*0.012)) ? (Math.random()*34-17) * DPR : 0;
    const lineNoise = (Math.random() < (0.06 + inten*0.08)) ? 35 : 0;
    const lineDark = ((y + Math.floor(drift)) % (2*DPR) === 0) ? 0.86 : 1.0;

    for (let x=0; x<W; x++){
      let v = Math.random()*255;
      v = (128 + (v-128) * (0.35 + inten*1.15));
      v = Math.max(0, Math.min(255, v));
      if (lineNoise && Math.random() < 0.16) v = Math.min(255, v + lineNoise);
      v *= lineDark;

      const tint = 0.02 + inten*0.08;
      const r = v * (1 - tint);
      const gg = v * (1 + tint);
      const b = v * (1 - tint*0.6);

      const xi = Math.max(0, Math.min(W-1, x + tear));
      const idx = (y*W + xi) * 4;
      data[idx+0] = r;
      data[idx+1] = gg;
      data[idx+2] = b;
      data[idx+3] = 255;

      const off = Math.floor((Math.random() < (0.002 + g*0.01) ? (Math.random()*6-3) : 0) * DPR);
      if (off !== 0 && xi+off>=0 && xi+off<W){
        const j = (y*W + (xi+off)) * 4;
        data[j+0] = Math.min(255, r + 18*g*255);
        data[j+1] = gg;
        data[j+2] = Math.min(255, b - 12*g*255);
        data[j+3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  if (Math.random() < (0.01 + g*0.06)) glitchPulse();

  const now = performance.now();

  if (running && now >= nextBlinkAt) triggerBlink();
  if (blinkCanvas && now >= blinkUntil){
    blinkCanvas.classList.remove("on");
    bctx?.clearRect(0,0,W,H);
  }

  if (running && now >= nextShadowAt) triggerShadow();
  if (shadowImg && now >= shadowUntil) shadowImg.classList.remove("on");

  if (audioCtx && master){
    const vol = Number(aVol?.value ?? 25)/100;
    const target = (running ? vol*0.36 : vol*0.14);
    master.gain.setTargetAtTime(target, audioCtx.currentTime, 0.06);
  }
}

draw();

      border-radius: 12px;
      backdrop-filter: blur(6px);
      box-shadow: 0 0 18px rgba(80,255,160,.08);
    }
    .static-title{
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      letter-spacing: .08em;
      font-size: 12px;
      opacity: .9;
      margin-bottom: 6px;
    }
    .static-row{ display:flex; gap:8px; align-items:center; justify-content: space-between; }
    .static-row label{
      width:100%;
      display:flex;
      gap:8px;
      align-items:center;
      font-size: 12px;
      opacity: .9;
    }
    .static-row input[type="range"]{ width:100%; }
