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

/* Supabase getter (singleton) */
function sb(){ return getSupabase(); }

/* ========= optional probe ========= */
async function debugProbe(label){
  try{
    const { data, error } = await sb().auth.getSession();
    const has = !!data?.session;
    console.log(`[PROBE ${label}] session=`, has, data?.session?.user?.email, error || "");
  }catch(e){
    console.log(`[PROBE ${label}] ERR`, e);
  }
}

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

const listEl   = $("#list");
const editorEl = $("#editor");
const editorTpl = $("#editorTpl");

const kindFilterEl = $("#kindFilter");
const qEl = $("#q");

/* ========= state ========= */
let currentUser = null;
let selected = null;
let cache = [];

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

  if (!String(d.body || "").length) return;

  $("#kind").value  = d.kind ?? $("#kind").value;
  $("#title").value = d.title ?? $("#title").value;
  $("#tags").value  = d.tags ?? $("#tags").value;
  $("#mood").value  = d.mood ?? $("#mood").value;
  $("#body").value  = d.body ?? $("#body").value;

  setStatus("DRAFT RESTORED // RECOVERED");
}

let draftTimer = 0;
function hookDraftAutosave(){
  const root = editorEl;
  if (!root) return;
  if (root.dataset.draftHooked === "1") return;
  root.dataset.draftHooked = "1";

  root.addEventListener("input", ()=>{
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

/* ========= session helpers ========= */
async function softRefreshSession(){
  try{ await sb().auth.refreshSession(); }catch{}
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

    // セッション切れ
    if (String(e?.message || "").includes("JWT") || String(e?.message || "").includes("SESSION")){
      setStatus("SESSION LOST // RELOGIN");
      uiSignedOut();
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

  // hook reset OK（DOM作り直しのたびにdataset消える）
  editorEl.dataset.draftHooked = "0";

  $("#kind").value  = it.kind ?? "Note";
  $("#title").value = it.title ?? "";
  $("#tags").value  = (it.tags||[]).join(", ");
  $("#mood").value  = (it.mood ?? "");
  $("#body").value  = it.body ?? "";

  $("#btnSave").onclick = ()=>saveCurrent({ retry: 2 });
  $("#btnDelete").onclick = deleteCurrent;

  hookDraftAutosave();
  applyDraftIfAny();

  $("#body")?.focus();
  glitchPulse();
}

function newEditor(kind="Note"){
  openEditor({
    id:null,
    kind,
    title:"",
    body:"",
    tags:[],
    mood:null,
    created_at: new Date().toISOString()
  });
}

/* ========= SAVE ========= */
async function saveCurrent({ retry = 2 } = {}){
  try{
    setStatus("SAVE…");

    await softRefreshSession();
    await ensureSessionOrThrow();

    if (!selected) throw new Error("EDITOR STATE LOST");

    const payload = {
      kind: $("#kind")?.value ?? "Note",
      title: ($("#title")?.value ?? "").trim(),
      body:  ($("#body")?.value ?? ""),
      tags:  ($("#tags")?.value ?? "").split(",").map(s=>s.trim()).filter(Boolean),
      mood:  ($("#mood")?.value ?? "") === "" ? null : Number($("#mood")?.value),
      user_id: currentUser.id
    };

    if (!selected.id){
      const { error } = await sb().from("logs").insert(payload);
      if (error) throw error;
    } else {
      const { error } = await sb().from("logs").update(payload).eq("id", selected.id);
      if (error) throw error;
    }

    clearDraft();

    try{ window.WiredAudio?.saveSound?.(); }catch{}
    await fetchLogs({ retry: 2 });

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
      alert("セッションが切れています。再ログインしてください。\n（本文は下書きとして保持されています）");
      return;
    }

    setStatus("ERR: SAVE FAILED");
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
    setStatus("ERR: " + (e?.message ?? "DELETE FAILED"));
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
btnLogin?.addEventListener("click", ()=>login());
btnSignup?.addEventListener("click", ()=>signup());
btnLogout?.addEventListener("click", ()=>logout());
btnRefresh?.addEventListener("click", ()=>fetchLogs({ retry: 2 }));
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

try{
  // ★ 起動時に1回だけ client を作る
  const { data } = await sb().auth.getSession();
  await onSession(data.session);
}catch(e){
  console.error(e);
  uiSignedOut();
  setStatus("AUTH REQUIRED // CONNECT TO WIRED");
}

/* auth state updates（多重購読を避ける） */
let authSub = null;
try{
  authSub = sb().auth.onAuthStateChange((_event, session)=>{
    onSession(session);
  });
}catch{}

/* keep alive */
setInterval(async ()=>{
  try{ await sb().auth.getSession(); }catch{}
}, 5 * 60 * 1000);
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
const DRAFT_KEY = "wired_draft_v2";

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
  const root = editorEl;
  if (!root) return;
  if (root.dataset.draftHooked === "1") return;
  root.dataset.draftHooked = "1";

  root.addEventListener("input", ()=>{
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(()=>saveDraftNow(), 260);
  }, { passive: true });
}

/* ========= auth ========= */
async function login(){
  setStatus("LOGIN…");
  try{
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { error } = await supabase.auth.signUp({
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
  try{ await supabase.auth.signOut(); }catch{}
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

/* ========= session ========= */
async function ensureSession(){
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data?.session?.user) return null;
  return data.session;
}

/* ========= data ========= */
async function fetchLogs({ retry = 1 } = {}){
  if (!currentUser) return;

  setStatus("SYNC…");
  try{
    // ここで refreshSession を乱発しない（iOS/PC両方で不安定化しうる）
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending:false })
      .limit(300);

    if (error) throw error;

    cache = data || [];
    renderList(filteredList());
    setStatus(`SYNC OK // ${cache.length} logs`);
  }catch(e){
    console.error(e);

    if (isAbortError(e) && retry > 0){
      setStatus("SYNC ABORTED // RETRY");
      await sleep(350);
      return fetchLogs({ retry: retry - 1 });
    }

    // ここで「セッション切れ」も疑う
    const s = await ensureSession().catch(()=>null);
    if (!s){
      uiSignedOut();
      setStatus("SESSION LOST // RELOGIN");
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
  editorEl.dataset.draftHooked = "0";

  $("#kind").value  = it.kind ?? "Note";
  $("#title").value = it.title ?? "";
  $("#tags").value  = (it.tags||[]).join(", ");
  $("#mood").value  = (it.mood ?? "");
  $("#body").value  = it.body ?? "";

  $("#btnSave").onclick = ()=>saveCurrent({ retry: 1 });
  $("#btnDelete").onclick = deleteCurrent;

  hookDraftAutosave();
  applyDraftIfAny();

  $("#body")?.focus();
  glitchPulse();
}

function newEditor(kind="Note"){
  openEditor({
    id:null,
    kind,
    title:"",
    body:"",
    tags:[],
    mood:null,
    created_at: new Date().toISOString()
  });
}

/* ========= SAVE ========= */
async function saveCurrent({ retry = 1 } = {}){
  try{
    setStatus("SAVE…");

    const s = await ensureSession();
    if (!s){
      setStatus("SESSION LOST // RELOGIN");
      alert("セッションが切れています。再ログインしてください。\n（本文は下書きとして保持されています）");
      return;
    }
    currentUser = s.user;

    if (!selected) throw new Error("EDITOR STATE LOST");

    const payload = {
      kind: $("#kind")?.value ?? "Note",
      title: ($("#title")?.value ?? "").trim(),
      body:  ($("#body")?.value ?? ""),
      tags:  ($("#tags")?.value ?? "").split(",").map(s=>s.trim()).filter(Boolean),
      mood:  ($("#mood")?.value ?? "") === "" ? null : Number($("#mood")?.value),
      user_id: currentUser.id
    };

    let error;
    if (!selected.id){
      ({ error } = await supabase.from("logs").insert(payload));
    } else {
      ({ error } = await supabase.from("logs").update(payload).eq("id", selected.id));
    }
    if (error) throw error;

    clearDraft();
    try{ window.WiredAudio?.saveSound?.(); }catch{}
    await fetchLogs({ retry: 1 });

    newEditor(payload.kind);
    setStatus("READY // NEXT LOG");
    glitchPulse();
  }catch(e){
    console.error(e);

    if (isAbortError(e) && retry > 0){
      setStatus("SAVE ABORTED // RETRY");
      await sleep(350);
      return saveCurrent({ retry: retry - 1 });
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
    const s = await ensureSession();
    if (!s){
      uiSignedOut();
      setStatus("SESSION LOST // RELOGIN");
      return;
    }
    currentUser = s.user;

    const { error } = await supabase.from("logs").delete().eq("id", selected.id);
    if (error) throw error;

    clearDraft();
    await fetchLogs({ retry: 1 });
    newEditor();
    setStatus("DELETED.");
    glitchPulse();
  }catch(e){
    console.error(e);
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

  await fetchLogs({ retry: 1 });
  newEditor();
}

/* ========= events ========= */
btnLogin?.addEventListener("click", login);
btnSignup?.addEventListener("click", signup);
btnLogout?.addEventListener("click", logout);
btnRefresh?.addEventListener("click", ()=>fetchLogs({ retry: 1 }));
btnNew?.addEventListener("click", ()=>{
  glitchPulse();
  newEditor($("#kind")?.value || "Note");
});

kindFilterEl?.addEventListener("change", ()=> renderList(filteredList()));
qEl?.addEventListener("input", ()=> renderList(filteredList()));

/* ========= init ========= */
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

try{
  const { data } = await supabase.auth.getSession();
  await onSession(data.session);
}catch(e){
  console.error(e);
  uiSignedOut();
  setStatus("AUTH REQUIRED // CONNECT TO WIRED");
}

supabase.auth.onAuthStateChange((_event, session)=>{
  onSession(session);
});

// keep alive（軽め）
setInterval(async ()=>{
  try{ await supabase.auth.getSession(); }catch{}
}, 5 * 60 * 1000);
