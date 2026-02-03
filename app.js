// app.js
import { getSupabase } from "./supabase.js";

const sb = () => getSupabase();

/* =========================
   DOM
========================= */
const $ = (s) => document.querySelector(s);

const elEmail = $("#email");
const elPass = $("#password");
const btnLogin = $("#btnLogin");
const btnLogout = $("#btnLogout");

const statusEl = $("#status");
const listEl = $("#logList");
const editor = $("#editor");
const authBox = $("#authBox");

const kindSel = $("#kind");
const titleEl = $("#title");
const bodyEl = $("#body");
const tagsEl = $("#tags");
const moodEl = $("#mood");
const btnSave = $("#btnSave");
const btnNew = $("#btnNew");

/* =========================
   state
========================= */
let currentUser = null;
let cache = [];
let sessionLock = Promise.resolve(); // serialise session sensitive ops

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg;
}

/* =========================
   UI helpers
========================= */
function uiSignedIn(user) {
  currentUser = user;
  if (authBox) authBox.style.display = "none";
  if (editor) editor.style.display = "block";
  if (btnLogout) btnLogout.style.display = "inline-block";
}

function uiSignedOut() {
  currentUser = null;
  cache = [];
  if (listEl) listEl.innerHTML = "";
  if (authBox) authBox.style.display = "block";
  if (editor) editor.style.display = "none";
  if (btnLogout) btnLogout.style.display = "none";
}

/* =========================
   Session core
   - iOS/PWAで getSession() が一瞬 null を返しても落とさない
========================= */
async function withSessionLock(fn) {
  const prev = sessionLock;
  let release;
  sessionLock = new Promise(r => (release = r));
  await prev;
  try { return await fn(); }
  finally { release(); }
}

// “生きてるsession”をできるだけ取りに行く
async function getLiveSession() {
  return withSessionLock(async () => {
    // 1) まず素直にgetSession
    let { data, error } = await sb().auth.getSession();
    if (error) console.warn("[auth.getSession] ", error);

    if (data?.session) return data.session;

    // 2) 一瞬nullのケースがあるので refreshSession を試す（sessionが無ければ失敗するがOK）
    try {
      const r = await sb().auth.refreshSession();
      if (r?.data?.session) return r.data.session;
    } catch (e) {
      // refreshできないのは「本当に未ログイン」か「ネット揺れ」なので次へ
      console.warn("[auth.refreshSession] ", e);
    }

    // 3) もう一回 getSession
    ({ data } = await sb().auth.getSession());
    if (data?.session) return data.session;

    return null;
  });
}

async function ensureUserOrSoftFail() {
  const session = await getLiveSession();

  // sessionが取れない＝即ログアウト、にしない。
  // onAuthStateChange が SIGNED_OUT を出した時だけ落とす。
  if (!session?.user) {
    setStatus("SESSION UNSTABLE… (waiting)");
    return null;
  }
  return session.user;
}

/* =========================
   Auth wiring
========================= */
async function boot() {
  setStatus("BOOT…");

  // authイベントが“真実”
  sb().auth.onAuthStateChange((event, session) => {
    console.log("[AUTH]", event);

    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session?.user) {
        uiSignedIn(session.user);
        // ここで同期を走らせる（token refresh後も復旧しやすい）
        fetchLogs({ retry: 2 });
      }
    }

    if (event === "SIGNED_OUT") {
      setStatus("SIGNED OUT");
      uiSignedOut();
    }
  });

  // 初回セッション復帰
  const sess = await getLiveSession();
  if (sess?.user) {
    uiSignedIn(sess.user);
    setStatus("SESSION OK");
    fetchLogs({ retry: 2 });
  } else {
    setStatus("PLEASE LOGIN");
    uiSignedOut();
  }

  // 画面復帰でセッション再確認（iOSで重要）
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    const s = await getLiveSession();
    if (s?.user) {
      uiSignedIn(s.user);
      // 画面復帰で同期
      fetchLogs({ retry: 1 });
    }
  });

  // 3分おき keepalive（iOSでtoken refreshが遅延/落ちた時の保険）
  setInterval(async () => {
    const s = await getLiveSession();
    if (s?.user) {
      // 何もしない（取得できた＝生きてる）
    }
  }, 180000);
}

/* =========================
   Login/Logout
========================= */
async function doLogin() {
  const email = (elEmail?.value || "").trim();
  const password = (elPass?.value || "").trim();
  if (!email || !password) { setStatus("ENTER EMAIL/PASS"); return; }

  setStatus("LOGIN…");
  try {
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) uiSignedIn(data.user);
    setStatus("LOGIN OK");
    fetchLogs({ retry: 2 });
  } catch (e) {
    console.error(e);
    setStatus("LOGIN ERR: " + (e?.message || "UNKNOWN"));
  }
}

