// docs/ps1.js
// DOM-only “PS1-ish” wobble: tiny perspective skew + vertex snap + occasional affine-ish tear.
const panels = Array.from(document.querySelectorAll(".panel"));
const topbar = document.querySelector(".topbar");
const warp = document.querySelector(".warp");

function snap(v){ return Math.round(v); } // vertex snapping
let t = 0;

function tick(){
  const b = window.__noiseBoost || 0;

  // global warp drift
  if (warp){
    const x = (Math.sin(t*0.008)*6) + (Math.random()*0.8 - 0.4) * (1+b*3);
    const y = (Math.cos(t*0.006)*6) + (Math.random()*0.8 - 0.4) * (1+b*3);
    warp.style.transform = `skewX(-2deg) translate(${snap(x)}px, ${snap(y)}px)`;
    warp.style.opacity = String(0.05 + b*0.10);
  }

  // panel wobble (subtle)
  const baseRot = (Math.sin(t*0.01) * 0.25) + (Math.random()*0.08 - 0.04) * (1+b*2);
  const baseSkew = (Math.cos(t*0.008) * 0.35);

  for (let i=0;i<panels.length;i++){
    const p = panels[i];
    const phase = (i+1)*0.7;
    const tx = snap(Math.sin(t*0.012 + phase) * (1.2 + b*4));
    const ty = snap(Math.cos(t*0.010 + phase) * (0.9 + b*3));
    const r = baseRot + Math.sin(t*0.013 + phase) * 0.12;
    const s = baseSkew + Math.cos(t*0.011 + phase) * 0.12;
    p.style.transform = `translate(${tx}px, ${ty}px) rotate(${r}deg) skewX(${s}deg)`;
    p.style.transformOrigin = "50% 50%";
  }

  // topbar micro-jitter
  if (topbar){
    const jx = snap((Math.random()*1.2 - 0.6) * (1+b*2));
    const jy = snap((Math.random()*1.0 - 0.5) * (1+b*2));
    topbar.style.transform = `translate(${jx}px, ${jy}px)`;
  }

  // occasional “tear” (shift body for a frame)
  if (Math.random() < 0.03 + b*0.06){
    document.documentElement.style.setProperty("--tear", `${snap((Math.random()*10-5))}px`);
    setTimeout(()=>document.documentElement.style.setProperty("--tear","0px"), 45);
  }

  t++;
  requestAnimationFrame(tick);
}
tick();
