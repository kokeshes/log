// docs/app.js
import { supabase } from "./supabase.js";

/* ========= helpers ========= */
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");

function setStatus(msg){
  if (statusEl) statusEl.textContent = msg;
}

function isStandalone(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true; // iOS
}

function showOfflineBanner(on){
  const el = document.getElementById("offline");
  if (!el) return;
  el.classList.toggle("hidden", !on);
}

function glitchPulse(){
  const g = document.querySelector(".glitch-layer");
  if (!g) return;
  g.style.opacity = "1";
  g.style.transform = `translate(${(Math.random()*6-3).toFixed(1)}px, ${(Math.random()*6-3).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 90 + Math.random()*120);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getAction(){
  const u = new URL(window.location.href);
  return u.searchParams.get("action");
}

/* ========= BOOT overlay (module-safe) ========= */
(function bootSequence(){
  // NOTE: 音はユーザー操作前に鳴らないことがある（iOS）ので、ここでは鳴らせたら鳴らす程度
  window.WiredAudio?.bootSound?.();

  const boot = document.getElementById("boot");
  if (boot){
    setTimeout(()=> boot.classList.add("hidden"), 1450);
  }
})();

/* ========= DOM refs ========= */
const authBox = $("#authBox");
const navBox  = $("#navBox");
const whoEmail = $("#whoEmail");

const btnLogout = $("#btnLogout");
const btnRefresh = $("#btnRefresh");

const emailEl = $("#email");
const passEl  = $("#password");
const btnLogin  = $("#btnLogin");
const btnSignup = $("#btnSignup");

const listEl   = $("#list");
const editorEl = $("#editor");
const editorTpl = $("#editorTpl");

const kindFilterEl = $("#kindFilter");
const qEl = $("#q");
const btnNew = $("#btnNew");
// ====== GHOST TRACE (local only) ======
const GHOST_KEY = "wired_ghost_trace_v1";
const GHOST_CH  = "wired_ghost_channel_v1";
const ghostChannel = ("BroadcastChannel" in window) ? new BroadcastChannel(GHOST_CH) : null;

const ghostBox = document.getElementById("ghostBox");
const ghostListEl = document.getElementById("ghostList");
const btnGhostClear = document.getElementById("btnGhostClear");
const btnGhostOpenStatic = document.getElementById("btnGhostOpenStatic");

function readGhostTrace(){
  try{ return JSON.parse(localStorage.getItem(GHOST_KEY) || "[]"); }catch{ return []; }
}

function renderGhostTrace(list){
  if (!ghostListEl) return;
  const items = Array.isArray(list) ? list : [];

  if (!items.length){
    ghostListEl.innerHTML = `<div class="ghost-empty">NO TRACE</div>`;
    return;
  }

  ghostListEl.innerHTML = items.slice(0, 20).map(it=>{
    const when = new Date(it.at).toLocaleString();
    const line = escapeHtml(it.line || "");
    return `
      <div class="ghost-item">
        <div>${line}</div>
        <div class="ghost-meta">${when} // ${escapeHtml(it.seed || "")}</div>
      </div>
    `;
  }).join("");
}

function refreshGhostTrace(){
  renderGhostTrace(readGhostTrace());
}

// 初期表示
refreshGhostTrace();

// クリア
btnGhostClear?.addEventListener("click", ()=>{
  localStorage.removeItem(GHOST_KEY);
  refreshGhostTrace();
  glitchPulse?.(); // あれば演出
});

// STATICへ飛ぶ
btnGhostOpenStatic?.addEventListener("click", ()=>{
  window.location.href = "./static.html";
});

// リアルタイム反映（STATICが開いてる時）
ghostChannel?.addEventListener("message", (ev)=>{
  if (ev?.data?.type === "ghost"){
    refreshGhostTrace();
    // ちょい演出
    try{ glitchPulse(); }catch{}
    try{ window.WiredAudio?.errorSound?.(); }catch{}
  }
});

// 別タブで localStorage が更新された時も拾う
window.addEventListener("storage", (e)=>{
  if (e.key === GHOST_KEY) refreshGhostTrace();
});

/* ========= state ========= */
let currentUser = null;
let selected = null;
let cache = [];

// PWA installed only "Hidden" kind
const INSTALLED_ONLY_KIND = "Hidden";

/* ========= connectivity ========= */
window.addEventListener("offline", ()=>{
  showOfflineBanner(true);
  setStatus("NO CARRIER // OFFLINE");
  window.WiredAudio?.setOffline?.(true);
});
window.addEventListener("online", ()=>{
  showOfflineBanner(false);
  setStatus("ONLINE // WIRED RESTORED");
  window.WiredAudio?.setOffline?.(false);
});

/* ========= UI states ========= */
function ensureInstalledKind(){
  if (!isStandalone()) return;

  const kf = document.getElementById("kindFilter");
  if (kf && !Array.from(kf.options).some(o=>o.value===INSTALLED_ONLY_KIND)){
    const opt = document.createElement("option");
    opt.value = INSTALLED_ONLY_KIND;
    opt.textContent = INSTALLED_ONLY_KIND;
    kf.appendChild(opt);
  }
}

function uiSignedOut(){
  authBox?.classList.remove("hidden");
  navBox?.classList.add("hidden");
  btnLogout?.classList.add("hidden");

  if (editorEl){
    editorEl.classList.add("locked");
    editorEl.innerHTML = '<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>';
  }
  if (listEl){
    listEl.classList.add("empty");
    listEl.innerHTML = '<div class="empty-msg">NO DATA // WAITING FOR NODE SYNC</div>';
  }
  if (whoEmail) whoEmail.textContent = "-";

  currentUser = null;
  cache = [];
  selected = null;
}

function uiSignedIn(user){
  authBox?.classList.add("hidden");
  navBox?.classList.remove("hidden");
  btnLogout?.classList.remove("hidden");

  editorEl?.classList.remove("locked");
  ensureInstalledKind();

  if (whoEmail) whoEmail.textContent = user.email ?? "(unknown)";
}

/* ========= auth ========= */
async function signup(){
  setStatus("SIGNUP…");
  const email = (emailEl?.value ?? "").trim();
  const password = passEl?.value ?? "";

  const { error } = await supabase.auth.signUp({ email, password });
  if (error){
    window.WiredAudio?.errorSound?.();
    setStatus("ERR: " + error.message);
    return;
  }

  setStatus("SIGNED UP. CHECK EMAIL IF REQUIRED.");
  glitchPulse();
}

async function login(){
  setStatus("LOGIN…");
  const email = (emailEl?.value ?? "").trim();
  const password = passEl?.value ?? "";

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error){
    window.WiredAudio?.errorSound?.();
    setStatus("ERR: " + error.message);
    return;
  }

  setStatus("CONNECTED.");
  glitchPulse();
  await onSession(data.session);
}

async function logout(){
  setStatus("LOGOUT…");
  const { error } = await supabase.auth.signOut();
  if (error){
    window.WiredAudio?.errorSound?.();
    setStatus("ERR: " + error.message);
    return;
  }
  setStatus("DISCONNECTED.");
  uiSignedOut();
  glitchPulse();
}

/* ========= list / filter ========= */
function filtered(){
  const kind = kindFilterEl?.value ?? "ALL";
  const q = (qEl?.value ?? "").trim().toLowerCase();

  return cache.filter(it=>{
    // NOTE: Hidden は DB 上 kind="Other" + tag "hidden"
    // filterでHiddenを見せたい場合だけ変換
    if (kind === INSTALLED_ONLY_KIND){
      return it.kind === "Other" && (it.tags||[]).includes("hidden");
    }
    if (kind !== "ALL" && it.kind !== kind) return false;

    if (!q) return true;
    const blob = `${it.kind} ${it.title} ${it.body} ${(it.tags||[]).join(" ")}`.toLowerCase();
    return blob.includes(q);
  });
}

function renderList(items){
  if (!listEl) return;

  if (!items.length){
    listEl.classList.add("empty");
    listEl.innerHTML = '<div class="empty-msg">NO DATA // CREATE FIRST LOG</div>';
    return;
  }

  listEl.classList.remove("empty");
  listEl.innerHTML = "";

  for (const it of items){
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = it.id;

    const preview = (it.body || "").replace(/\s+/g," ").slice(0, 120);
    const tags = (it.tags || []).slice(0,4).map(t=>`<span class="badge">#${escapeHtml(t)}</span>`).join("");

    div.innerHTML = `
      <div class="k">${escapeHtml(it.kind)}${it.mood===null||it.mood===undefined? "" : ` // mood ${it.mood}`}</div>
      <div class="t">${escapeHtml(it.title || "(no title)")}</div>
      <div class="m">${escapeHtml(preview)}</div>
      <div class="d">
        <span class="badge">${new Date(it.created_at).toLocaleString()}</span>
        ${tags}
      </div>
    `;
    div.addEventListener("click", ()=> openEditor(it));
    listEl.appendChild(div);
  }
}

async function fetchLogs(){
  if (!currentUser) return;

  setStatus("SYNC…");
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error){
    window.WiredAudio?.errorSound?.();
    setStatus("ERR: " + error.message);
    return;
  }

  cache = data || [];
  renderList(filtered());
  setStatus(`SYNC OK // ${cache.length} logs`);
}