async function doLogout() {
  setStatus("LOGOUT…");
  try {
    await sb().auth.signOut();
  } catch (e) {
    console.warn(e);
  }
}

/* =========================
   Logs
========================= */
function renderList(items) {
  if (!listEl) return;
  listEl.innerHTML = "";

  for (const row of items) {
    const div = document.createElement("div");
    div.className = "log-item";

    const dt = row.created_at ? new Date(row.created_at).toLocaleString() : "";
    div.innerHTML = `
      <div class="log-top">
        <div class="log-kind">${escapeHtml(row.kind || "")}</div>
        <div class="log-date">${escapeHtml(dt)}</div>
      </div>
      <div class="log-title">${escapeHtml(row.title || "")}</div>
      <div class="log-body">${escapeHtml((row.body || "").slice(0, 160))}</div>
    `;

    div.addEventListener("click", () => loadToEditor(row));
    listEl.appendChild(div);
  }
}

function loadToEditor(row) {
  if (!row) return;
  editor.dataset.editingId = row.id || "";
  if (kindSel) kindSel.value = row.kind || "Note";
  if (titleEl) titleEl.value = row.title || "";
  if (bodyEl) bodyEl.value = row.body || "";
  if (tagsEl) tagsEl.value = Array.isArray(row.tags) ? row.tags.join(",") : "";
  if (moodEl) moodEl.value = row.mood ?? "";
  setStatus("EDITING");
}

function collectEditor() {
  const kind = kindSel?.value || "Note";
  const title = titleEl?.value ?? "";
  const body = bodyEl?.value ?? "";
  const tags = (tagsEl?.value || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const mood = moodEl?.value ? Number(moodEl.value) : null;

  return { kind, title, body, tags, mood };
}

async function fetchLogs({ retry = 2 } = {}) {
  // UI的にはログイン中に見えても、sessionが一瞬取れないことがあるので粘る
  const user = await ensureUserOrSoftFail();
  if (!user) {
    // ここでuiSignedOutしない（勝手に落とすのが一番ダメ）
    if (retry > 0) {
      await sleep(400);
      return fetchLogs({ retry: retry - 1 });
    }
    setStatus("SYNC PAUSED (NO SESSION)");
    return;
  }

  setStatus("SYNC…");
  try {
    const { data, error, status } = await sb()
      .from("logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      console.error("[SYNC] status=", status, "error=", error);
      // 401/403っぽい時は refresh → 1回だけ再試行
      const msg = String(error?.message || "");
      const code = String(error?.code || "");
      if (retry > 0 && (status === 401 || status === 403 || code.includes("401") || msg.toLowerCase().includes("jwt"))) {
        await sb().auth.refreshSession().catch(()=>{});
        await sleep(250);
        return fetchLogs({ retry: retry - 1 });
      }
      throw error;
    }

    cache = data || [];
    renderList(cache);
    setStatus(`SYNC OK // ${cache.length} logs`);
  } catch (e) {
    console.error(e);
    if (retry > 0) {
      setStatus("SYNC RETRY…");
      await sleep(450);
      return fetchLogs({ retry: retry - 1 });
    }
    setStatus("SYNC ERR: " + (e?.message || "UNKNOWN"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
}

async function saveLog() {
  const user = await ensureUserOrSoftFail();
  if (!user) { setStatus("NO SESSION (SAVE PAUSED)"); return; }

  const payload = collectEditor();
  const editingId = editor?.dataset?.editingId || "";

  setStatus("SAVE…");
  try {
    if (!editingId) {
      // insert
      const { error } = await sb().from("logs").insert([{
        user_id: user.id,
        ...payload,
      }]);
      if (error) throw error;
    } else {
      // update
      const { error } = await sb().from("logs").update({
        ...payload,
      }).eq("id", editingId).eq("user_id", user.id);
      if (error) throw error;
    }

    setStatus("SAVE OK");
    editor.dataset.editingId = "";
    await fetchLogs({ retry: 2 });
  } catch (e) {
    console.error(e);
    setStatus("SAVE ERR: " + (e?.message || "UNKNOWN"));
    try { window.WiredAudio?.errorSound?.(); } catch {}
  }
}

function newLog() {
  if (editor) editor.dataset.editingId = "";
  if (kindSel) kindSel.value = "Note";
  if (titleEl) titleEl.value = "";
  if (bodyEl) bodyEl.value = "";
  if (tagsEl) tagsEl.value = "";
  if (moodEl) moodEl.value = "";
  setStatus("NEW");
}

/* =========================
   Utils
========================= */
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   events
========================= */
btnLogin?.addEventListener("click", doLogin);
btnLogout?.addEventListener("click", doLogout);
btnSave?.addEventListener("click", saveLog);
btnNew?.addEventListener("click", newLog);

boot();
