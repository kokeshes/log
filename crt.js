// docs/crt.js
const glitch = document.querySelector(".glitch-layer");
const lainImg = document.getElementById("lainImg");

function pulse(){
  if (!glitch) return;
  glitch.style.opacity = "1";
  glitch.style.transform = `translate(${(Math.random()*8-4).toFixed(1)}px, ${(Math.random()*8-4).toFixed(1)}px)`;
  setTimeout(()=>{ glitch.style.opacity = "0"; }, 80 + Math.random()*120);
}

setInterval(()=>{
  if (Math.random() < 0.25) pulse();
}, 520);

// Lain-like apparition jitter (original character image)
function jitter(){
  if (!lainImg) return;
  const b = (window.__noiseBoost || 0);
  const x = (Math.random()*2 - 1) * (1 + b*2);
  const y = (Math.random()*2 - 1) * (1 + b*2);
  const r = (Math.random()*0.6 - 0.3) * (1 + b);
  lainImg.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
  requestAnimationFrame(jitter);
}
jitter();

// boost on scroll
window.addEventListener("scroll", ()=>{
  window.__noiseBoost = Math.min(1, (window.__noiseBoost || 0) + 0.15);
});