/* ========= editor ========= */
function mapHiddenKind(kind, tags){
  if (kind === INSTALLED_ONLY_KIND){
    const t = Array.isArray(tags) ? tags.slice() : [];
    if (!t.includes("hidden")) t.unshift("hidden");
    return { kind: "Other", tags: t };
  }
  return { kind, tags };
}

function openEditor(it){
  selected = it;

  if (!editorEl || !editorTpl) return;

  editorEl.innerHTML = "";
  editorEl.appendChild(editorTpl.content.cloneNode(true));

  const isHidden = isStandalone() && (it.kind === "Other") && (it.tags||[]).includes("hidden");

  // KIND option injection
  const kindSel = $("#kind");
  if (isStandalone() && kindSel && !Array.from(kindSel.options).some(o=>o.value===INSTALLED_ONLY_KIND)){
    const opt = document.createElement("option");
    opt.value = INSTALLED_ONLY_KIND;
    opt.textContent = INSTALLED_ONLY_KIND;
    kindSel.appendChild(opt);
  }

  if (kindSel) kindSel.value = isHidden ? INSTALLED_ONLY_KIND : (it.kind ?? "Note");

  $("#title").value = it.title ?? "";
  $("#tags").value  = (it.tags || []).join(", ");
  if (isHidden){
    $("#tags").value = (it.tags||[]).filter(t=>t!=="hidden").join(", ");
  }
  $("#mood").value = (it.mood ?? "");
  $("#body").value = it.body ?? "";

  $("#metaLine").textContent =
    `id ${it.id ?? "-"} // created ${new Date(it.created_at).toLocaleString()} // updated ${new Date(it.updated_at).toLocaleString()}`;

  $("#btnSave").onclick = saveCurrent;
  $("#btnDelete").onclick = deleteCurrent;

  // focus for fast writing
  $("#body")?.focus();

  glitchPulse();
}

