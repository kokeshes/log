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
// ====== GHOST TRACE (local only; NOT saved to Supabase) ======
const GHOST_KEY = "wired_ghost_trace_v1";
const GHOST_CH  = "wired_ghost_channel_v1";
const ghostChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(GHOST_CH) : null;

function readGhostTrace(){
  try{
    return JSON.parse(localStorage.getItem(GHOST_KEY) || "[]");
  }catch{
    return [];
  }
}

function writeGhostTrace(list){
  try{
    localStorage.setItem(GHOST_KEY, JSON.stringify(list));
  }catch{}
}

function pushGhostTrace(line){
  const item = {
    at: new Date().toISOString(),
    page: "static",
    line: String(line || "").slice(0, 180),
    seed: Math.random().toString(16).slice(2, 8)
  };

  const list = readGhostTrace();
  list.unshift(item);
  // 上限：最新80件だけ保持（重くしない）
  if (list.length > 80) list.length = 80;
  writeGhostTrace(list);

  // 即時にLOG側へ飛ばす（開いてれば反映）
  try{ ghostChannel?.postMessage({ type:"ghost", item }); }catch{}
}


// ====== HORROR TEXT ======
const HORROR_LINES = [
  "do not panic.",
  "observe.",
  "you are already connected.",
  "this is not a dream.",
  "the wired is closer than you think.",
  "can you hear it?",
  "who is observing whom?",
  "you were not supposed to see this.",
  "this log does not belong to you.",
  "why did you come here?",
  "present time. present day.",
  "you left something unfinished.",
  "are you still there?",
  "LOG CORRUPTED // observe",
  "ERR_001 // identity mismatch",
  "TRACE LOST // wired node",
];

// 次にホラーを出す時刻（出すぎ防止）
let nextHorrorAt = performance.now() + 2500;

function injectHorrorText(){
  const line = HORROR_LINES[(Math.random() * HORROR_LINES.length) | 0];
  if (Math.random() < 0.3){
    injectIntoUI(line);
  } else {
    injectFloatingText(line);
  }
  return line;
}

function injectIntoUI(line){
  const targets = document.querySelectorAll("[data-scramble='1']");
  if (!targets.length) return;

  const el = targets[(Math.random() * targets.length) | 0];
  const original = el.textContent;

  el.textContent = line;
  setTimeout(()=>{ el.textContent = original; }, 400 + Math.random()*600);
}

function injectFloatingText(line){
  const div = document.createElement("div");
  div.textContent = line;

  div.style.position = "fixed";
  div.style.left = (10 + Math.random()*80) + "vw";
  div.style.top  = (10 + Math.random()*70) + "vh";
  div.style.zIndex = 5;
  div.style.pointerEvents = "none";
  div.style.opacity = "0";
  div.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
  div.style.fontSize = "12px";
  div.style.letterSpacing = ".12em";
  div.style.color = "#baffd8";
  div.style.textShadow = "0 0 12px rgba(120,255,180,.45)";

  document.body.appendChild(div);

  requestAnimationFrame(()=>{
    div.style.transition = "opacity .2s linear";
    div.style.opacity = "0.9";
  });

  setTimeout(()=>{ div.style.opacity = "0"; }, 500 + Math.random()*700);
  setTimeout(()=>{ div.remove(); }, 1400);
}

