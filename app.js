// docs/app.js
import { getSupabase } from "./supabase.js";

/* ========= helpers ========= */
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");

function setStatus(msg){
  if (statusEl) statusEl.textContent = msg;
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
  g.style.transform =
    `translate(${(Math.random()*6-3).toFixed(1)}px, ${(Math.random()*6-3).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 120);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function isAbortError(e){
  return e?.name === "AbortError"
    || String(e?.message || "").toLowerCase().includes("aborted");
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function sb(){ return getSupabase(); }

/* ========= BOOT ========= */
(function bootSequence(){
  try{ window.WiredAudio?.bootSound?.(); }catch{}
  const boot = document.getElementById("boot");
  if (boot) setTimeout(()=>boot.classList.add("hidden"), 1400);
})();

/* ========= DOM ========= */
const authBox = $("#authBox");
const navBox  = $("#navBox");
const whoEmail = $("#whoEmail");

const btnLogin   = $("#btnLogin");
const btnSignup  = $("#btnSignup");
const btnLogout  = $("#btnLogout");
const btnRefresh = $("#btnRefresh");
const btnNew     = $("#btnNew");

const emailEl = $("#email");
const passEl  = $("#password");

const listEl    = $("#list");
const editorEl  = $("#editor");
const editorTpl = $("#editorTpl");

const kindFilterEl = $("#kindFilter");
const qEl = $("#q");

/* ========= state ========= */
let currentUser = null;
let selected = null;   // current editor item (object)
let cache = [];        // logs
let authListenerBound = false;

/* ========= connectivity ========= */
addEventListener("offline", ()=>{
  showOfflineBanner(true);
  setStatus("NO CARRIER // OFFLINE");
});
addEventListener("online", ()=>{
  showOfflineBanner(false);
  setStatus("ONLINE // WIRED RESTORED");
});

/* ========= UI ========= */
function uiSignedOut(){
  authBox?.classList.remove("hidden");
  navBox?.classList.add("hidden");
  btnLogout?.classList.add("hidden");

  if (editorEl){
    editorEl.classList.add("locked");
    editorEl.innerHTML = `<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>`;
  }
  if (listEl){
    listEl.innerHTML = `<div class="empty-msg">NO DATA // WAITING FOR NODE SYNC</div>`;
  }
  if (whoEmail) whoEmail.textContent = "-";

  currentUser = null;
  selected = null;
  cache = [];
}

function uiSignedIn(user){
  authBox?.classList.add("hidden");
  navBox?.classList.remove("hidden");
  btnLogout?.classList.remove("hidden");
  editorEl?.classList.remove("locked");

  if (whoEmail) whoEmail.textContent = user.email ?? "(unknown)";
}

/* ========= Draft (autosave) ========= */
const DRAFT_KEY = "wired_draft_v1";

function draftId(){
  const uid = currentUser?.id || "anon";
  const sid = selected?.id ? String(selected.id) : "new";
  return `${uid}::${sid}`;
}

function readDraftAll(){
  try{ return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); }
  catch{ return {}; }
}

function writeDraftAll(obj){
  try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(obj)); }catch{}
}

function saveDraftNow(){
  const bodyEl = $("#body");
  const titleEl = $("#title");
  const kindEl = $("#kind");
  const tagsEl = $("#tags");
  const moodEl = $("#mood");
  if (!bodyEl || !titleEl || !kindEl || !tagsEl || !moodEl) return;

  const all = readDraftAll();
  all[draftId()] = {
    at: Date.now(),
    kind: kindEl.value,
    title: titleEl.value,
    tags: tagsEl.value,
    mood: moodEl.value,
    body: bodyEl.value
  };
  writeDraftAll(all);
}

function clearDraft(){
  const all = readDraftAll();
  delete all[draftId()];
  writeDraftAll(all);
}

function applyDraftIfAny(){
  const all = readDraftAll();
  const d = all[draftId()];
  if (!d) return;

  const bodyEl = $("#body");
  if (!bodyEl) return;

  // draft本文があるなら復元（確実に守る）
  if (!String(d.body || "").length) return;

  $("#kind").value  = d.kind ?? $("#kind").value;
  $("#title").value = d.title ?? $("#title").value;
  $("#tags").value  = d.tags ?? $("#tags").value;
  $("#mood").value  = d.mood ?? $("#mood").value;
  $("#body").value  = d.body ?? $("#body").value;

  setStatus("DRAFT RESTORED // RECOVERED");
  try{ window.WiredAudio?.errorSound?.(); }catch{}
}

let draftTimer = 0;
function hookDraftAutosave(){
  if (!editorEl) return;

  // editorElは毎回innerHTMLを作り直すので dataset を使って二重登録を防ぐ
  if (editorEl.dataset.draftHooked === "1") return;
  editorEl.dataset.draftHooked = "1";

  editorEl.addEventListener("input", ()=>{
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(()=>saveDraftNow(), 260);
  }, { passive: true });
}