function newEditor(kindOverride = null){
  const kindValue = kindOverride ?? (
    getAction()==="counselling" ? "Counselling" :
    (getAction()==="hidden" && isStandalone() ? INSTALLED_ONLY_KIND : "Note")
  );

  openEditor({
    id: null,
    kind: kindValue,
    title: "",
    body: "",
    tags: [],
    mood: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/* ========= SAVE behavior: save -> immediate clear -> next log (keep kind) ========= */
/* ========= SAVE behavior: save -> immediate clear -> next log (keep kind) ========= */
async function saveCurrent(){
  // SAVE前：セッション確認（ついでに currentUser を確実に更新）
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

  if (sessionErr){
    setStatus("SESSION CHECK FAILED");
    window.WiredAudio?.errorSound();
    alert("セッション確認に失敗しました。通信状態を確認してください。");
    return;
  }

  const user = sessionData?.session?.user;
  if (!user){
    setStatus("SESSION EXPIRED // RECONNECT REQUIRED");
    window.WiredAudio?.errorSound();
    alert("セッションが切れています。再ログインしてください。\n（本文は消えていません）");
    return;
  }

  // ✅ currentUser をここで確定させる（放置復帰でnullのまま問題を潰す）
  currentUser = user;

  // selected が無い＝エディタがまだ開いてない/壊れてる
  if (!selected){
    setStatus("EDITOR STATE LOST // RELOAD");
    window.WiredAudio?.errorSound();
    alert("エディタ状態が失われました。ページを更新してください。\n（念のため本文をコピーしてから）");
    return;
  }

  setStatus("SAVE…");

  const keepKindUI = $("#kind")?.value ?? "Note"; // keep for next log
  // --- ここから下はあなたの既存の payload 生成に続けてOK ---

  const payload = {
    kind: mapped.kind,
    title: $("#title").value.trim(),
    body: $("#body").value,
    tags: mapped.tags,
    mood: $("#mood").value === "" ? null : Number($("#mood").value),
    user_id: currentUser.id,
  };

  // INSERT
  if (!selected.id){
    const { error } = await supabase.from("logs").insert(payload);

    if (error){
      window.WiredAudio?.errorSound?.();
      setStatus("ERR: " + error.message);
      return;
    }

    window.WiredAudio?.saveSound?.();
    window.WiredAudio?.applyMood?.(payload.mood);
    setStatus("SAVED (NEW).");
    glitchPulse();

    await fetchLogs();

    // next blank log
    window.WiredAudio?.applyMood?.(0);
    newEditor(keepKindUI);
    setStatus("READY // NEXT LOG");
    return;
  }

  // UPDATE
  const { error } = await supabase
    .from("logs")
    .update(payload)
    .eq("id", selected.id);

  if (error){
    window.WiredAudio?.errorSound?.();
    setStatus("ERR: " + error.message);
    return;
  }

  window.WiredAudio?.saveSound?.();
  window.WiredAudio?.applyMood?.(payload.mood);
  setStatus("SAVED (UPDATE).");
  glitchPulse();

  await fetchLogs();

  // next blank log (your requested behavior)
  window.WiredAudio?.applyMood?.(0);
  newEditor(keepKindUI);
  setStatus("READY // NEXT LOG");
}

async function deleteCurrent(){
  if (!currentUser || !selected?.id) return;
  if (!confirm("DELETE THIS LOG?")) return;

  setStatus("DELETE…");
  const { error } = await supabase.from("logs").delete().eq("id", selected.id);

  if (error){
    window.WiredAudio?.errorSound?.();
    setStatus("ERR: " + error.message);
    return;
  }

  setStatus("DELETED.");
  glitchPulse();

  selected = null;
  await fetchLogs();
  newEditor();
}

/* ========= session ========= */
async function onSession(session){
  if (!session?.user){
    uiSignedOut();
    return;
  }
  currentUser = session.user;
  uiSignedIn(currentUser);

  await fetchLogs();
  newEditor();
}

/* ========= events ========= */
btnSignup?.addEventListener("click", signup);

// ONE login handler (no duplicates)
btnLogin?.addEventListener("click", ()=>{
  window.WiredAudio?.resumeAudio?.();
  window.WiredAudio?.bootSound?.();
  login();
});

btnLogout?.addEventListener("click", logout);

btnRefresh?.addEventListener("click", async ()=>{
  glitchPulse();
  await fetchLogs();
});

btnNew?.addEventListener("click", ()=>{
  glitchPulse();
  newEditor($("#kind")?.value ?? null); // new log keeps current kind if editor exists
});

kindFilterEl?.addEventListener("change", ()=> renderList(filtered()));
qEl?.addEventListener("input", ()=> renderList(filtered()));

// Live noise intensity based on typing
document.addEventListener("input", ()=>{
  window.__noiseBoost = Math.min(1, (window.__noiseBoost || 0) + 0.2);
});

/* ========= init ========= */
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

const { data } = await supabase.auth.getSession();
await onSession(data.session);

supabase.auth.onAuthStateChange(async (_event, session)=>{
  await onSession(session);
});
