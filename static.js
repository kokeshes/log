const badge = document.getElementById("diag");
const canvas = document.getElementById("staticCanvas");
const ctx = canvas.getContext("2d", { alpha:false });

function resize(){
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  badge.textContent = `JS OK // ${canvas.width}x${canvas.height} DPR${dpr}`;
}
addEventListener("resize", resize);
resize();

let t = 0;
function loop(){
  requestAnimationFrame(loop);
  t++;

  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const d = img.data;

  for(let i=0;i<d.length;i+=4){
    const v = Math.random()*255;
    d[i]   = v*0.9;
    d[i+1] = v*1.05; // greenish
    d[i+2] = v*0.95;
    d[i+3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  // text stamp
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(12, 44, 320, 34);
  ctx.fillStyle = "#9fffc9";
  ctx.font = `${14*Math.max(1, (window.devicePixelRatio||1))}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText("STATIC OK // DO NOT PANIC. OBSERVE.", 18, 66);
}
loop();
