const $ = (s) => document.querySelector(s);

const canvas = $("#staticCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const btnEnable = $("#btnEnable");
const btnToggle = $("#btnToggle");
const btnBurst = $("#btnBurst");
const btnCalm = $("#btnCalm");

const vIntensity = $("#vIntensity");
const vGlitch = $("#vGlitch");
const aVol = $("#aVol");
const aTone = $("#aTone");

let W = 0, H = 0, DPR = 1;
function resize(){
  DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth * DPR);
  H = Math.floor(window.innerHeight * DPR);
  canvas.width = W;
  canvas.height = H;
}
window.addEventListener("resize", resize);
resize();

/* ========= AUDIO (WebAudio) ========= */
let audioCtx = null;
let master = null;
let running = false;

let noiseSrc = null;
let noiseGain = null;
let humOsc = null;
let humGain = null;
let filter = null;
let wobbleOsc = null;
let wobbleGain = null;

function makeNoiseBuffer(ctx){
  const seconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // pink-ish / band-limited-ish noise seed
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i=0;i<data.length;i++){
    const white = Math.random()*2-1;
    b0 = 0.99886*b0 + white*0.0555179;
    b1 = 0.99332*b1 + white*0.0750759;
    b2 = 0.96900*b2 + white*0.1538520;
    b3 = 0.86650*b3 + white*0.3104856;
    b4 = 0.55000*b4 + white*0.5329522;
    b5 = -0.7616*b5 - white*0.0168980;
    const pink = (b0+b1+b2+b3+b4+b5+b6 + white*0.5362) * 0.11;
    b6 = white*0.115926;
    data[i] = pink;
  }
  return buffer;
}

function ensureAudio(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  master = audioCtx.createGain();
  master.gain.value = 0.0;

  // noise
  noiseSrc = audioCtx.createBufferSource();
  noiseSrc.buffer = makeNoiseBuffer(audioCtx);
  noiseSrc.loop = true;

  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.35;

  // hum (mains + sub)
  humOsc = audioCtx.createOscillator();
  humOsc.type = "sine";
  humOsc.frequency.value = 50; // JP: 50/60 mix. We'll wobble it.
  humGain = audioCtx.createGain();
  humGain.gain.value = 0.07;

  // tone filter (band-limited “radio”)
  filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;

  // wobble to emulate unstable carrier
  wobbleOsc = audioCtx.createOscillator();
  wobbleOsc.type = "sine";
  wobbleOsc.frequency.value = 0.25;
  wobbleGain = audioCtx.createGain();
  wobbleGain.gain.value = 12; // Hz deviation

  wobbleOsc.connect(wobbleGain);
  wobbleGain.connect(humOsc.frequency);

  // route
  noiseSrc.connect(noiseGain);
  humOsc.connect(humGain);

  const mix = audioCtx.createGain();
  mix.gain.value = 1.0;

  noiseGain.connect(mix);
  humGain.connect(mix);

  mix.connect(filter);
  filter.connect(master);
  master.connect(audioCtx.destination);

  noiseSrc.start();
  humOsc.start();
  wobbleOsc.start();

  applyAudioParams();
}

function applyAudioParams(){
  if (!audioCtx) return;
  const vol = (Number(aVol.value) / 100);
  const tone = (Number(aTone.value) / 100);

  // volume: keep it subtle
  master.gain.setTargetAtTime(vol * 0.35, audioCtx.currentTime, 0.02);

  // tone: 0..1 -> 900..5200 Hz
  const cutoff = 900 + tone * 4300;
  filter.frequency.setTargetAtTime(cutoff, audioCtx.currentTime, 0.03);

  // hum weight changes with tone (more tone -> more “carrier”)
  humGain.gain.setTargetAtTime(0.03 + tone * 0.10, audioCtx.currentTime, 0.05);
  noiseGain.gain.setTargetAtTime(0.22 + (1-tone) * 0.22, audioCtx.currentTime, 0.05);
}

aVol.addEventListener("input", applyAudioParams);
aTone.addEventListener("input", applyAudioParams);

