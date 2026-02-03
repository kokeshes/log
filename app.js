// docs/app.js
import { getSupabase } from "./supabase.js";
const sb = getSupabase();

/* helpers */
const $ = (s)=>document.querySelector(s);
const statusEl=$("#status");
const setStatus=(t)=>{ if(statusEl) statusEl.textContent=t; };

const emailEl=$("#email");
const passEl=$("#password");
const listEl=$("#list");
const editorEl=$("#editor");
const editorTpl=$("#editorTpl");

let currentUser=null;
let selected=null;
let cache=[];

/* ---- AUTH ---- */
async function login(){
  setStatus("LOGIN…");
  const {data,error}=await sb.auth.signInWithPassword({
    email:emailEl.value.trim(),
    password:passEl.value
  });
  if(error){ setStatus("ERR"); return; }
  await onSession(data.session);
}

async function onSession(session){
  if(!session?.user){ setStatus("AUTH REQUIRED"); return; }
  currentUser=session.user;
  await fetchLogs();
  newEditor();
}

/* ---- LOGS ---- */
async function fetchLogs(){
  const {data,error}=await sb.from("logs")
    .select("*")
    .order("created_at",{ascending:false})
    .limit(200);
  if(error){ setStatus("SYNC ERR"); return; }
  cache=data||[];
  renderList(cache);
  setStatus(`SYNC OK // ${cache.length}`);
}

function renderList(items){
  listEl.innerHTML="";
  if(!items.length){
    listEl.innerHTML=`<div class="empty-msg">NO DATA</div>`;
    return;
  }
  for(const it of items){
    const d=document.createElement("div");
    d.className="item";
    d.textContent=it.title||"(no title)";
    d.onclick=()=>openEditor(it);
    listEl.appendChild(d);
  }
}

/* ---- EDITOR ---- */
function openEditor(it){
  selected=it;
  editorEl.innerHTML="";
  editorEl.appendChild(editorTpl.content.cloneNode(true));

  $("#body").value=it.body||"";

  // ★ ここが重要：文字を static に送る
  $("#body").addEventListener("input",(e)=>{
    const v=e.target.value;
    const ch=v.slice(-1);
    if(ch){
      window.dispatchEvent(
        new CustomEvent("wired-text-fragment",{ detail:{ text: ch } })
      );
    }
  });

  $("#btnSave").onclick=saveCurrent;
}

function newEditor(){
  openEditor({ id:null, body:"" });
}

async function saveCurrent(){
  if(!currentUser) return;
  const body=$("#body").value;
  await sb.from("logs").insert({
    body,
    kind:"Note",
    user_id:currentUser.id
  });
  await fetchLogs();
  newEditor();
}

/* init */
(async()=>{
  const {data}=await sb.auth.getSession();
  if(data?.session) await onSession(data.session);
})();