// ====== main loop ======
function loop(){
  requestAnimationFrame(loop);
  tick++;

  const inten  = (Number(vIntensity?.value ?? 70) / 100) * (running ? 1 : 0.35);
  const glitch = (Number(vGlitch?.value ?? 38) / 100) * (running ? 1 : 0.4) + burst * 0.7;
  burst = Math.max(0, burst - 0.01);

  const drift = Math.sin(tick * 0.03) * 1.7;

  // write noise into small buffer
  for (let y = 0; y < RH; y++){
    const tear = (Math.random() < (0.004 + glitch * 0.02)) ? (Math.random() * 10 - 5) : 0;
    const lineDark = ((y + (drift | 0)) % 2 === 0) ? 0.86 : 1.0;

    for (let x = 0; x < RW; x++){
      let v = Math.random() * 255;
      v = 128 + (v - 128) * (0.45 + inten * 1.0);
      v = Math.max(0, Math.min(255, v));

      if (Math.random() < (0.008 + glitch * 0.03)) v = Math.min(255, v + 60);

      v *= lineDark;

      const tint = 0.02 + inten * 0.08;
      const r = v * (1 - tint);
      const gch = v * (1 + tint);
      const b = v * (1 - tint * 0.6);

      const xi = Math.max(0, Math.min(RW - 1, (x + tear) | 0));
      const idx = (y * RW + xi) * 4;
      data[idx]     = r;
      data[idx + 1] = gch;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  // commit small buffer -> scale up
  rctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rCanvas, 0, 0, W, H);

  // overlay glitch
  if (Math.random() < (0.01 + glitch * 0.06)) glitchPulse();

  // ---- horror injection + trace + audio sync ----
  if (running){
    const now = performance.now();
    if (now >= nextHorrorAt){
      const chance = 0.12 + (inten * 0.18) + (glitch * 0.25);

      if (Math.random() < chance){
        const line = injectHorrorText();
        if (line) pushGhostTrace(line);

        if (Math.random() < 0.45) triggerShadow();
        if (Math.random() < 0.35) glitchPulse();

        // audio wobble + click (safe)
        if (audioCtx && humOsc && filterLP && noiseGain && master){
          const t0 = audioCtx.currentTime;

          humOsc.frequency.cancelScheduledValues(t0);
          humOsc.frequency.setTargetAtTime(40 + Math.random()*90, t0, 0.02);
          humOsc.frequency.setTargetAtTime(50, t0 + 0.18, 0.10);

          filterLP.frequency.cancelScheduledValues(t0);
          filterLP.frequency.setTargetAtTime(600 + Math.random()*900, t0, 0.03);
          filterLP.frequency.setTargetAtTime(2200, t0 + 0.22, 0.12);

          noiseGain.gain.cancelScheduledValues(t0);
          noiseGain.gain.setTargetAtTime(0.32 + Math.random()*0.18, t0, 0.03);
          noiseGain.gain.setTargetAtTime(0.26, t0 + 0.25, 0.12);

          const click = audioCtx.createOscillator();
          const cg = audioCtx.createGain();
          click.type = "square";
          click.frequency.value = 1200 + Math.random()*800;
          cg.gain.value = 0.0;
          click.connect(cg);
          cg.connect(master);

          click.start(t0);
          cg.gain.setValueAtTime(0.0, t0);
          cg.gain.linearRampToValueAtTime(0.06, t0 + 0.005);
          cg.gain.linearRampToValueAtTime(0.0, t0 + 0.02);
          click.stop(t0 + 0.03);
        }

        // next horror timing (sometimes "wave")
        if (Math.random() < 0.18){
          nextHorrorAt = now + 180 + Math.random() * 420;
        } else {
          nextHorrorAt = now + 1200 + Math.random() * 2800;
        }
      } else {
        nextHorrorAt = now + 900 + Math.random() * 2200;
      }
    }
  }

  // blink / shadow schedule
  const now2 = performance.now();

  if (running && now2 >= nextBlinkAt) triggerBlink();
  if (blinkCanvas && now2 >= blinkUntil){
    blinkCanvas.classList.remove("on");
    bctx?.clearRect(0, 0, W, H);
  }

  if (running && now2 >= nextShadowAt) triggerShadow();
  if (shadowImg && now2 >= shadowUntil) shadowImg.classList.remove("on");

  // UI scramble
  const power = Math.min(1, inten * 0.9 + glitch * 0.7 + burst * 0.8);
  maybeScramble(power);

  // audio base level
  if (audioCtx && master){
    const vol = Number(aVol?.value ?? 26) / 100;
    const target = (running ? vol * 0.36 : vol * 0.14);
    master.gain.setTargetAtTime(target, audioCtx.currentTime, 0.06);
  }
}

loop();
