// docs/noise.js
const canvas = document.getElementById("noise");
const ctx = canvas.getContext("2d", { alpha: true });

function resize(){
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
}
window.addEventListener("resize", resize);
resize();

let t = 0;
function draw(){
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const boost = window.__noiseBoost || 0;
  window.__noiseBoost = Math.max(0, boost - 0.03);

  const grain = 40 + boost * 120;

  for (let i=0; i<data.length; i+=4){
    const v = (Math.random()*grain)|0;
    data[i] = v;
    data[i+1] = v;
    data[i+2] = v;
    data[i+3] = 40;
  }
  ctx.putImageData(img, 0, 0);

  // occasional horizontal tear
  if (Math.random() < 0.08){
    const y = (Math.random()*h)|0;
    const hh = (Math.random()*20 + 6)|0;
    const xShift = ((Math.random()*30 - 15) * devicePixelRatio)|0;
    const slice = ctx.getImageData(0, y, w, hh);
    ctx.putImageData(slice, xShift, y);
  }

  t++;
  requestAnimationFrame(draw);
}
draw();
