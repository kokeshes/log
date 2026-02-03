// docs/app.js
import { getSupabase } from "./supabase.js";

/* =======================
   helpers
======================= */
const $ = (s) => document.querySelector(s);

const statusEl = $("#status");
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
  // 既存実装があるならそれが優先される
  if (window.showToast) return window.showToast(msg);
  console.log("[TOAST]", msg);
}

/* =======================
   BOOT: 絶対に固めない
======================= */
(function bootSequence() {
  try { window.WiredAudio?.bootSound?.(); } catch {}
  const boot = document.getElementById("boot");
  if (!boot) return;

  // いつ何が起きても、2.5秒でbootは消す（BOOTING固着防止）
  setTimeout(() => boot.classList.add("hidden"), 2500);

  // 追加：普通は1.4秒で消える
  setTimeout(() => boot.classList.add("hidden"), 1400);
})();

/* =======================
   connectivity
======================= */
addEventListener("offline", () => {
  showOfflineBanner(true);
  setStatus("NO CARRIER // OFFLINE");
});
addEventListener("online", () => {
  showOfflineBanner(false);
  setStatus("ONLINE // WIRED RESTORED");
});

/* =======================
   state
======================= */
let currentUser = null;
let selected = null;
let cache = [];

/* =======================
   UI
======================= */
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
  if (whoEmail) whoEmail.textContent = user?.email ?? "(unknown)";
}

/* =======================
   Draft autosave
======================= */
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

/* =======================
   Supabase / Auth core
======================= */
function sb() { return getSupabase(); }

// onAuthStateChange と init と manual refresh の競合を止める
let sessionLock = Promise.resolve();
function withSessionLock(fn) {
  sessionLock = sessionLock.then(fn).catch((e) => console.error("[SESSION LOCK] ERR", e));
  return sessionLock;
}

// refresh 連打を避ける（429対策）
let lastRefreshAt = 0;
const REFRESH_COOLDOWN_MS = 25 * 1000; // 25秒

async function getSessionSafe() {
  const { data, error } = await sb().auth.getSession();
  if (error) throw error;
  return data?.session ?? null;
}

async function ensureSignedInOrThrow() {
  const sess = await getSessionSafe();
  if (!sess?.user?.id) throw new Error("NOT_SIGNED_IN");
  currentUser = sess.user;
  return sess;
}

// 必要なときだけ refresh、かつクールダウンを守る
async function refreshIfNeeded(reason = "UNKNOWN") {
  const now = Date.now();
  if (now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    console.warn("[AUTH] refresh skipped (cooldown)", reason);
    return { ok: false, skipped: true };
  }
  lastRefreshAt = now;

  try {
    const { data, error } = await sb().auth.refreshSession();
    if (error) {
      console.warn("[AUTH] refresh error", reason, error);
      return { ok: false, error };
    }
    if (data?.session?.user) {
      currentUser = data.session.user;
      return { ok: true };
    }
    return { ok: false };
  } catch (e) {
    console.warn("[AUTH] refresh exception", reason, e);
    return { ok: false, error: e };
  }
}

/* =======================
   List rendering
======================= */
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

/* =======================
   Data fetch (核心)
======================= */
async function fetchLogs({ retry = 1 } = {}) {
  if (!currentUser) return;

  setStatus("SYNC…");

  const runOnce = async () => {
    const { data, error, status } = await sb()
      .from("logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      // status は error.status の場合もある
      const st = error?.status ?? status;
      error.__status = st;
      throw error;
    }
    return data || [];
  };

  try {
    const rows = await runOnce();
    cache = rows;
    renderList(filteredList());
    setStatus("OK");
  } catch (err) {
    const st = err?.__status ?? err?.status;
    const msg = String(err?.message || "");

    const looksAuth =
      st === 401 || st === 403 ||
      /jwt/i.test(msg) || /token/i.test(msg) || /not authorized/i.test(msg);

    // 401/403 の時だけ refresh → 1回再試行
    if (looksAuth && retry > 0) {
      console.warn("[SYNC] auth-ish error -> refresh then retry", err);

      await withSessionLock(async () => {
        const r = await refreshIfNeeded("FETCH_LOGS");
        if (r?.ok) {
          // refresh成功ならsession再取得でユーザー更新
          try { await ensureSignedInOrThrow(); } catch {}
        }
      });

      return fetchLogs({ retry: retry - 1 });
    }

    // それ以外は「OFFLINE?」扱いで落とさない
    console.warn("[SYNC] fetchLogs failed", err);
    setStatus("OFFLINE?");
    showToast("SYNC失敗: ネットワーク/認証を確認してください");
  }
}

