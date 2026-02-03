// app.js
import { getSupabase, resetSupabase } from "./supabase.js";

const client = getSupabase();

/* ========= helpers ========= */
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function showOfflineBanner(on) {
  const el = document.getElementById("offline");
  if (!el) return;
  el.classList.toggle("hidden", !on);
}

function glitchPulse() {
  const g = document.querySelector(".glitch-layer");
  if (!g) return;
  g.style.opacity = "1";
  g.style.transform = `translate(${(Math.random() * 6 - 3).toFixed(1)}px, ${(Math.random() * 6 - 3).toFixed(1)}px)`;
  setTimeout(() => { g.style.opacity = "0"; }, 120);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showToast(msg) {
  // 雑にalertでも動くように（UIがあるなら差し替えてOK）
  console.warn("[TOAST]", msg);
}

/* ========= PROBE (diagnostic) ========= */
function logAuth(label, obj) {
  try { console.log(`[AUTH ${label}]`, obj ?? ""); } catch {}
}

async function debugProbe(label) {
  try {
    const { data, error } = await client.auth.getSession();
    const has = !!data?.session;
    console.log(`[PROBE ${label}] session=`, has, data?.session?.user?.email, error || "");
    setStatus(`${label} // session=${has ? "YES" : "NO"}`);
  } catch (e) {
    console.log(`[PROBE ${label}] ERR`, e);
    setStatus(`${label} // ERR ${e?.name || ""}`);
  }
}

/* ========= BOOT ========= */
(function bootSequence() {
  try { window.WiredAudio?.bootSound?.(); } catch {}
  const boot = document.getElementById("boot");
  if (boot) setTimeout(() => boot.classList.add("hidden"), 1400);
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
addEventListener("offline", () => {
  showOfflineBanner(true);
  setStatus("NO CARRIER // OFFLINE");
});
addEventListener("online", () => {
  showOfflineBanner(false);
  setStatus("ONLINE // WIRED RESTORED");
});

/* ========= UI ========= */
function uiSignedOut() {
  authBox?.classList.remove("hidden");
  navBox?.classList.add("hidden");
  btnLogout?.classList.add("hidden");

  if (editorEl) {
    editorEl.classList.add("locked");
    editorEl.innerHTML = `<div class="locked-msg">AUTH REQUIRED // CONNECT TO WIRED</div>`;
  }
  if (listEl) {
    listEl.innerHTML = `<div class="empty-msg">NO DATA // WAITING FOR NODE SYNC</div>`;
  }
  if (whoEmail) whoEmail.textContent = "-";

  currentUser = null;
  selected = null;
  cache = [];
}

function uiSignedIn(user) {
  authBox?.classList.add("hidden");
  navBox?.classList.remove("hidden");
  btnLogout?.classList.remove("hidden");
  editorEl?.classList.remove("locked");
  if (whoEmail) whoEmail.textContent = user.email ?? "(unknown)";
}

/* ========= Draft (autosave) ========= */
const DRAFT_KEY = "wired_draft_v1";

function draftId() {
  const uid = currentUser?.id || "anon";
  const sid = selected?.id ? String(selected.id) : "new";
  return `${uid}::${sid}`;
}

function readDraftAll() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); }
  catch { return {}; }
}

function writeDraftAll(obj) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(obj)); } catch {}
}

function saveDraftNow() {
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

function clearDraft() {
  const all = readDraftAll();
  delete all[draftId()];
  writeDraftAll(all);
}

function applyDraftIfAny() {
  const all = readDraftAll();
  const d = all[draftId()];
  if (!d) return;

  const bodyEl = $("#body");
  if (!bodyEl) return;

  const hasDraftText = String(d.body || "").length > 0;
  if (!hasDraftText) return;

  $("#kind").value = d.kind ?? $("#kind").value;
  $("#title").value = d.title ?? $("#title").value;
  $("#tags").value = d.tags ?? $("#tags").value;
  $("#mood").value = d.mood ?? $("#mood").value;
  $("#body").value = d.body ?? $("#body").value;

  setStatus("DRAFT RESTORED // RECOVERED");
  try { window.WiredAudio?.errorSound?.(); } catch {}
}

let draftTimer = 0;
function hookDraftAutosave() {
  const root = editorEl;
  if (!root) return;
  if (root.dataset.draftHooked === "1") return;
  root.dataset.draftHooked = "1";

  root.addEventListener("input", () => {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => saveDraftNow(), 260);
  }, { passive: true });
}

/* ========= AUTH / SESSION (critical) ========= */
/**
 * セッション処理が多重に走ると UI/state が競合し「ログイン弾かれ」「ログ0」に見える。
 * → 直列化（ロック）
 */
let sessionLock = Promise.resolve();
function withSessionLock(fn) {
  sessionLock = sessionLock.then(fn).catch((e) => {
    console.error("[SESSION LOCK] ERR", e);
  });
  return sessionLock;
}

async function getSessionSafe() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

/**
 * refresh は「必要時に1回だけ」。429を避けるため supabase.js 側の __refreshWithLock を使う。
 */
