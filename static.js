const $ = (s) => document.querySelector(s);

const badge = document.getElementById("diag");

const canvas = $("#staticCanvas");
const ctx = canvas?.getContext("2d", { alpha:false });

const blinkCanvas = $("#blinkLayer");
const bctx = blinkCanvas?.getContext("2d", { alpha:true });

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
  throw new Error("staticCanvas not found or context failed");
}

/* ====== light, PS1-ish render: draw small buffer then scale ====== */
let DPR = 1, W = 0, H = 0;
let RW = 0, RH = 0;                 // render size (small)
let rCanvas = document.createElement("canvas");
let rctx = rCanvas.getContext("2d", { alpha:false });
let img = null, data = null;

function resize(){
  DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  W = Math.max(2, Math.floor(innerWidth * DPR));
  H = Math.max(2, Math.floor(innerHeight * DPR));

  canvas.width = W; canvas.height = H;
  if (blinkCanvas){ blinkCanvas.width = W; blinkCanvas.height = H; }

  // PS1 scale factor: smaller buffer => chunkier pixels
  const scale = (innerWidth < 720) ? 3.0 : 2.4;
  RW = Math.max(140, Math.floor(W / scale));
  RH = Math.max(120, Math.floor(H / scale));

  rCanvas.width = RW; rCanvas.height = RH;
  img = rctx.createImageData(RW, RH);
  data = img.data;

  if (badge) badge.textContent = `STATIC READY // ${W}x${H} DPR${DPR} // R ${RW}x${RH}`;
}
addEventListener("resize", resize);
resize();

/* ====== UI scramble ====== */
const SCRAMBLE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#@$%+*-=<>[]{}" +
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ" +
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン" +
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわん" +
  "／＼｜＿＝＋＊＠＃％＆！？：；…・「」『』（）［］｛｝〈〉《》";

const scrambleTargets = Array.from(document.querySelectorAll("[data-scramble='1']"))
  .map(el => ({ el, base: el.textContent }));

let scrambleCooldown = 0;
function scrambleOnce(intensity){
  const p = 0.06 + intensity*0.18;
  for (const t of scrambleTargets){
    const s = t.base;
    let out = "";
    for (let i=0;i<s.length;i++){
      const ch = s[i];
      if (ch === " " || ch === "\n" || ch === "\t"){ out += ch; continue; }
      out += (Math.random() < p) ? SCRAMBLE_CHARS[(Math.random()*SCRAMBLE_CHARS.length)|0] : ch;
    }
    t.el.textContent = out;
  }
  setTimeout(()=>{ for (const t of scrambleTargets) t.el.textContent = t.base; }, 90 + Math.random()*140);
}
function maybeScramble(intensity){
  const now = performance.now();
  if (now < scrambleCooldown) return;
  const chance = 0.02 + intensity*0.07;
  if (Math.random() < chance){
    scrambleOnce(intensity);
    scrambleCooldown = now + 420 + Math.random()*540;
  }
}

/* ====== glitch pulse overlay ====== */
function glitchPulse(){
  const g = document.querySelector(".glitch-layer");
  if (!g) return;
  g.style.opacity = "1";
  g.style.transform = `translate(${(Math.random()*10-5).toFixed(1)}px, ${(Math.random()*10-5).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 80 + Math.random()*140);
}

/* ====== blink mosaic ====== */
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

  const lines = 4 + ((Math.random()*8)|0);
  for (let i=0;i<lines;i++){
    const y = (Math.random()*H)|0;
    const h = Math.max(2, Math.floor((1+Math.random()*3)*DPR));
    bctx.fillStyle = `rgba(170,255,210,${0.10 + Math.random()*0.18})`;
    bctx.fillRect(0, y, W, h);
  }

  blinkCanvas.classList.add("on");
}

/* ====== shadow apparition ====== */
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

/* ====== audio (wired hiss) ====== */
let audioCtx = null, master = null;
let noiseSrc = null, noiseGain = null;
let humOsc = null, humGain = null;
let filterLP = null, filterHP = null;
let wobbleOsc = null, wobbleGain = null;

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
  const vol = Number(aVol?.value ?? 26) / 100;
  const tone = Number(aTone?.value ?? 36) / 100;

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

/* ====== controls ====== */
let running = false;
let burst = 0;
let tick = 0;

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

/* ====== main loop ====== */
function loop(){
  requestAnimationFrame(loop);
  tick++;

  const inten = (Number(vIntensity?.value ?? 70)/100) * (running ? 1 : 0.35);
  const glitch = (Number(vGlitch?.value ?? 38)/100) * (running ? 1 : 0.4) + burst*0.7;
  burst = Math.max(0, burst - 0.01);

  const drift = Math.sin(tick*0.03) * 1.7;

  // write noise into small buffer
  for (let y=0; y<RH; y++){
    const tear = (Math.random() < (0.004 + glitch*0.02)) ? (Math.random()*10-5) : 0;
    const lineDark = ((y + (drift|0)) % 2 === 0) ? 0.86 : 1.0;

    for (let x=0; x<RW; x++){
      let v = Math.random()*255;
      v = (128 + (v-128) * (0.45 + inten*1.0));
      v = Math.max(0, Math.min(255, v));

      if (Math.random() < (0.008 + glitch*0.03)) v = Math.min(255, v + 60);

      v *= lineDark;

      const tint = 0.02 + inten*0.08;
      const r = v * (1 - tint);
      const gch = v * (1 + tint);
      const b = v * (1 - tint*0.6);

      const xi = Math.max(0, Math.min(RW-1, (x + tear)|0));
      const idx = (y*RW + xi) * 4;
      data[idx]   = r;
      data[idx+1] = gch;
      data[idx+2] = b;
      data[idx+3] = 255;
    }
  }

  rctx.putImageData(img, 0, 0);

  // scale up (pixelated)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rCanvas, 0, 0, W, H);

  // occasional overlay glitch
  if (Math.random() < (0.01 + glitch*0.06)) glitchPulse();

  const now = performance.now();
  if (running && now >= nextBlinkAt) triggerBlink();
  if (blinkCanvas && now >= blinkUntil){
    blinkCanvas.classList.remove("on");
    bctx?.clearRect(0,0,W,H);
  }

  if (running && now >= nextShadowAt) triggerShadow();
  if (shadowImg && now >= shadowUntil) shadowImg.classList.remove("on");

  const power = Math.min(1, inten*0.9 + glitch*0.7 + burst*0.8);
  maybeScramble(power);

  // audio tie-in
  if (audioCtx && master){
    const vol = Number(aVol?.value ?? 26)/100;
    const target = (running ? vol*0.36 : vol*0.14);
    master.gain.setTargetAtTime(target, audioCtx.currentTime, 0.06);
  }
}
loop();