/* ========= auth ========= */
async function login(){
  setStatus("LOGIN…");
  try{
    const { data, error } = await sb().auth.signInWithPassword({
      email: (emailEl?.value ?? "").trim(),
      password: passEl?.value ?? ""
    });
    if (error) throw error;

    glitchPulse();
    await onSession(data.session);

  }catch(e){
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "LOGIN FAILED"));
    try{ window.WiredAudio?.errorSound?.(); }catch{}
  }
}

async function signup(){
  setStatus("SIGNUP…");
  try{
    const { error } = await sb().auth.signUp({
      email: (emailEl?.value ?? "").trim(),
      password: passEl?.value ?? ""
    });
    if (error) throw error;

    setStatus("CHECK EMAIL // VERIFY");
    glitchPulse();
  }catch(e){
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "SIGNUP FAILED"));
    try{ window.WiredAudio?.errorSound?.(); }catch{}
  }
}

async function logout(){
  setStatus("LOGOUT…");
  try{ await sb().auth.signOut(); }catch{}
  uiSignedOut();
  setStatus("DISCONNECTED");
  glitchPulse();
}

/* ========= list ========= */
function filteredList(){
  const kind = kindFilterEl?.value ?? "ALL";
  const q = (qEl?.value ?? "").trim().toLowerCase();

  return cache.filter(it=>{
    if (kind !== "ALL" && it.kind !== kind) return false;
    if (!q) return true;
    const blob = `${it.kind} ${it.title} ${it.body} ${(it.tags||[]).join(" ")}`.toLowerCase();
    return blob.includes(q);
  });
}

