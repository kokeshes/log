
// BOOT SCREEN
window.WiredAudio?.bootSound();
const boot = document.getElementById("boot");
if (boot){
  setTimeout(()=>{ boot.classList.add("hidden"); }, 1450);
}

// docs/app.js
import { supabase } from "./supabase.js";

const $ = (s) => document.querySelector(s);
const statusEl = $("#status");

const authBox = $("#authBox");
const navBox = $("#navBox");
const whoEmail = $("#whoEmail");
const btnLogout = $("#btnLogout");
const btnRefresh = $("#btnRefresh");

const emailEl = $("#email");
const passEl = $("#password");
const btnLogin = $("#btnLogin");
const btnSignup = $("#btnSignup");

const listEl = $("#list");
const editorEl = $("#editor");
const editorTpl = $("#editorTpl");

const kindFilterEl = $("#kindFilter");
const qEl = $("#q");
const btnNew = $("#btnNew");


function isStandalone(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true; // iOS
}

function showOfflineBanner(on){
  const el = document.getElementById("offline");
  if (!el) return;
  el.classList.toggle("hidden", !on);
}

window.addEventListener("offline", ()=>{ showOfflineBanner(true); setStatus("NO CARRIER // OFFLINE"); window.WiredAudio?.setOffline(true); });
window.addEventListener("online", ()=>{ showOfflineBanner(false); setStatus("ONLINE // WIRED RESTORED"); window.WiredAudio?.setOffline(false); });

let currentUser = null;
let selected = null;
let cache = [];

function setStatus(msg){ statusEl.textContent = msg; }


const INSTALLED_ONLY_KIND = "Hidden";
function ensureInstalledKind(){
  if (!isStandalone()) return;
  // add to KIND filter
  const kf = document.getElementById("kindFilter");
  if (kf && !Array.from(kf.options).some(o=>o.value===INSTALLED_ONLY_KIND)){
    const opt = document.createElement("option");
    opt.value = INSTALLED_ONLY_KIND;
    opt.textContent = INSTALLED_ONLY_KIND;
    kf.appendChild(opt);
  }
}


function glitchPulse(){
  const g = document.querySelector(".glitch-layer");
  g.style.opacity = "1";
  g.style.transform = `translate(${(Math.random()*6-3).toFixed(1)}px, ${(Math.random()*6-3).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 90 + Math.random()*120);
}

function uiSignedOut(){
  authBox.classList.remove("hidden");
  navBox.classList.add("hidden");
  btnLogout.classList.add("hidden");
  editorEl.classList.add("locked");
  editorEl.innerHTML = '<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>';
  listEl.classList.add("empty");
  listEl.innerHTML = '<div class="empty-msg">NO DATA // WAITING FOR NODE SYNC</div>';
  whoEmail.textContent = "-";
  currentUser = null;
  cache = [];
  selected = null;
}

function uiSignedIn(user){
  authBox.classList.add("hidden");
  navBox.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
  editorEl.classList.remove("locked");
  ensureInstalledKind();
  whoEmail.textContent = user.email ?? "(unknown)";
}

async function signup(){
  setStatus("SIGNUP…");
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
  setStatus("SIGNED UP. CHECK EMAIL IF REQUIRED.");
  glitchPulse();
}

async function login(){
  setStatus("LOGIN…");
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
  setStatus("CONNECTED.");
  glitchPulse();
  await onSession(data.session);
}

async function logout(){
  setStatus("LOGOUT…");
  const { error } = await supabase.auth.signOut();
  if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
  setStatus("DISCONNECTED.");
  uiSignedOut();
  glitchPulse();
}

function renderList(items){
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

function openEditor(it){
  selected = it;
  editorEl.innerHTML = "";
  const node = editorTpl.content.cloneNode(true);
  editorEl.appendChild(node);

  const isHidden = isStandalone() && (it.kind === 'Other') && (it.tags||[]).includes('hidden');
  const kindSel = $("#kind");
  if (isStandalone() && kindSel && !Array.from(kindSel.options).some(o=>o.value===INSTALLED_ONLY_KIND)){
    const opt = document.createElement('option'); opt.value = INSTALLED_ONLY_KIND; opt.textContent = INSTALLED_ONLY_KIND; kindSel.appendChild(opt);
  }
  kindSel.value = isHidden ? INSTALLED_ONLY_KIND : it.kind;
  $("#title").value = it.title ?? "";
  $("#tags").value = (it.tags || []).join(", ");
  if (isHidden) { $("#tags").value = (it.tags||[]).filter(t=>t!=='hidden').join(", "); }
  $("#mood").value = (it.mood ?? "");
  $("#body").value = it.body ?? "";
  $("#metaLine").textContent = `id ${it.id} // created ${new Date(it.created_at).toLocaleString()} // updated ${new Date(it.updated_at).toLocaleString()}`;

  $("#btnSave").onclick = saveCurrent;
  $("#btnDelete").onclick = deleteCurrent;

  glitchPulse();
}