async function refreshIfNeeded() {
  const { data } = await client.auth.getSession();
  if (data?.session?.user) return data.session;

  // セッション無しのときだけ refresh 試行（ロック＋クールダウン付き）
  const r = await client.__refreshWithLock?.();
  if (r?.error) return null;

  const { data: d2 } = await client.auth.getSession();
  return d2?.session ?? null;
}

async function ensureSignedInOrThrow() {
  const sess = await withSessionLock(async () => {
    // まず getSession、無ければ refreshIfNeeded（= lock付き）
    const s1 = await getSessionSafe().catch(() => null);
    if (s1?.user?.id) return s1;
    return await refreshIfNeeded();
  });

  if (!sess?.user?.id) throw new Error("NOT_SIGNED_IN");
  currentUser = sess.user;
  return sess;
}

/* ========= auth actions ========= */
async function login() {
  setStatus("LOGIN…");
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: (emailEl?.value ?? "").trim(),
      password: passEl?.value ?? ""
    });
    if (error) throw error;

    await debugProbe("AFTER LOGIN");
    glitchPulse();

    await withSessionLock(() => onSession(data.session, "LOGIN"));
  } catch (e) {
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "LOGIN FAILED"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
}

async function signup() {
  setStatus("SIGNUP…");
  try {
    const { error } = await client.auth.signUp({
      email: (emailEl?.value ?? "").trim(),
      password: passEl?.value ?? ""
    });
    if (error) throw error;

    setStatus("CHECK EMAIL // VERIFY");
    glitchPulse();
  } catch (e) {
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "SIGNUP FAILED"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
}

async function logout() {
  setStatus("LOGOUT…");
  try { await client.auth.signOut(); } catch {}
  uiSignedOut();
  setStatus("DISCONNECTED");
  glitchPulse();
}

/* ========= list ========= */
function filteredList() {
  const kind = kindFilterEl?.value ?? "ALL";
  const q = (qEl?.value ?? "").trim().toLowerCase();

  return cache.filter(it => {
    if (kind !== "ALL" && it.kind !== kind) return false;
    if (!q) return true;
    const blob = `${it.kind} ${it.title} ${it.body} ${(it.tags || []).join(" ")}`.toLowerCase();
    return blob.includes(q);
  });
}

function renderList(items) {
  if (!listEl) return;

  if (!items.length) {
    listEl.innerHTML = `<div class="empty-msg">NO DATA // CREATE FIRST LOG</div>`;
    return;
  }

  listEl.innerHTML = "";
  for (const it of items) {
    const div = document.createElement("div");
    div.className = "item";

    const preview = (it.body || "").replace(/\s+/g, " ").slice(0, 120);
    const tags = (it.tags || [])
      .slice(0, 4)
      .map(t => `<span class="badge">#${escapeHtml(t)}</span>`)
      .join("");

    div.innerHTML = `
      <div class="k">${escapeHtml(it.kind)}${it.mood == null ? "" : ` // mood ${it.mood}`}</div>
      <div class="t">${escapeHtml(it.title || "(no title)")}</div>
      <div class="m">${escapeHtml(preview)}</div>
      <div class="d">
        <span class="badge">${new Date(it.created_at).toLocaleString()}</span>
        ${tags}
      </div>
    `;
    div.addEventListener("click", () => openEditor(it));
    listEl.appendChild(div);
  }
}

function renderLogs(rows) {
  cache = Array.isArray(rows) ? rows : [];
  renderList(filteredList());
}

/* ========= data (NO refresh spam) ========= */
async function selectLogsOnce() {
  return await client
    .from("logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
}

async function selectLogsSafe() {
  // まず普通に取得
  let res = await selectLogsOnce();
  if (!res.error) return res;

  const status = res.error?.status || res.status;

  // 401/403 のときだけ refresh → 1回だけ取り直す
  if (status === 401 || status === 403) {
    const r = await client.__refreshWithLock?.();
    // 429等でrefreshできない時は、ここで即ログアウト扱いにしない
    if (r?.error) return res;
    res = await selectLogsOnce();
  }

  return res;
}

async function fetchLogs() {
  if (!currentUser) return;

  setStatus("SYNC…");

  try {
    const res = await selectLogsSafe();
    if (res.error) throw res.error;

    renderLogs(res.data || []);
    setStatus("OK");
  } catch (err) {
    console.warn("[SYNC] fetchLogs failed", err);
    setStatus("SYNC FAILED // RETRY");
    showToast("SYNC 失敗: ネットワーク混雑/認証(429含む)の可能性。少し待って再試行。");
    // ここで uiSignedOut() しない（誤ログアウトを防ぐ）
  }
}

/* ========= editor ========= */
function openEditor(it) {
  selected = it;

  if (!editorEl || !editorTpl) return;

  editorEl.innerHTML = "";
  editorEl.appendChild(editorTpl.content.cloneNode(true));
  editorEl.dataset.draftHooked = "0";

  $("#kind").value = it.kind ?? "Note";
  $("#title").value = it.title ?? "";
  $("#tags").value = (it.tags || []).join(", ");
  $("#mood").value = (it.mood ?? "");
  $("#body").value = it.body ?? "";

  $("#btnSave").onclick = () => saveCurrent({ retry: 1 });
  $("#btnDelete").onclick = deleteCurrent;

  hookDraftAutosave();
  applyDraftIfAny();

  $("#body")?.focus();
  glitchPulse();
}

function newEditor(kind = "Note") {
  openEditor({
    id: null,
    kind,
    title: "",
    body: "",
    tags: [],
    mood: null,
    created_at: new Date().toISOString()
  });
}

/* ========= SAVE / DELETE ========= */
async function saveCurrent({ retry = 1 } = {}) {
  try {
    setStatus("SAVE…");
    await debugProbe("BEFORE SAVE");

    await ensureSignedInOrThrow();

    if (!selected) throw new Error("EDITOR STATE LOST");

    const payload = {
      kind: $("#kind")?.value ?? "Note",
      title: ($("#title")?.value ?? "").trim(),
      body: ($("#body")?.value ?? ""),
      tags: ($("#tags")?.value ?? "").split(",").map(s => s.trim()).filter(Boolean),
      mood: ($("#mood")?.value ?? "") === "" ? null : Number($("#mood")?.value),
      user_id: currentUser.id
    };

    if (!selected.id) {
      const { error } = await client.from("logs").insert(payload);
      if (error) throw error;
    } else {
      const { error } = await client.from("logs").update(payload).eq("id", selected.id);
      if (error) throw error;
    }

    clearDraft();
    try { window.WiredAudio?.saveSound?.(); } catch {}

    await fetchLogs();
    newEditor(payload.kind);

    setStatus("READY // NEXT LOG");
    glitchPulse();

  } catch (e) {
    console.error(e);

    // ここで「即ログアウト」はやめる（429/一時不調で弾かれるのを防ぐ）
    if (String(e?.status || "").includes("429") || String(e?.message || "").includes("429")) {
      setStatus("RATE LIMITED // WAIT");
      alert("混雑(429)のため保存に失敗しました。\n本文は下書きとして保持されています。\n少し待って再試行してください。");
      return;
    }

    if (retry > 0) {
      setStatus("SAVE RETRY…");
      resetSupabase();
      await sleep(350);
      return saveCurrent({ retry: retry - 1 });
    }

    setStatus("ERR: SAVE FAILED");
    try { window.WiredAudio?.errorSound?.(); } catch {}
    alert("SAVE FAILED\n（本文は下書きとして保持されています）\n\n" + (e?.message ?? e));
  }
}

async function deleteCurrent() {
  if (!selected?.id) return;
  if (!confirm("DELETE LOG?")) return;

  setStatus("DELETE…");

  try {
    await ensureSignedInOrThrow();

    const { error } = await client.from("logs").delete().eq("id", selected.id);
    if (error) throw error;

    clearDraft();
    await fetchLogs();
    newEditor();
    setStatus("DELETED.");
    glitchPulse();

  } catch (e) {
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "DELETE FAILED"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
}

/* ========= session ========= */
async function onSession(session, from = "UNKNOWN") {
  if (!session?.user) {
    logAuth("NO SESSION", from);
    uiSignedOut();
    setStatus("AUTH REQUIRED // CONNECT TO WIRED");
    return;
  }

  currentUser = session.user;
  uiSignedIn(currentUser);

  await fetchLogs();
  newEditor();
}

/* ========= events ========= */
btnLogin?.addEventListener("click", () => login());
btnSignup?.addEventListener("click", () => signup());
btnLogout?.addEventListener("click", () => logout());
btnRefresh?.addEventListener("click", () => fetchLogs());
btnNew?.addEventListener("click", () => {
  glitchPulse();
  const k = $("#kind")?.value || "Note";
  newEditor(k);
});

kindFilterEl?.addEventListener("change", () => renderList(filteredList()));
qEl?.addEventListener("input", () => renderList(filteredList()));

/* ========= init ========= */
setStatus("BOOT…");
showOfflineBanner(!navigator.onLine);

(async function init() {
  try {
    const session = await getSessionSafe();
    await withSessionLock(() => onSession(session, "INIT"));
  } catch (e) {
    console.error(e);
    uiSignedOut();
    setStatus("AUTH REQUIRED // CONNECT TO WIRED");
  }
})();

/* auth state change (serialized) */
client.auth.onAuthStateChange((event, session) => {
  logAuth("STATE", { event, hasSession: !!session });
  withSessionLock(() => onSession(session, `AUTH:${event}`));
});

/**
 * iOS Safari 対策：
 * 可視になったら session を読む。無い場合だけ refresh（ロック付き）を試す。
 * → refresh連打を絶対にしない
 */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;

  await withSessionLock(async () => {
    const s = await refreshIfNeeded();
    if (!s?.user) return;
    currentUser = s.user;
    // ここで fetchLogs を毎回叩くとスクロール復帰で連打になるので「必要時だけ」ボタン/初回に任せる
  });
});

/* keep alive：getSessionだけ。ログイン中のみ。頻度を下げる */
setInterval(async () => {
  try {
    if (!currentUser) return;
    await client.auth.getSession();
  } catch {}
}, 10 * 60 * 1000);
