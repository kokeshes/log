// docs/ps1.js
// “PS1-ish” wobble tuned: quiet unease + occasional aggressive spikes.
const panels = Array.from(document.querySelectorAll(".panel"));
const topbar = document.querySelector(".topbar");
const warp = document.querySelector(".warp");

const snap = (v)=> Math.round(v); // vertex snapping
let t = 0;

// spikes（たまに攻撃的）
let spike = 0;          // 0..1
let nextSpikeAt = performance.now() + 1800 + Math.random()*2200;

function tick(){
  const b = Math.min(1, window.__noiseBoost || 0); // typing boost etc.
  const now = performance.now();

  // --- spike scheduling (rare but punchy) ---
  if (now >= nextSpikeAt){
    spike = Math.min(1, spike + 0.65 + Math.random()*0.35);
    nextSpikeAt = now + (Math.random() < 0.25 ? (380 + Math.random()*900) : (1800 + Math.random()*2800));
  }
  // decay
  spike = Math.max(0, spike - 0.035);

  // quiet baseline + boosted by b + spikes
  const quiet = 0.25;                // 常時の静かな揺れ
  const power = quiet + b*0.55 + spike*1.0;

  /* ---------- global warp drift ---------- */
  if (warp){
    // 普段は弱い、spikeで急に出る
    const x = (Math.sin(t*0.008)*4.5) + (Math.random()*0.6 - 0.3) * (1 + power*2.2);
    const y = (Math.cos(t*0.006)*4.5) + (Math.random()*0.6 - 0.3) * (1 + power*2.2);

    warp.style.transform = `skewX(-2.2deg) translate(${snap(x)}px, ${snap(y)}px)`;
    // 見えるけど邪魔しすぎない
    warp.style.opacity = String(0.045 + power*0.085);
  }

  /* ---------- panel wobble (mostly subtle) ---------- */
  const baseRot  = (Math.sin(t*0.010) * 0.18) + (Math.random()*0.06 - 0.03) * (1 + power*1.4);
  const baseSkew = (Math.cos(t*0.008) * 0.28);

  for (let i=0;i<panels.length;i++){
    const p = panels[i];
    const phase = (i+1)*0.7;

    // 普段は小さく、spikeで急に大きく
    const tx = snap(Math.sin(t*0.012 + phase) * (0.9 + power*3.2));
    const ty = snap(Math.cos(t*0.010 + phase) * (0.6 + power*2.4));

    const r = baseRot  + Math.sin(t*0.013 + phase) * (0.10 + spike*0.18);
    const s = baseSkew + Math.cos(t*0.011 + phase) * (0.10 + spike*0.20);

    p.style.transform = `translate(${tx}px, ${ty}px) rotate(${r}deg) skewX(${s}deg)`;
    p.style.transformOrigin = "50% 50%";
  }

  /* ---------- topbar micro-jitter ---------- */
  if (topbar){
    // 普段はほぼ動かない、spike時にだけ短く暴れる
    const jPower = (0.15 + b*0.6 + spike*1.2);
    const jx = snap((Math.random()*1.0 - 0.5) * jPower);
    const jy = snap((Math.random()*0.8 - 0.4) * jPower);
    topbar.style.transform = `translate(${jx}px, ${jy}px)`;
  }

  /* ---------- occasional “tear” (aggressive but brief) ---------- */
  // 普段は低頻度、spike時は増える
  const tearChance = 0.010 + b*0.030 + spike*0.10;

  if (Math.random() < tearChance){
    // spike時は幅も増える
    const amp = 6 + (b*6) + (spike*18);
    document.documentElement.style.setProperty("--tear", `${snap((Math.random()*amp - amp/2))}px`);

    // 短く（“一瞬だけ攻撃的”）
    const dur = 28 + Math.random()*38;
    setTimeout(()=>document.documentElement.style.setProperty("--tear","0px"), dur);
  }

  // noiseBoost は “粘る” 方向に（前の雰囲気）
  if (window.__noiseBoost){
    window.__noiseBoost = Math.max(0, window.__noiseBoost - 0.025);
  }

  t++;
  requestAnimationFrame(tick);
}
tick();
