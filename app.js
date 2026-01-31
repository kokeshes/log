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
    || window.navigator.standalone === true;
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

function getAction(){
  return new URL(location.href).searchParams.get("action");
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

const INSTALLED_ONLY_KIND = "Hidden";

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

  editorEl.innerHTML =
    `<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>`;
  editorEl.classList.add("locked");

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

/* ========= data ========= */
async function fetchLogs(){
  if (!currentUser) return;

  setStatus("SYNC…");

  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending:false });

  if (error){
    console.error(error);
    setStatus("ERR: " + error.message);
    return;
  }

  cache = data || [];
  console.log("LOGS:", cache);

  // ★ フィルタなしで必ず表示
  renderList(cache);

  setStatus(`SYNC OK // ${cache.length} logs`);
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
    setStatus("ERR: SAVE FAILED");
    alert("SAVE FAILED\n"+e.message);
  }
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
btnLogin.onclick = ()=>login();
btnSignup.onclick = ()=>signup();
btnLogout.onclick = ()=>logout();
btnRefresh.onclick = ()=>fetchLogs();
btnNew.onclick = ()=>newEditor($("#kind")?.value||"Note");

/* ========= init ========= */
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

const { data } = await supabase.auth.getSession();
await onSession(data.session);

supabase.auth.onAuthStateChange((_e, session)=>onSession(session));

// keep alive
setInterval(()=>supabase.auth.getSession(), 5*60*1000);
