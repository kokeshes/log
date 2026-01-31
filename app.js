// docs/app.js (RESTORE MODE)
// 目的：SWやJSエラーで“何も出ない”状態を終わらせる。
// Supabaseは後から戻す。まずUIを生かす。

const $ = (s) => document.querySelector(s);

const boot = $("#boot");
const bootErr = $("#bootErr");
const btnHardReload = $("#btnHardReload");

const offline = $("#offline");
const statusEl = $("#status");

const authBox = $("#authBox");
const navBox  = $("#navBox");
const whoEmail = $("#whoEmail");

const btnRefresh = $("#btnRefresh");
const btnLogout  = $("#btnLogout");
const btnLogin   = $("#btnLogin");
const btnSignup  = $("#btnSignup");
const btnNew     = $("#btnNew");

const listEl   = $("#list");
const editorEl = $("#editor");
const editorTpl = $("#editorTpl");

function setStatus(msg){
  if (statusEl) statusEl.textContent = msg;
}
function showBootError(msg){
  if (bootErr) bootErr.textContent = msg;
  console.error(msg);
}
function hideBoot(){
  if (boot) boot.classList.add("hidden");
}
function showOffline(on){
  offline?.classList.toggle("hidden", !on);
}

/* ====== HARD RELOAD (SW purge) ======
   iPhone “ホームに追加”で一番効くのは SW を殺してから reload。
*/
async function hardReload(){
  try{
    setStatus("HARD RELOAD…");
    if ("serviceWorker" in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ("caches" in window){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // 少しだけキャッシュバスター
    location.href = location.pathname + "?r=" + Date.now();
  }catch(e){
    showBootError("HARD RELOAD FAILED:\n" + (e?.message ?? e));
  }
}
btnHardReload?.addEventListener("click", hardReload);

/* ====== minimal noise canvas (safe) ====== */
(function noise(){
  const c = $("#noise");
  if (!c) return;
  const ctx = c.getContext("2d");
  function resize(){
    c.width = Math.floor(innerWidth * (devicePixelRatio||1));
    c.height= Math.floor(innerHeight* (devicePixelRatio||1));
  }
  addEventListener("resize", resize);
  resize();
  let t=0;
  function loop(){
    t++;
    const w=c.width, h=c.height;
    const img = ctx.createImageData(120, 90);
    const d = img.data;
    for(let i=0;i<d.length;i+=4){
      const v = (Math.random()*255)|0;
      d[i]=v; d[i+1]=v; d[i+2]=v; d[i+3]=40;
    }
    ctx.putImageData(img,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(c,0,0,120,90,0,0,w,h);
    requestAnimationFrame(loop);
  }
  loop();
})();

/* ====== UI state (RESTORE) ====== */
function uiSignedOut(){
  authBox?.classList.remove("hidden");
  navBox?.classList.add("hidden");
  btnLogout?.classList.add("hidden");
  if (whoEmail) whoEmail.textContent = "-";

  if (editorEl){
    editorEl.classList.add("locked");
    editorEl.innerHTML = '<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>';
  }
  if (listEl){
    listEl.classList.add("empty");
    listEl.innerHTML = '<div class="empty-msg">NO DATA // WAITING FOR NODE SYNC</div>';
  }
}

function uiSignedIn(email="(local)"){
  authBox?.classList.add("hidden");
  navBox?.classList.remove("hidden");
  btnLogout?.classList.remove("hidden");
  if (whoEmail) whoEmail.textContent = email;

  editorEl?.classList.remove("locked");
}

/* ====== local mode auth (temporary) ======
   まず“ログイン画面が出る＆押せる”を取り戻す
*/
const LOCAL_AUTH_KEY = "wired_local_authed_v1";

function isAuthed(){
  try{ return localStorage.getItem(LOCAL_AUTH_KEY) === "1"; }catch{ return false; }
}
function setAuthed(on){
  try{ localStorage.setItem(LOCAL_AUTH_KEY, on ? "1" : "0"); }catch{}
}

function openEditorEmpty(){
  if (!editorEl || !editorTpl) return;
  editorEl.innerHTML = "";
  editorEl.appendChild(editorTpl.content.cloneNode(true));

  $("#metaLine").textContent = "local restore // no sync";
  $("#btnSave").onclick = ()=>{
    setStatus("RESTORE MODE // SAVE DISABLED");
    alert("復旧モード：いまはSAVEを無効化しています。\n（UI復旧後にSupabaseを戻す）");
  };
  $("#btnDelete").onclick = ()=>{
    setStatus("RESTORE MODE // DELETE DISABLED");
  };
}

function renderListDummy(){
  if (!listEl) return;
  listEl.classList.add("empty");
  listEl.innerHTML = '<div class="empty-msg">RESTORE MODE // SYNC DISABLED</div>';
}

/* ====== events ====== */
btnLogin?.addEventListener("click", ()=>{
  setAuthed(true);
  uiSignedIn("LOCAL NODE");
  openEditorEmpty();
  renderListDummy();
  setStatus("CONNECTED (LOCAL) // UI RESTORED");
});

btnSignup?.addEventListener("click", ()=>{
  alert("復旧モード：まずUIを戻しています。\nSupabaseは次の段階で復旧します。");
});

btnLogout?.addEventListener("click", ()=>{
  setAuthed(false);
  uiSignedOut();
  setStatus("DISCONNECTED");
});

btnRefresh?.addEventListener("click", ()=>{
  setStatus("RESTORE MODE // NO SYNC");
});

btnNew?.addEventListener("click", ()=>{
  openEditorEmpty();
  setStatus("READY // NEW (LOCAL)");
});

/* ====== connectivity ====== */
addEventListener("offline", ()=>{
  showOffline(true);
  setStatus("NO CARRIER // OFFLINE");
});
addEventListener("online", ()=>{
  showOffline(false);
  setStatus("ONLINE // WIRED RESTORED");
});

/* ====== global error trap (最重要) ====== */
window.addEventListener("error", (ev)=>{
  showBootError("JS ERROR:\n" + (ev?.message ?? ev));
});
window.addEventListener("unhandledrejection", (ev)=>{
  showBootError("PROMISE REJECTION:\n" + (ev?.reason?.message ?? ev?.reason ?? ev));
});

/* ====== boot ====== */
(function bootSequence(){
  setStatus("BOOT…");
  showOffline(!navigator.onLine);

  // 「必ずUIが見える」ことが復旧の目的
  try{
    if (isAuthed()){
      uiSignedIn("LOCAL NODE");
      openEditorEmpty();
      renderListDummy();
      setStatus("CONNECTED (LOCAL) // UI RESTORED");
    }else{
      uiSignedOut();
      setStatus("AUTH GATE // READY");
    }

    // ここが落ちても boot は必ず消す
    setTimeout(hideBoot, 700);
  }catch(e){
    showBootError("BOOT FAILED:\n" + (e?.message ?? e));
    // 失敗しても boot は残してメッセージ表示（真っ暗回避）
  }
})();
