// docs/static.js
(() => {
  const $ = (s) => document.querySelector(s);

  const canvas = $("#staticCanvas");
  const ctx = canvas?.getContext("2d", { alpha:false });
  const blinkCanvas = $("#blinkLayer");
  const bctx = blinkCanvas?.getContext("2d", { alpha:true });
  const shadowImg = $("#shadowImg");
  const diag = $("#diag");

  let enabled = false;
  let burst = 0;

  function resize(){
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas){ canvas.width = w; canvas.height = h; }
    if (blinkCanvas){ blinkCanvas.width = w; blinkCanvas.height = h; }
  }

  function noise(){
    if (!enabled || !ctx) return;
    const w = canvas.width, h = canvas.height;

    for (let i=0;i<800;i++){
      const x = Math.random()*w;
      const y = Math.random()*h;
      const a = 0.02 + Math.random()*0.15 + burst*0.2;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x,y,1,1);
    }

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0,0,w,h);

    if (bctx && Math.random() < 0.04){
      bctx.fillStyle = "rgba(255,255,255,0.2)";
      bctx.fillRect(0,0,w,h);
      setTimeout(()=>bctx.clearRect(0,0,w,h),80);
    }

    if (shadowImg){
      shadowImg.style.opacity = Math.random() < 0.03 ? "0.18" : "0";
    }

    burst = Math.max(0, burst - 0.01);
  }

  function loop(){
    noise();
    requestAnimationFrame(loop);
  }

  function start(){
    if (enabled) return;
    enabled = true;
    resize();
    loop();
    diag && (diag.textContent = "STATIC ONLINE");
    try{ window.WiredAudio?.staticNoise?.(); }catch{}
  }

  // ★ ログイン完了イベントでのみ起動
  window.addEventListener("wired-user-ready", ()=>{
    start();
  });

  window.addEventListener("resize", resize);
})();
