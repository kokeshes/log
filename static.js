// docs/static.js
(() => {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const canvas = $("#staticCanvas");
  const blink  = $("#blinkLayer");
  const shadowImg = $("#shadowImg");
  const diag = $("#diag");

  const ctx  = canvas?.getContext("2d", { alpha:false });
  const bctx = blink?.getContext("2d", { alpha:true });

  const btnEnable = $("#btnEnable");
  const btnToggle = $("#btnToggle");
  const btnBurst  = $("#btnBurst");
  const btnCalm   = $("#btnCalm");
  const btnUI     = $("#btnUI");

  const vIntensity = $("#vIntensity");
  const vGlitch    = $("#vGlitch");
  const aVol       = $("#aVol");
  const aTone      = $("#aTone");

  const DIAG = (t)=>{ if(diag) diag.textContent = t; };

  if (!canvas || !blink || !ctx) {
    console.warn("[STATIC] canvas missing");
    DIAG("ERR // CANVAS MISSING");
    return;
  }

  /* =========================
     STATE
  ========================= */
  let enabled = false;
  let raf = 0;

  let intensity = 0.70; // 0..1
  let glitch    = 0.38; // 0..1
  let volume    = 0.26; // 0..1
  let tone      = 0.36; // 0..1

  let burst = 0;        // 0..1
  let uiOn  = true;

  /* =========================
     RESIZE
  ========================= */
  function resize(){
    const w = Math.max(1, innerWidth);
    const h = Math.max(1, innerHeight);
    canvas.width = w;
    canvas.height = h;
    blink.width = w;
    blink.height = h;
  }
  resize();
  addEventListener("resize", resize, { passive:true });

  /* =========================
     LAIN LINES (GHOST TEXT)
     - 「焼き付け」じゃなく寿命を持つオブジェクトで描く
  ========================= */
  const LAIN_LINE = [
    "PRESENT TIME. PRESENT DAY.",
    "YOU ARE CONNECTED.",
    "DO NOT PANIC. OBSERVE.",
    "THE WIRED IS ALWAYS LISTENING.",
    "NO CARRIER // DREAMING",
    "LAYER 11 // RESIDUAL SIGNAL",
    "make me sad",
    "make me mad",
    "make me feel alright"
  ];

  const ghosts = []; // {text,x,y,vx,vy,life,max,alpha,sz}
  const MAX_GHOSTS = 18;

  function spawnGhost({ strong = false } = {}){
    const text = LAIN_LINE[(Math.random()*LAIN_LINE.length)|0];

    const w = canvas.width, h = canvas.height;
    const x = Math.random() * (w * 0.92) + w * 0.04;
    const y = Math.random() * (h * 0.88) + h * 0.08;

    const base = strong ? 1.0 : 0.6;
    const max = 45 + Math.random()*55 + base*40; // frames-ish
    const vx  = (Math.random()*2 - 1) * (0.25 + glitch*0.9);
    const vy  = (Math.random()*2 - 1) * (0.18 + glitch*0.7);

    ghosts.push({
      text, x, y,
      vx, vy,
      life: 0,
      max,
      alpha: 0.0,
      sz: 11 + Math.floor(Math.random()*3) // 11..13
    });

    while (ghosts.length > MAX_GHOSTS) ghosts.shift();
  }

  function drawGhosts(){
    if (!ghosts.length) return;

    for (let i = ghosts.length - 1; i >= 0; i--){
      const g = ghosts[i];

      // life progress 0..1
      g.life += 1;
      const p = g.life / g.max;

      // fade in then fade out
      const fadeIn  = Math.min(1, p * 6);
      const fadeOut = Math.min(1, (1 - p) * 2.2);
      const a = Math.max(0, Math.min(1, fadeIn * fadeOut));

      g.alpha = a;

      g.x += g.vx;
      g.y += g.vy;

      // wrap softly
      if (g.x < -50) g.x = canvas.width + 30;
      if (g.x > canvas.width + 50) g.x = -30;
      if (g.y < -30) g.y = canvas.height + 20;
      if (g.y > canvas.height + 30) g.y = -20;

      ctx.save();
      ctx.font = `${g.sz}px ui-monospace, Menlo, Consolas, monospace`;

      // “溶け込む”色：薄い緑〜白、影も薄め
      const baseA = (0.08 + intensity*0.14 + burst*0.18) * g.alpha;
      ctx.fillStyle = `rgba(170,255,220,${baseA.toFixed(3)})`;
      ctx.shadowColor = "rgba(120,255,220,.30)";
      ctx.shadowBlur = 10 + burst*10;

      // 微妙な横ズレでゴースト感
      const jx = (Math.random()*2 - 1) * (0.3 + glitch*1.0);
      const jy = (Math.random()*2 - 1) * (0.2 + glitch*0.7);

      ctx.fillText(g.text, g.x + jx, g.y + jy);
      ctx.restore();

      if (p >= 1) ghosts.splice(i, 1);
    }
  }

  /* =========================
     TEXT SCRAMBLE (DOM) ✅超安全版
     - “要素”じゃなく “テキストノード”だけ一瞬差し替える
     - input/label構造は絶対に壊れない
  ========================= */
  const SCRAMBLE_CHARS = "▓▒░█#@$%&*+-=/\\<>";

  // スクランブル対象は「画面上の文字」全体に寄せる（退化回避）
  // ただしテキストノードのみを触るのでUIは壊れない
  const SCRAMBLE_CONTAINER_SELECTOR =
    ".wired-scramble,[data-ui-scramble='1'],[data-scramble='1'],#diag,.scramble-pill,.static-title";

  const origText = new WeakMap();   // TextNode -> original string
  const restoreTimers = new WeakMap(); // TextNode -> timeout id

  function collectTextNodes(){
    const nodes = [];
    const containers = $$(SCRAMBLE_CONTAINER_SELECTOR);

    for (const root of containers){
      if (!root) continue;

      // TreeWalkerで TextNode だけ集める
      const tw = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node){
            const v = (node.nodeValue ?? "");
            // 空/空白だけは除外
            if (!v.trim()) return NodeFilter.FILTER_REJECT;
            // 長すぎるのも除外（見た目が重い）
            if (v.length > 120) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let n;
      while ((n = tw.nextNode())){
        nodes.push(n);
        if (!origText.has(n)) origText.set(n, n.nodeValue);
      }
    }
    return nodes;
  }

  // 毎フレーム集めると重いのでキャッシュ
  let textNodeCache = [];
  let cacheAt = 0;

  function getTextNodesCached(){
    const now = performance.now();
    if (!textNodeCache.length || (now - cacheAt) > 1800){
      textNodeCache = collectTextNodes();
      cacheAt = now;
    }
    return textNodeCache;
  }

  function scrambleTextNode(node){
    const original = origText.get(node) ?? node.nodeValue ?? "";
    const len = original.length;
    if (len <= 0) return;

    // すでに復元待ちなら上書きしない（チラつき制御）
    if (restoreTimers.has(node)) return;

    let s = "";
    for (let i=0;i<len;i++){
      s += SCRAMBLE_CHARS[(Math.random()*SCRAMBLE_CHARS.length)|0];
    }
    node.nodeValue = s;

    const t = setTimeout(() => {
      node.nodeValue = (origText.get(node) ?? original);
      restoreTimers.delete(node);
    }, 35 + Math.random()*85);

    restoreTimers.set(node, t);
  }

  function randomScramble(){
    // glitch値が高いほど頻度UP
    const p = 0.06 + glitch*0.22 + burst*0.18;
    if (Math.random() > p) return;

    const nodes = getTextNodesCached();
    if (!nodes.length) return;

    // 一回に1〜2箇所（重いと感じたら1に）
    const k = (Math.random() < (0.35 + glitch*0.25)) ? 2 : 1;
    for (let i=0;i<k;i++){
      const node = nodes[(Math.random()*nodes.length)|0];
      if (node) scrambleTextNode(node);
    }
  }

  /* =========================
     AUDIO / UI
  ========================= */
  function syncUI(){
    if(vIntensity) intensity = vIntensity.value/100;
    if(vGlitch)    glitch    = vGlitch.value/100;
    if(aVol)       volume    = aVol.value/100;
    if(aTone)      tone      = aTone.value/100;

    try{ window.WiredAudio?.set?.({ volume, tone }); }catch{}
  }

  vIntensity?.addEventListener("input", syncUI);
  vGlitch?.addEventListener("input", syncUI);
  aVol?.addEventListener("input", syncUI);
  aTone?.addEventListener("input", syncUI);

  function setUI(on){
    uiOn = !!on;
    document.body.classList.toggle("ui-off", !uiOn);
    if(btnUI) btnUI.textContent = uiOn ? "UI: ON" : "UI: OFF";
  }

  function start(){
    if(enabled) return;
    enabled = true;
    if(btnToggle) btnToggle.textContent = "STOP";
    DIAG("STATIC ONLINE");
    // 起動時に少しだけ演出
    burst = Math.min(1, burst + 0.25);
    spawnGhost({ strong:true });
  }

  function stop(){
    enabled = false;
    if(btnToggle) btnToggle.textContent = "START";
    DIAG("STATIC STANDBY");
  }

  function toggle(){ enabled ? stop() : start(); }

  function burstNow(){
    burst = Math.min(1, burst + 0.55);
    try{ window.WiredAudio?.burst?.(); }catch{}
    // burst時は複数ゴーストを飛ばす
    spawnGhost({ strong:true });
    if (Math.random() < 0.7) spawnGhost({ strong:true });
  }

  function calm(){
    burst = 0;
    try{ window.WiredAudio?.calm?.(); }catch{}
  }

  // iOSで click が遅延/スクロール扱いされるのを避ける
  const press = (el, fn) => {
    if(!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    }, { passive:false });
  };

  press(btnToggle, () => toggle());
  press(btnBurst,  () => burstNow());
  press(btnCalm,   () => calm());
  press(btnUI,     () => setUI(!uiOn));

  // ENABLE AUDIO: UIを絶対壊さない（setUI(true)固定）
  press(btnEnable, async () => {
    try{
      if(!window.WiredAudio){
        DIAG("AUDIO MISSING // load audio.js");
        return;
      }
      DIAG("AUDIO UNLOCK…");
      await window.WiredAudio.start?.();
      await window.WiredAudio.staticNoise?.();
      syncUI();
      setUI(true);
      DIAG("AUDIO OK");
    }catch(e){
      setUI(true);
      DIAG("AUDIO ERR // " + (e?.message || e));
      try{ console.warn(e); }catch{}
    }
  });

  /* =========================
     NOISE DRAW
     - ちゃんと「動いてる」感を戻す
  ========================= */
  function drawNoise(){
    const w = canvas.width, h = canvas.height;

    // “残像”を残しつつ毎フレーム更新（チラつきの核）
    const fade = 0.18 + (1 - intensity)*0.10; // intensity高いと残像長い
    ctx.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`;
    ctx.fillRect(0,0,w,h);

    // ドット
    const dots = enabled
      ? (1400 + intensity*7200 + burst*7200)
      : 900; // standbyでも少し動かす（止まった感をなくす）

    for(let i=0;i<dots;i++){
      const x = (Math.random()*w)|0;
      const y = (Math.random()*h)|0;
      const a = enabled
        ? (0.03 + Math.random()*0.28 + burst*0.30)
        : (0.02 + Math.random()*0.10);

      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(x,y,1,1);
    }

    // 横方向のtear（PS1っぽいズレ）
    if (Math.random() < (0.05 + glitch*0.10 + burst*0.10)) {
      const y = (Math.random()*h)|0;
      const hh = (6 + Math.random()*18)|0;
      const xShift = ((Math.random()*34 - 17) * (1 + glitch*2))|0;
      const slice = ctx.getImageData(0, y, w, hh);
      ctx.putImageData(slice, xShift, y);
    }

    // ブリンクレイヤ（白飛び）
    if (Math.random() < (0.03 + glitch*0.06 + burst*0.12)) {
      blink.classList.add("on");
      setTimeout(()=>blink.classList.remove("on"), 40 + Math.random()*80);
    }

    // 影の出現
    if (shadowImg) {
      const p = enabled ? (0.02 + burst*0.08 + glitch*0.04) : 0.01;
      shadowImg.classList.toggle("on", Math.random() < p);
    }
  }

  /* =========================
     MAIN LOOP
  ========================= */
  function tick(){
    // ノイズは常時（止まった感を消す）
    drawNoise();

    // enabledのときだけ“事件”を増やす
    if (enabled) {
      // たまにゴースト文字（溶ける）
      if (Math.random() < (0.012 + intensity*0.02 + burst*0.04)) spawnGhost();

      // ゴースト描画（enabledでもstandbyでも描く）
      drawGhosts();

      // DOM文字化け
      randomScramble();

      // burst減衰
      burst = Math.max(0, burst - 0.014);
    } else {
      // standbyでもゴーストは少し残る
      drawGhosts();
      burst = Math.max(0, burst - 0.02);
      // standby中も軽くscramble（“生きてる”感）
      if (Math.random() < 0.03) randomScramble();
    }

    raf = requestAnimationFrame(tick);
  }

  /* =========================
     INIT
  ========================= */
  DIAG("STATIC READY // ENABLE AUDIO");
  syncUI();
  setUI(true);

  // ループは常に回す（止まった感を完全に消す）
  if (!raf) raf = requestAnimationFrame(tick);

  // ログイン完了イベントで自動起動（従来どおり）
  addEventListener("wired-user-ready", () => start());

  // 画面復帰で音が止まる対策（iOS）
  document.addEventListener("visibilitychange", async () => {
    if(document.visibilityState !== "visible") return;
    try{ await window.WiredAudio?.start?.(); }catch{}
  });
})();