/* =======================
   Editor
======================= */
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

/* =======================
   SAVE / DELETE
======================= */
async function saveCurrent({ retry = 1 } = {}) {
  try {
    setStatus("SAVE…");

    await withSessionLock(async () => {
      await ensureSignedInOrThrow();
    });

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
      const { error } = await sb().from("logs").insert(payload);
      if (error) throw error;
    } else {
      const { error } = await sb().from("logs").update(payload).eq("id", selected.id);
      if (error) throw error;
    }

    clearDraft();
    try { window.WiredAudio?.saveSound?.(); } catch {}

    await fetchLogs({ retry: 1 });
    newEditor(payload.kind);

    setStatus("READY // NEXT LOG");
    glitchPulse();
  } catch (e) {
    console.error(e);

    const msg = String(e?.message || "");
    const st = e?.status;

    // 401/403だけ refresh試行（1回）
    if ((st === 401 || st === 403 || /jwt/i.test(msg) || /token/i.test(msg)) && retry > 0) {
      setStatus("SAVE RETRY…");
      await withSessionLock(async () => {
        await refreshIfNeeded("SAVE");
        try { await ensureSignedInOrThrow(); } catch {}
      });
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
    await withSessionLock(async () => {
      await ensureSignedInOrThrow();
    });

    const { error } = await sb().from("logs").delete().eq("id", selected.id);
    if (error) throw error;

    clearDraft();
    await fetchLogs({ retry: 1 });
    newEditor();
    setStatus("DELETED.");
    glitchPulse();
  } catch (e) {
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "DELETE FAILED"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
}

/* =======================
   Session handling
======================= */
async function onSession(session, from = "UNKNOWN") {
  if (!session?.user) {
    uiSignedOut();
    setStatus("AUTH REQUIRED // CONNECT TO WIRED");
    return;
  }

  currentUser = session.user;
  uiSignedIn(currentUser);

  // fetchは失敗してもbooting固着させない
  await fetchLogs({ retry: 1 });
  newEditor();
}

/* =======================
   events
======================= */
btnLogin?.addEventListener("click", async () => {
  setStatus("LOGIN…");
  try {
    const { data, error } = await sb().auth.signInWithPassword({
      email: (emailEl?.value ?? "").trim(),
      password: passEl?.value ?? ""
    });
    if (error) throw error;

    glitchPulse();
    await withSessionLock(() => onSession(data.session, "LOGIN"));
  } catch (e) {
    console.error(e);
    setStatus("ERR: " + (e?.message ?? "LOGIN FAILED"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
});

btnSignup?.addEventListener("click", async () => {
  setStatus("SIGNUP…");
  try {
    const { error } = await sb().auth.signUp({
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
});

btnLogout?.addEventListener("click", async () => {
  setStatus("LOGOUT…");
  try { await sb().auth.signOut(); } catch {}
  uiSignedOut();
  setStatus("DISCONNECTED");
  glitchPulse();
});

btnRefresh?.addEventListener("click", () => fetchLogs({ retry: 1 }));

btnNew?.addEventListener("click", () => {
  glitchPulse();
  const k = $("#kind")?.value || "Note";
  newEditor(k);
});

kindFilterEl?.addEventListener("change", () => renderList(filteredList()));
qEl?.addEventListener("input", () => renderList(filteredList()));

/* =======================
   init
======================= */
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

/* auth state change: serialized */
sb().auth.onAuthStateChange((event, session) => {
  withSessionLock(() => onSession(session, `AUTH:${event}`));
});

/* iOS/復帰対策：可視になったら軽くsession確認（refreshはしない） */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  try {
    const s = await getSessionSafe();
    if (s?.user) currentUser = s.user;
  } catch {}
});

/* keep alive: getSessionだけ（refreshしない） */
setInterval(async () => {
  try { await sb().auth.getSession(); } catch {}
}, 5 * 60 * 1000);