btnEnable.addEventListener("click", async ()=>{
  ensureAudio();
  await audioCtx.resume();
  btnEnable.textContent = "AUDIO READY";
});

/* ========= VISUAL ========= */
let t = 0;
let burst = 0;

function glitchPulse(){
  const g = document.querySelector(".glitch-layer");
  if (!g) return;
  g.style.opacity = "1";
  g.style.transform = `translate(${(Math.random()*10-5).toFixed(1)}px, ${(Math.random()*10-5).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 80 + Math.random()*140);
}

function applyVisualParams(){
  // nothing immediate; read in draw()
}
vIntensity.addEventListener("input", applyVisualParams);
vGlitch.addEventListener("input", applyVisualParams);

btnBurst.addEventListener("click", ()=>{
  burst = 1.0;
  glitchPulse();
});
btnCalm.addEventListener("click", ()=>{
  burst = 0.0;
});

btnToggle.addEventListener("click", ()=>{
  running = !running;
  btnToggle.textContent = running ? "STOP" : "START";
  if (running){
    burst = Math.max(burst, 0.2);
  }
});

/* Render noise frame */
const img = ctx.createImageData(1, 1); // dummy
function draw(){
  requestAnimationFrame(draw);
  t += 1;

  // if not running, render calmer idle (still looks alive)
  const baseIntensity = Number(vIntensity.value)/100;
  const baseGlitch = Number(vGlitch.value)/100;

  const inten = baseIntensity * (running ? 1 : 0.35);
  const g = (baseGlitch + burst*0.8) * (running ? 1 : 0.4);

  burst = Math.max(0, burst - 0.01);

  // Fill static
  const frame = ctx.createImageData(W, H);
  const d = frame.data;

  // scanline drift
  const drift = Math.sin(t*0.03) * 2.0 * DPR;

  for (let y=0; y<H; y++){
    // horizontal tear occasionally
    const tear = (Math.random() < (0.002 + g*0.01)) ? (Math.random()*30-15) * DPR : 0;
    const lineNoise = (Math.random() < (0.06 + inten*0.08)) ? 35 : 0;
    const lineDark = ((y + Math.floor(drift)) % (2*DPR) === 0) ? 0.86 : 1.0;

    for (let x=0; x<W; x++){
      const i = (y*W + x) * 4;

      // white noise
      let v = (Math.random() * 255);

      // intensity shaping
      v = (128 + (v-128) * (0.35 + inten*1.15));
      v = Math.max(0, Math.min(255, v));

      // occasional thick bars / dropouts
      if (lineNoise && Math.random() < 0.16) v = Math.min(255, v + lineNoise);

      // apply line darkening (scanlines)
      v *= lineDark;

      // subtle tint (greenish PS1 terminal)
      const tint = 0.02 + inten*0.08;
      const r = v * (1 - tint);
      const gg = v * (1 + tint);
      const b = v * (1 - tint*0.6);

      // glitch chroma offset
      const off = Math.floor((Math.random() < (0.002 + g*0.01) ? (Math.random()*6-3) : 0) * DPR);

      const xi = Math.max(0, Math.min(W-1, x + tear));
      const idx = (y*W + xi) * 4;

      d[idx + 0] = r;
      d[idx + 1] = gg;
      d[idx + 2] = b;
      d[idx + 3] = 255;

      // tiny chroma shift effect: write also at offset pixels
      if (off !== 0 && x+off>=0 && x+off<W){
        const j = (y*W + (xi+off)) * 4;
        d[j+0] = Math.min(255, r + 18*g*255);
        d[j+1] = gg;
        d[j+2] = Math.min(255, b - 12*g*255);
        d[j+3] = 255;
      }
    }
  }

  ctx.putImageData(frame, 0, 0);

  // occasional overlay glitch pulse
  if (Math.random() < (0.01 + g*0.06)) glitchPulse();

  // tie audio to running (optional; gentle)
  if (audioCtx && master){
    const target = running ? (Number(aVol.value)/100)*0.35 : (Number(aVol.value)/100)*0.12;
    master.gain.setTargetAtTime(target, audioCtx.currentTime, 0.06);
  }
}

draw();