function newEditor(){
  const it = {
    id: null,
    kind: (getAction()==="counselling" ? "Counselling" : (getAction()==="hidden" && isStandalone() ? INSTALLED_ONLY_KIND : "Note")),
    title: "",
    body: "",
    tags: [],
    mood: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  openEditor(it);
}


function getAction(){
  const u = new URL(window.location.href);
  return u.searchParams.get("action");
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function filtered(){
  const kind = kindFilterEl.value;
  const q = qEl.value.trim().toLowerCase();
  return cache.filter(it=>{
    if (kind !== "ALL" && it.kind !== kind) return false;
    if (!q) return true;
    const blob = `${it.kind} ${it.title} ${it.body} ${(it.tags||[]).join(" ")}`.toLowerCase();
    return blob.includes(q);
  });
}

async function fetchLogs(){
  if (!currentUser) return;
  setStatus("SYNC…");
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
  cache = data || [];
  renderList(filtered());
  setStatus(`SYNC OK // ${cache.length} logs`);
}


function mapHiddenKind(kind, tags){
  if (kind === INSTALLED_ONLY_KIND){
    const t = Array.isArray(tags) ? tags.slice() : [];
    if (!t.includes("hidden")) t.unshift("hidden");
    return { kind: "Other", tags: t };
  }
  return { kind, tags };
}

async function saveCurrent(){
  if (!currentUser || !selected) return;
  setStatus("SAVE…");

  const rawKind = $("#kind").value;
  const rawTags = $("#tags").value.split(",").map(s=>s.trim()).filter(Boolean);
  const mapped = mapHiddenKind(rawKind, rawTags);
  const payload = {
    kind: mapped.kind,
    title: $("#title").value.trim(),
    body: $("#body").value,
    tags: mapped.tags,
    mood: $("#mood").value === "" ? null : Number($("#mood").value),
    user_id: currentUser.id,
  };

  if (!selected.id){
    const { data, error } = await supabase.from("logs").insert(payload).select("*").single();
    if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
    window.WiredAudio?.saveSound();
    window.WiredAudio?.applyMood(payload.mood);
    setStatus("SAVED (NEW).");
    // ---- reset for next log ----
    currentId = null;
editorEl.reset();
$("#mood").value = "0";
setStatus("READY // NEW LOG");
    glitchPulse();
    await fetchLogs();
    openEditor(data);
  } else {
    const { data, error } = await supabase
      .from("logs")
      .update(payload)
      .eq("id", selected.id)
      .select("*")
      .single();
    if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
    window.WiredAudio?.saveSound();
    window.WiredAudio?.applyMood(payload.mood);
    setStatus("SAVED (UPDATE).");
    // ---- reset for next log ----
    currentId = null;
    editorEl.reset();
    $("#mood").value = "0";
    setStatus("READY // NEW LOG");
    glitchPulse();
    await fetchLogs();
    openEditor(data);
  }
}

async function deleteCurrent(){
  if (!currentUser || !selected?.id) return;
  if (!confirm("DELETE THIS LOG?")) return;
  setStatus("DELETE…");
  const { error } = await supabase.from("logs").delete().eq("id", selected.id);
  if (error){ window.WiredAudio?.errorSound();
    setStatus("ERR: " + error.message); return; }
  setStatus("DELETED.");
  glitchPulse();
  selected = null;
  await fetchLogs();
  newEditor();
  if (getAction()==='counselling' || getAction()==='new' || getAction()==='hidden') { glitchPulse(); }
}

async function onSession(session){
  if (!session?.user){
    uiSignedOut();
    return;
  }
  currentUser = session.user;
  uiSignedIn(currentUser);
  await fetchLogs();
  newEditor();
  if (getAction()==='counselling' || getAction()==='new' || getAction()==='hidden') { glitchPulse(); }
}

btnSignup?.addEventListener("click", signup);
btnLogin?.addEventListener("click", ()=>{ window.WiredAudio?.resumeAudio(); login(); });
btnLogout?.addEventListener("click", logout);

btnRefresh?.addEventListener("click", async ()=>{
  glitchPulse();
  await fetchLogs();
});

btnNew?.addEventListener("click", ()=>{
  glitchPulse();
  newEditor();
});

kindFilterEl?.addEventListener("change", ()=> renderList(filtered()));
qEl?.addEventListener("input", ()=> renderList(filtered()));

// Live noise intensity based on typing
document.addEventListener("input", ()=>{
  window.__noiseBoost = Math.min(1, (window.__noiseBoost || 0) + 0.2);
});

// Init session
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

const { data } = await supabase.auth.getSession();
await onSession(data.session);

supabase.auth.onAuthStateChange(async (_event, session)=>{
  await onSession(session);
});
