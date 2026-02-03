// docs/app.js
import { getSupabase } from "./supabase.js";

const sb = getSupabase();

/* ========= helpers ========= */
const $ = (s) => document.querySelector(s);
const statusEl = $("#status");

function setStatus(msg){
  if (statusEl) statusEl.textContent = msg;
}

function glitchPulse(){
  const g = document.querySelector(".glitch-layer");
  if (!g) return;
  g.style.opacity = "1";
  g.style.transform =
    `translate(${(Math.random()*6-3).toFixed(1)}px, ${(Math.random()*6-3).toFixed(1)}px)`;
  setTimeout(()=>{ g.style.opacity = "0"; }, 120);
}

/* ========= BOOT (MOBILE SAFE) ========= */
function bootSequenceSafe(){
  try{ window.WiredAudio?.bootSound?.(); }catch{}
  const boot = document.getElementById("boot");
  if (boot) setTimeout(()=>boot.classList.add("hidden"), 800);
}

function waitUserGestureForBoot(){
  const kick = () => {
    document.removeEventListener("pointerdown", kick);
    document.removeEventListener("touchstart", kick);
    bootSequenceSafe();
  };
  document.addEventListener("pointerdown", kick, { once:true });
  document.addEventListener("touchstart", kick, { once:true });
}

waitUserGestureForBoot();

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

/* ========= state ========= */
let currentUser = null;
let selected = null;
let cache = [];

/* ========= UI ========= */
function uiSignedOut(){
  authBox?.classList.remove("hidden");
  navBox?.classList.add("hidden");
  btnLogout?.classList.add("hidden");
  if (whoEmail) whoEmail.textContent = "-";
}

function uiSignedIn(user){
  authBox?.classList.add("hidden");
  navBox?.classList.remove("hidden");
  btnLogout?.classList.remove("hidden");
  if (whoEmail) whoEmail.textContent = user.email ?? "(unknown)";
}

/* ========= AUTH ========= */
async function login(){
  setStatus("LOGIN…");
  try{
    const { data, error } = await sb.auth.signInWithPassword({
      email: (emailEl?.value ?? "").trim(),
      password: passEl?.value ?? ""
    });
    if (error) throw error;

    uiSignedIn(data.session.user);
    currentUser = data.session.user;

    // ★ ログイン成功後に初めて Static / Noise を許可
    setTimeout(()=>{
      window.dispatchEvent(new Event("wired-user-ready"));
    }, 300);

    setStatus("CONNECTED");
    glitchPulse();
  }catch(e){
    console.error(e);
    setStatus("ERR: LOGIN FAILED");
  }
}

async function logout(){
  await sb.auth.signOut();
  uiSignedOut();
  setStatus("DISCONNECTED");
}

/* ========= EVENTS ========= */
btnLogin?.addEventListener("click", login);
btnSignup?.addEventListener("click", login);
btnLogout?.addEventListener("click", logout);

/* ========= INIT ========= */
setStatus("BOOTING…");

(async ()=>{
  const { data } = await sb.auth.getSession();
  if (data?.session?.user){
    uiSignedIn(data.session.user);
    currentUser = data.session.user;

    setTimeout(()=>{
      window.dispatchEvent(new Event("wired-user-ready"));
    }, 300);
  }else{
    uiSignedOut();
    setStatus("AUTH REQUIRED");
  }
})();