function renderList(items){
  if (!listEl) return;

  if (!items.length){
    listEl.innerHTML = `<div class="empty-msg">NO DATA // CREATE FIRST LOG</div>`;
    return;
  }

  listEl.innerHTML = "";
  for (const it of items){
    const div = document.createElement("div");
    div.className = "item";
    div.dataset.id = it.id;

    const preview = (it.body || "").replace(/\s+/g," ").slice(0,120);
    const tags = (it.tags||[])
      .slice(0,4)
      .map(t=>`<span class="badge">#${escapeHtml(t)}</span>`)
      .join("");

    div.innerHTML = `
      <div class="k">${escapeHtml(it.kind)}${it.mood==null ? "" : ` // mood ${it.mood}`}</div>
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

/* ========= session keep-alive ========= */
async function softRefreshSession(){
  try{
    await sb().auth.refreshSession();
  }catch{
    // ignore (maintenance/offline/etc)
  }
}

async function ensureSessionOrThrow(){
  const { data, error } = await sb().auth.getSession();
  if (error) throw error;
  if (!data?.session) throw new Error("SESSION EXPIRED");
  currentUser = data.session.user;
  return data.session;
}

/* ========= data ========= */
async function fetchLogs({ retry = 2 } = {}){
  if (!currentUser) return;

  setStatus("SYNC…");

  try{
    // 放置復帰対策（失敗しても続行）
    await softRefreshSession();

    const { data, error } = await sb()
      .from("logs")
      .select("*")
      .order("created_at", { ascending:false })
      .limit(300);

    if (error) throw error;

    cache = data || [];
    renderList(filteredList());
    setStatus(`SYNC OK // ${cache.length} logs`);
    return;

  }catch(e){
    console.error(e);

    if (isAbortError(e) && retry > 0){
      setStatus("SYNC ABORTED // RETRY");
      await sleep(260);
      return fetchLogs({ retry: retry - 1 });
    }

    // maintenanceっぽい時に分かりやすく
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("maintenance")){
      setStatus("SUPABASE MAINTENANCE // WAIT");
      return;
    }

    setStatus("ERR: " + (e?.message ?? "SYNC FAILED"));
    try{ window.WiredAudio?.errorSound?.(); }catch{}
  }
}

/* ========= editor ========= */
function openEditor(it){
  selected = it;

  if (!editorEl || !editorTpl) return;

  editorEl.innerHTML = "";
  editorEl.appendChild(editorTpl.content.cloneNode(true));

  // editorEl再生成につきフック解除→再付与
  editorEl.dataset.draftHooked = "0";

  $("#kind").value  = it.kind ?? "Note";
  $("#title").value = it.title ?? "";
  $("#tags").value  = (it.tags||[]).join(", ");
  $("#mood").value  = (it.mood ?? "");
  $("#body").value  = it.body ?? "";

  // meta
  const meta = $("#metaLine");
  if (meta){
    const id = it.id ?? "-";
    const c = it.created_at ? new Date(it.created_at).toLocaleString() : "-";
    const u = it.updated_at ? new Date(it.updated_at).toLocaleString() : "-";
    meta.textContent = `id ${id} // created ${c} // updated ${u}`;
  }

  $("#btnSave").onclick = ()=>saveCurrent({ retry: 2 });
  $("#btnDelete").onclick = deleteCurrent;

  hookDraftAutosave();
  applyDraftIfAny();

  $("#body")?.focus();
  glitchPulse();
}

function newEditor(kind="Note"){
  openEditor({
    id: null,
    kind,
    title: "",
    body: "",
    tags: [],
    mood: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

/* ========= SAVE ========= */
async function saveCurrent({ retry = 2 } = {}){
  try{
    setStatus("SAVE…");

    // SAVE前に必ず下書き保存（守る）
    saveDraftNow();

    // 放置復帰対策（失敗しても続行）
    await softRefreshSession();

    // session保証（切れてたらここで止める）
    await ensureSessionOrThrow();

    if (!selected) throw new Error("EDITOR STATE LOST");

    const payload = {
      kind: $("#kind")?.value ?? "Note",
      title: ($("#title")?.value ?? "").trim(),
      body:  ($("#body")?.value ?? ""),
      tags:  ($("#tags")?.value ?? "").split(",").map(s=>s.trim()).filter(Boolean),
      mood:  ($("#mood")?.value ?? "") === "" ? null : Number($("#mood")?.value),
      user_id: currentUser.id,
    };

    // INSERT / UPDATE
    if (!selected.id){
      const { error } = await sb().from("logs").insert(payload);
      if (error) throw error;
    } else {
      const { error } = await sb().from("logs").update(payload).eq("id", selected.id);
      if (error) throw error;
    }

    // 成功したら draft を消す
    clearDraft();

    try{ window.WiredAudio?.saveSound?.(); }catch{}
    await fetchLogs({ retry: 2 });

    // 次のログへ（kind維持）
    newEditor(payload.kind);
    setStatus("READY // NEXT LOG");
    glitchPulse();

  }catch(e){
    console.error(e);

    if (isAbortError(e) && retry > 0){
      setStatus("SAVE ABORTED // RETRY");
      await sleep(260);
      return saveCurrent({ retry: retry - 1 });
    }

    if (String(e?.message || "").includes("SESSION EXPIRED")){
      setStatus("SESSION LOST // RELOGIN");
      try{ window.WiredAudio?.errorSound?.(); }catch{}
      alert("セッションが切れています。再ログインしてください。\n（本文は下書きとして保持されています）");
      return;
    }

    // maintenanceっぽい時
    const msg = String(e?.message || "");
    if (msg.toLowerCase().includes("maintenance")){
      setStatus("SUPABASE MAINTENANCE // WAIT");
      alert("Supabaseがメンテ中の可能性があります。\n（本文は下書きとして保持されています）");
      return;
    }

    setStatus("ERR: SAVE FAILED");
    try{ window.WiredAudio?.errorSound?.(); }catch{}
    alert("SAVE FAILED\n（本文は下書きとして保持されています）\n\n" + (e?.message ?? e));
  }
}

async function deleteCurrent(){
  if (!selected?.id) return;
  if (!confirm("DELETE LOG?")) return;

  setStatus("DELETE…");

  try{
    await softRefreshSession();
    await ensureSessionOrThrow();

    const { error } = await sb().from("logs").delete().eq("id", selected.id);
    if (error) throw error;

    clearDraft();
    await fetchLogs({ retry: 2 });
    newEditor();
    setStatus("DELETED.");
    glitchPulse();

  }catch(e){
    console.error(e);

    if (isAbortError(e)){
      setStatus("DELETE ABORTED // RETRY");
      alert("通信が一時的に切断されました。もう一度DELETEしてください。");
      return;
    }

    setStatus("ERR: " + (e?.message ?? "DELETE FAILED"));
    try{ window.WiredAudio?.errorSound?.(); }catch{}
  }
}

/* ========= session ========= */
async function onSession(session){
  if (!session?.user){
    uiSignedOut();
    return;
  }
  currentUser = session.user;
  uiSignedIn(currentUser);

  await fetchLogs({ retry: 2 });
  newEditor();
}

/* ========= events ========= */
btnLogin?.addEventListener("click", ()=>{
  try{ window.WiredAudio?.resumeAudio?.(); }catch{}
  login();
});

btnSignup?.addEventListener("click", signup);
btnLogout?.addEventListener("click", logout);

btnRefresh?.addEventListener("click", ()=>{
  glitchPulse();
  fetchLogs({ retry: 2 });
});

btnNew?.addEventListener("click", ()=>{
  glitchPulse();
  const k = $("#kind")?.value || "Note";
  newEditor(k);
});

kindFilterEl?.addEventListener("change", ()=> renderList(filteredList()));
qEl?.addEventListener("input", ()=> renderList(filteredList()));

/* ========= init ========= */
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

// 初期：セッション確認→UI反映
try{
  const { data } = await sb().auth.getSession();
  setStatus("BOOT CHECK // session=" + (data?.session ? "YES" : "NO"));
  await onSession(data.session);
}catch(e){
  console.error(e);
  uiSignedOut();
  setStatus("AUTH REQUIRED // CONNECT TO WIRED");
}

// onAuthStateChange は1回だけ
if (!authListenerBound){
  authListenerBound = true;
  sb().auth.onAuthStateChange((_event, session)=>{
    // awaitできないのでそのまま
    onSession(session);
  });
}

// keep alive（軽量）
setInterval(async ()=>{
  try{ await sb().auth.getSession(); }catch{}
}, 5 * 60 * 1000);
