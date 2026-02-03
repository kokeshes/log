// log/app.js
import { getSupabase, resetSupabase } from "./supabase.js";

/* ========= DOM ========= */
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");
const loginView = $("#loginView");
const appView = $("#appView");
const emailEl = $("#email");
const passEl = $("#password");
const btnLogin = $("#btnLogin");
const btnLogout = $("#btnLogout");
const btnNew = $("#btnNew");
const btnSave = $("#btnSave");
const btnRefresh = $("#btnRefresh");
const listEl = $("#logList");
const editorEl = $("#editor");
const titleEl = $("#title");
const modeEl = $("#mode");

/* ========= state ========= */
let currentUser = null;
let currentMode = "log";
let currentId = null;

let _sessionLock = Promise.resolve();
function withSessionLock(fn){
  const next = _sessionLock.then(fn, fn);
  _sessionLock = next.catch(()=>{});
  return next;
}

function setStatus(msg){
  if (statusEl) statusEl.textContent = msg || "";
}
function showLogin(){
  loginView?.classList.remove("hidden");
  appView?.classList.add("hidden");
}
function showApp(){
  loginView?.classList.add("hidden");
  appView?.classList.remove("hidden");
}
function glitchPulse(){
  // 見た目演出（存在しなくてもOK）
  document.documentElement.classList.add("pulse");
  setTimeout(()=>document.documentElement.classList.remove("pulse"), 250);
}

function sb(){
  return getSupabase();
}

/* ========= robust session helpers ========= */
async function getSessionSafe(){
  try{
    const { data, error } = await sb().auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }catch(e){
    console.warn("[AUTH] getSession failed", e);
    return null;
  }
}

async function refreshThenGetSession(){
  try{
    await sb().auth.refreshSession();
  }catch(e){
    console.warn("[AUTH] refreshSession failed", e);
  }
  return await getSessionSafe();
}

// 「一瞬のSIGNED_OUT」を弾き返すための保険：数回だけ再取得して確定させる
async function confirmSignedOut(){
  for (let i=0; i<3; i++){
    const s = await refreshThenGetSession();
    if (s?.user) return false; // まだ生きてる
    await new Promise(r => setTimeout(r, 250 + i*250));
  }
  return true; // ほんとに死んでる
}

async function ensureSignedInOrThrow(){
  const session = await refreshThenGetSession();
  if (!session?.user) throw new Error("SESSION EXPIRED");
  currentUser = session.user;
  return session;
}

/* ========= UI ========= */
function renderList(rows){
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!rows?.length){
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No logs.";
    listEl.appendChild(li);
    return;
  }
  for (const r of rows){
    const li = document.createElement("li");
    li.className = "row";
    li.dataset.id = r.id;
    const t = (r.title || "").trim() || "(untitled)";
    const dt = r.created_at ? new Date(r.created_at).toLocaleString() : "";
    li.innerHTML = `<div class="t">${escapeHtml(t)}</div><div class="m">${escapeHtml(dt)}</div>`;
    li.addEventListener("click", ()=>openLog(r.id));
    listEl.appendChild(li);
  }
}

function fillEditor(row){
  currentId = row?.id ?? null;
  if (titleEl) titleEl.value = row?.title ?? "";
  if (editorEl) editorEl.value = row?.body ?? "";
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

/* ========= data ========= */
async function fetchLogs(){
  setStatus("SYNC…");
  const session = await ensureSignedInOrThrow();

  // ここが「ログ0」になるとき、実は権限/セッション問題で select が通ってない可能性がある
  const { data, error } = await sb()
    .from("logs")
    .select("id,title,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error){
    console.warn("[DB] fetchLogs error", error);
    setStatus("SYNC FAILED");
    throw error;
  }

  renderList(data || []);
  setStatus("OK");
  return data || [];
}

async function openLog(id){
  setStatus("OPEN…");
  await ensureSignedInOrThrow();
  const { data, error } = await sb()
    .from("logs")
    .select("id,title,body,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error){
    console.warn("[DB] openLog error", error);
    setStatus("OPEN FAILED");
    throw error;
  }

  fillEditor(data || { id:null, title:"", body:"" });
  setStatus("OK");
}

async function newLog(){
  fillEditor({ id:null, title:"", body:"" });
}

async function saveLog(){
  setStatus("SAVE…");
  await ensureSignedInOrThrow();

  const title = (titleEl?.value ?? "").trim();
  const body  = (editorEl?.value ?? "");
  const payload = { title, body };

  let res;
  if (currentId){
    res = await sb().from("logs").update(payload).eq("id", currentId).select("id").maybeSingle();
  }else{
    res = await sb().from("logs").insert(payload).select("id").maybeSingle();
  }

  if (res.error){
    console.warn("[DB] saveLog error", res.error);
    setStatus("SAVE FAILED");
    throw res.error;
  }

  currentId = res.data?.id ?? currentId;
  glitchPulse();
  await fetchLogs();
  setStatus("SAVED");
}

/* ========= auth ========= */
async function login(){
  setStatus("LOGIN…");
  const email = (emailEl?.value ?? "").trim();
  const password = passEl?.value ?? "";

  try{
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;

    // ログイン直後も一回 refresh→getSession を通して固める
    await ensureSignedInOrThrow();
    showApp();
    glitchPulse();
    await fetchLogs();
  }catch(e){
    console.warn("[AUTH] login error", e);
    setStatus("LOGIN FAILED");
    alert("Login failed: " + (e?.message || String(e)));
    showLogin();
  }
}

async function logout(){
  setStatus("LOGOUT…");
  try{
    await sb().auth.signOut();
  }catch(e){
    console.warn("[AUTH] signOut error", e);
  }finally{
    currentUser = null;
    currentId = null;
    showLogin();
    setStatus("");
  }
}

/* ========= boot ========= */
async function boot(){
  // actions
  btnLogin?.addEventListener("click", ()=>withSessionLock(login));
  btnLogout?.addEventListener("click", ()=>withSessionLock(logout));
  btnNew?.addEventListener("click", ()=>withSessionLock(newLog));
  btnSave?.addEventListener("click", ()=>withSessionLock(saveLog));
  btnRefresh?.addEventListener("click", ()=>withSessionLock(fetchLogs));

  // auth events（ここが今回のキモ）
  sb().auth.onAuthStateChange(async (event, session)=>{
    console.log("[AUTH]", event);

    if (session?.user){
      currentUser = session.user;
      showApp();
      return;
    }

    if (event === "SIGNED_OUT"){
      // 「本当に」サインアウトか確認してから UI を落とす（iOS abort 対策）
      const reallyOut = await confirmSignedOut();
      if (reallyOut){
        currentUser = null;
        showLogin();
        setStatus("");
      }else{
        // 復活した
        showApp();
        withSessionLock(fetchLogs);
      }
      return;
    }
  });

  // 初期セッション
  const s = await refreshThenGetSession();
  if (s?.user){
    currentUser = s.user;
    showApp();
    await fetchLogs();
  }else{
    showLogin();
  }

  // iOS対策：復帰時に固める
  document.addEventListener("visibilitychange", ()=>{
    if (!document.hidden){
      withSessionLock(async ()=>{
        const s2 = await refreshThenGetSession();
        if (s2?.user){
          showApp();
          await fetchLogs();
        }
      });
    }
  });
}

boot();
