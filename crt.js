// crt.js
// visual-only effect (does NOT touch auth/network)
// 軽量化: ページ非表示時は停止、更新頻度を抑える
const glitch = document.querySelector(".glitch-layer");
const lainImg = document.getElementById("lainImg");

let running = true;
document.addEventListener("visibilitychange", ()=>{
  running = !document.hidden;
});

// glitch pulse (low duty)
function pulse(){
  if (!running || !glitch) return;
  glitch.style.opacity = "1";
  glitch.style.transform = `translate(${(Math.random()*8-4).toFixed(1)}px, ${(Math.random()*8-4).toFixed(1)}px)`;
  setTimeout(()=>{ if (glitch) glitch.style.opacity = "0"; }, 80 + Math.random()*120);
}

setInterval(()=>{
  if (running && Math.random() < 0.22) pulse();
}, 560);

// Lain-like apparition jitter (original character image)
let last = 0;
function jitter(t){
  if (!lainImg || !running) { requestAnimationFrame(jitter); return; }

  // ~30fps
  if (t - last < 33) { requestAnimationFrame(jitter); return; }
  last = t;

  const b = (window.__noiseBoost || 0);
  const x = (Math.random()*2 - 1) * (1 + b*2);
  const y = (Math.random()*2 - 1) * (1 + b*2);
  const r = (Math.random()*0.6 - 0.3) * (1 + b);
  lainImg.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;

  requestAnimationFrame(jitter);
}
requestAnimationFrame(jitter);

// boost on scroll (cap)
window.addEventListener("scroll", ()=>{
  window.__noiseBoost = Math.min(1, (window.__noiseBoost || 0) + 0.12);
}, { passive: true });
