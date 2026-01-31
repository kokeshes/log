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

let currentUser = null;
let selected = null;
let cache = [];

function setStatus(msg){ statusEl.textContent = msg; }

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
  whoEmail.textContent = user.email ?? "(unknown)";
}

async function signup(){
  setStatus("SIGNUP…");
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { error } = await supabase.auth.signUp({ email, password });
  if (error){ setStatus("ERR: " + error.message); return; }
  setStatus("SIGNED UP. CHECK EMAIL IF REQUIRED.");
  glitchPulse();
}

async function login(){
  setStatus("LOGIN…");
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error){ setStatus("ERR: " + error.message); return; }
  setStatus("CONNECTED.");
  glitchPulse();
  await onSession(data.session);
}

async function logout(){
  setStatus("LOGOUT…");
  const { error } = await supabase.auth.signOut();
  if (error){ setStatus("ERR: " + error.message); return; }
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

  $("#kind").value = it.kind;
  $("#title").value = it.title ?? "";
  $("#tags").value = (it.tags || []).join(", ");
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
    kind: "Note",
    title: "",
    body: "",
    tags: [],
    mood: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  openEditor(it);
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

  if (error){ setStatus("ERR: " + error.message); return; }
  cache = data || [];
  renderList(filtered());
  setStatus(`SYNC OK // ${cache.length} logs`);
}

async function saveCurrent(){
  if (!currentUser || !selected) return;
  setStatus("SAVE…");

  const payload = {
    kind: $("#kind").value,
    title: $("#title").value.trim(),
    body: $("#body").value,
    tags: $("#tags").value.split(",").map(s=>s.trim()).filter(Boolean),
    mood: $("#mood").value === "" ? null : Number($("#mood").value),
    user_id: currentUser.id,
  };

  if (!selected.id){
    const { data, error } = await supabase.from("logs").insert(payload).select("*").single();
    if (error){ setStatus("ERR: " + error.message); return; }
    setStatus("SAVED (NEW).");
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
    if (error){ setStatus("ERR: " + error.message); return; }
    setStatus("SAVED (UPDATE).");
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
  if (error){ setStatus("ERR: " + error.message); return; }
  setStatus("DELETED.");
  glitchPulse();
  selected = null;
  await fetchLogs();
  newEditor();
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
}

btnSignup?.addEventListener("click", signup);
btnLogin?.addEventListener("click", login);
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
const { data } = await supabase.auth.getSession();
await onSession(data.session);

supabase.auth.onAuthStateChange(async (_event, session)=>{
  await onSession(session);
});
