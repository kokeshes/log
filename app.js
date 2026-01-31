// docs/app.js
import { getSupabase, resetSupabase } from "./supabase.js";
const supabase = getSupabase();

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
  setTimeout(()=>{ g.style.opacity = "0"; }, 100);
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ========= BOOT ========= */
(function bootSequence(){
  window.WiredAudio?.bootSound?.();
  const boot = document.getElementById("boot");
  if (boot) setTimeout(()=>boot.classList.add("hidden"), 1400);
})();

/* ========= DOM ========= */
const authBox = $("#authBox");
const navBox = $("#navBox");
const whoEmail = $("#whoEmail");

const btnLogin = $("#btnLogin");
const btnSignup = $("#btnSignup");
const btnLogout = $("#btnLogout");
const btnRefresh = $("#btnRefresh");
const btnNew = $("#btnNew");

const emailEl = $("#email");
const passEl = $("#password");

const listEl = $("#list");
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

  editorEl.classList.add("locked");
  editorEl.innerHTML =
    `<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>`;

  listEl.innerHTML =
    `<div class="empty-msg">NO DATA // WAITING FOR NODE SYNC</div>`;

  whoEmail.textContent = "-";
  currentUser = null;
  selected = null;
  cache = [];
}

function uiSignedIn(user){
  authBox?.classList.add("hidden");
  navBox?.classList.remove("hidden");
  btnLogout?.classList.remove("hidden");
  editorEl.classList.remove("locked");
  whoEmail.textContent = user.email ?? "(unknown)";
}

/* ========= auth ========= */
async function login(){
  setStatus("LOGIN…");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passEl.value
  });
  if (error){
    setStatus("ERR: " + error.message);
    window.WiredAudio?.errorSound?.();
    return;
  }
  glitchPulse();
  await onSession(data.session);
}

async function signup(){
  setStatus("SIGNUP…");
  const { error } = await supabase.auth.signUp({
    email: emailEl.value.trim(),
    password: passEl.value
  });
  if (error){
    setStatus("ERR: " + error.message);
    return;
  }
  setStatus("CHECK EMAIL // VERIFY");
}

async function logout(){
  await supabase.auth.signOut();
  uiSignedOut();
  setStatus("DISCONNECTED");
}

/* ========= list ========= */
function renderList(items){
  if (!items.length){
    listEl.innerHTML =
      `<div class="empty-msg">NO DATA // CREATE FIRST LOG</div>`;
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
      <div class="k">${escapeHtml(it.kind)}</div>
      <div class="t">${escapeHtml(it.title || "(no title)")}</div>
      <div class="m">${escapeHtml(preview)}</div>
      <div class="d">
        <span class="badge">${new Date(it.created_at).toLocaleString()}</span>
        ${tags}
      </div>
    `;
    div.onclick = ()=>openEditor(it);
    listEl.appendChild(div);
  }
}

/* ========= data ========= */
async function fetchLogs(){
  if (!currentUser) return;

  setStatus("SYNC…");

  try{
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending:false });

    if (error) throw error;

    cache = data || [];
    renderList(cache);
    setStatus(`SYNC OK // ${cache.length} logs`);

  }catch(e){
    console.error(e);

    if (e.name === "AbortError"){
      setStatus("CONNECTION RESET // RETRY");
      resetSupabase();

      // 1回だけ自動リトライ
      setTimeout(async ()=>{
        try{
          const sb = getSupabase();
          const { data } = await sb.from("logs").select("*").order("created_at",{ascending:false});
          cache = data || [];
          renderList(cache);
          setStatus(`SYNC OK // ${cache.length} logs`);
        }catch(err){
          setStatus("SYNC FAILED // RELOAD");
        }
      }, 400);

      return;
    }

    setStatus("ERR: " + e.message);
  }
}
/* ========= editor ========= */
function openEditor(it){
  selected = it;

  editorEl.innerHTML = "";
  editorEl.appendChild(editorTpl.content.cloneNode(true));

  $("#kind").value = it.kind ?? "Note";
  $("#title").value = it.title ?? "";
  $("#tags").value = (it.tags||[]).join(", ");
  $("#mood").value = it.mood ?? "";
  $("#body").value = it.body ?? "";

  $("#btnSave").onclick = saveCurrent;
  $("#btnDelete").onclick = deleteCurrent;

  $("#body").focus();
}

function newEditor(kind="Note"){
  openEditor({
    id:null,
    kind,
    title:"",
    body:"",
    tags:[],
    mood:null
  });
}

/* ========= SAVE ========= */
async function saveCurrent(){
  try{
    setStatus("SAVE…");

    // ★ 放置対策：必ず refresh
    await supabase.auth.refreshSession();

    const { data } = await supabase.auth.getSession();
    if (!data.session){
      alert("SESSION EXPIRED // LOGIN AGAIN");
      return;
    }
    currentUser = data.session.user;

    const payload = {
      kind: $("#kind").value,
      title: $("#title").value.trim(),
      body: $("#body").value,
      tags: $("#tags").value.split(",").map(s=>s.trim()).filter(Boolean),
      mood: $("#mood").value==="" ? null : Number($("#mood").value),
      user_id: currentUser.id
    };

    if (!selected.id){
      const { error } = await supabase.from("logs").insert(payload);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("logs")
        .update(payload)
        .eq("id", selected.id);
      if (error) throw error;
    }

    window.WiredAudio?.saveSound?.();
    await fetchLogs();
    newEditor(payload.kind);
    setStatus("READY // NEXT LOG");

 }catch(e){
  console.error(e);

  if (e.name === "AbortError"){
    setStatus("CONNECTION LOST // RETRY SAVE");
    resetSupabase();
    alert(
      "通信が一時的に切断されました。\n" +
      "ページを更新せず、もう一度 SAVE を押してください。\n" +
      "（本文は保持されています）"
    );
    return;
  }

  setStatus("ERR: SAVE FAILED");
  alert("SAVE FAILED\n" + e.message);
}

async function deleteCurrent(){
  if (!selected?.id) return;
  if (!confirm("DELETE LOG?")) return;

  await supabase.from("logs").delete().eq("id", selected.id);
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
btnLogin.onclick = login;
btnSignup.onclick = signup;
btnLogout.onclick = logout;
btnRefresh.onclick = fetchLogs;
btnNew.onclick = ()=>newEditor($("#kind")?.value || "Note");

/* ========= init ========= */
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

const { data } = await supabase.auth.getSession();
await onSession(data.session);

supabase.auth.onAuthStateChange((_e, session)=>onSession(session));

// keep alive（軽量）
setInterval(()=>supabase.auth.getSession(), 5*60*1000);
