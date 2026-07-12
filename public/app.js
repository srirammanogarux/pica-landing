/* =====================================================================
   PICA — landing page logic
   Change anything you need in this ONE block. Nothing else requires edits.
   ===================================================================== */
const CONFIG = {
  PRICE_LABEL:   "₹99",
  // Dodo Payments hosted-checkout link for the ₹99 product. Paste the live URL here.
  DODO_CHECKOUT_URL: "https://checkout.dodopayments.com/buy/REPLACE_ME",
  // Telegram bot deep-link (used after purchase / anywhere we point to the product).
  TELEGRAM_BOT_URL:  "https://t.me/PicaTeachBot",
  // Convex deployment URL, e.g. https://your-deployment-123.convex.cloud
  // Leave blank to run the page fully (forms log locally instead of writing).
  CONVEX_URL: "",
  SOURCE: "landing",
};

/* ---------- Convex HTTP client (no build step) ---------- */
async function convexMutation(path, args){
  if(!CONFIG.CONVEX_URL){
    console.info("[pica] CONVEX_URL not set — would write:", path, args);
    return { ok:false, offline:true };
  }
  try{
    const res = await fetch(`${CONFIG.CONVEX_URL}/api/mutation`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ path, args, format:"json" }),
    });
    const data = await res.json();
    if(data.status === "success") return { ok:true, value:data.value };
    console.error("[pica] convex error", data);
    return { ok:false, error:data.errorMessage || "convex_error" };
  }catch(e){
    console.error("[pica] convex fetch failed", e);
    return { ok:false, error:"network" };
  }
}
const saveWaitlist = (email, building) =>
  convexMutation("mutations:addWaitlist", { email, building: building||"", source:CONFIG.SOURCE });
const saveOrder = (email) =>
  convexMutation("mutations:createOrder", { email, amount:99, status:"initiated" });

/* =====================================================================
   THE PROTOTYPE — self-playing Telegram thread (TEACH / PRACTICE)
   ===================================================================== */
const AV = `<img class="sprite sprite--28 msg__avatar" src="/pica.png" alt="Pica" width="28" height="28" />`;
const VOICE = `<div class="voice"><span class="voice__play">▶</span>
  <span class="voice__wave">${Array.from({length:22},(_,i)=>`<i style="height:${20+16*Math.abs(Math.sin(i*0.9))|0}%"></i>`).join("")}</span>
  <span class="voice__time">0:14</span></div>`;

// Each scenario is a real moment a designer hits. mode = TEACH or PRACTICE (shown as a badge).
const SCENARIOS = {
  error: { mode:"TEACH", msgs:[
    { who:"user", kind:"err", text:"TypeError: Cannot read properties of undefined (reading 'map')" },
    { who:"pica", text:"You asked a list to draw itself before the list existed. Your data hasn't arrived from the server yet — it's still <strong>undefined</strong> — and you called <strong>.map()</strong> on nothing." },
    { who:"pica", text:"<strong>The concept — loading state.</strong> Your screen renders <em>before</em> the data lands. Always. You have to tell it what to show while it's still empty." },
    { who:"pica", kind:"voice" },
    { who:"pica", text:"Want to fix it yourself? Tap <strong>“Let me try it myself”.</strong> 🐾" },
  ]},
  diff: { mode:"TEACH", msgs:[
    { who:"user", text:"my agent just touched 12 files and I hit accept before I could read them 😰 what did it even do" },
    { who:"pica", text:"Breathe. I read all 12. Eleven are renames and imports — cosmetic. <strong>One line</strong> actually changes what your app does:" },
    { who:"pica", kind:"code", text:`  12 files changed\n\n- const store = new Map()      // in memory\n<span class="hl">+ const store = useDatabase()   // saved for real</span>\n\n  …11 renames &amp; imports` },
    { who:"pica", text:"Before, a refresh wiped everything. Now it doesn't — your data survives. <strong>That's the whole change.</strong> Safe to keep." },
    { who:"pica", text:"<strong>Concept — persistence.</strong> “In memory” = gone on refresh. “In a database” = it stays. Now you can tell the two apart at a glance." },
  ]},
  concept: { mode:"TEACH", msgs:[
    { who:"user", text:"everyone keeps saying useEffect and I just nod 🙃 what is it actually" },
    { who:"pica", text:"It's a <strong>“do this after the screen finishes drawing”</strong> instruction. Picture a stagehand: once the curtain's up, go fetch the props." },
    { who:"pica", kind:"code", text:`useEffect(() =&gt; {\n  loadPosts()   <span class="hl">// runs AFTER the paint</span>\n}, [])` },
    { who:"pica", text:"That's why data “pops in” a beat late — it's fetched <em>after</em> the first paint, not before. <strong>Concept unlocked: side effects.</strong> You'll spot it everywhere now." },
  ]},
  practice: { mode:"PRACTICE", msgs:[
    { who:"pica", text:"Your turn. I've left the fix out on purpose. Line 14, above the return. One line. Off you go." },
    { who:"pica", kind:"code", text:`  const posts = useFeed();\n\n<span class="hl">  // TODO(you): handle the empty state</span>\n\n  return (\n    &lt;Feed items={posts} /&gt;` },
    { who:"user", kind:"mono", text:"if (!posts) return &lt;Spinner /&gt;" },
    { who:"pica", text:"✓ That's it. And you did it better than I would have — you returned early instead of wrapping the whole thing in a conditional. Less nesting. <strong>New concept unlocked: early return.</strong>" },
    { who:"pica", text:"You've learned 4 things today. Want tomorrow's drill at 6pm?" },
  ]},
};
const SCN_ORDER = ["error","diff","concept","practice"];

const threadEl = document.getElementById("thread");
const modeBadge = document.getElementById("mode-badge");
let playToken = 0;           // invalidates an in-flight playthrough on scenario switch
const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function bubbleHTML(m){
  if(m.who === "user"){
    const cls = m.kind === "err" ? "msg msg--err"
              : m.kind === "mono" ? "msg msg--user mono" : "msg msg--user";
    return `<div class="${cls}">${m.text}</div>`;
  }
  // pica
  if(m.kind === "code") return `<div class="msg msg--code">${m.text}</div>`;
  const inner = m.kind === "voice" ? VOICE : `<span class="msg__text">${m.text}</span>`;
  return `<div class="msg msg--pica">${AV}${inner}</div>`;
}
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
function scrollBottom(){ threadEl.scrollTop = threadEl.scrollHeight; }

async function playThread(name){
  const token = ++playToken;
  threadEl.innerHTML = "";
  const scn = SCENARIOS[name];
  const msgs = scn.msgs;
  if(modeBadge){ modeBadge.textContent = scn.mode; modeBadge.className = "mode-badge mode-badge--" + scn.mode.toLowerCase(); }
  for(let i=0;i<msgs.length;i++){
    const m = msgs[i];
    // typing indicator before Pica messages (skip before the very first)
    if(m.who === "pica" && !prefersReduced){
      const t = document.createElement("div");
      t.className = "typing";
      t.innerHTML = `${AV}<span class="typing__dots"><span></span><span></span><span></span></span>`;
      threadEl.appendChild(t); scrollBottom();
      await sleep(650);
      if(token !== playToken) return;
      t.remove();
    }
    threadEl.insertAdjacentHTML("beforeend", bubbleHTML(m));
    scrollBottom();
    if(token !== playToken) return;
    await sleep(prefersReduced ? 250 : 700);
    if(token !== playToken) return;
  }
}

/* scenario chip switching */
document.querySelectorAll(".chip").forEach(chip=>{
  chip.addEventListener("click", ()=>{
    document.querySelectorAll(".chip").forEach(c=>c.classList.remove("is-active"));
    chip.classList.add("is-active");
    playThread(chip.dataset.scn);
  });
});
document.querySelector("[data-replay]").addEventListener("click", ()=>{
  const active = document.querySelector(".chip.is-active");
  playThread(active ? active.dataset.scn : SCN_ORDER[0]);
});

/* autoplay first scenario once the demo scrolls into view (or immediately if visible) */
let started = false;
function startProto(){ if(started) return; started = true; playThread(SCN_ORDER[0]); }
if("IntersectionObserver" in window){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ startProto(); io.disconnect(); } });
  }, { threshold:0.35 });
  io.observe(document.getElementById("proto"));
} else { startProto(); }

/* =====================================================================
   BUY — capture email into Convex BEFORE redirecting to Dodo
   ===================================================================== */
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

async function goCheckout(){
  const input = document.getElementById("buy-email");
  const msg = document.getElementById("buy-msg");
  const email = (input && input.value || "").trim();
  if(!validEmail(email)){
    if(input){ input.focus(); }
    if(msg){ msg.textContent = "Enter your email first — we save it before checkout so you're never lost."; }
    // still allow scrolling to the buy section if triggered from nav
    document.getElementById("buy").scrollIntoView({behavior:"smooth"});
    return;
  }
  if(msg) msg.textContent = "Saving your email…";
  await saveOrder(email);                        // lead captured even if they bounce
  const url = new URL(CONFIG.DODO_CHECKOUT_URL);
  url.searchParams.set("email", email);          // prefill Dodo if supported
  window.location.href = url.toString();
}
document.querySelectorAll("[data-buy]").forEach(b=> b.addEventListener("click", goCheckout));

/* =====================================================================
   WAITLIST
   ===================================================================== */
document.getElementById("wform").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const building = form.building.value.trim();
  const msg = document.getElementById("wform-msg");
  if(!validEmail(email)){ msg.textContent = "That email looks off — mind checking it?"; return; }
  msg.textContent = "Sending…";
  const r = await saveWaitlist(email, building);
  msg.textContent = (r.ok || r.offline)
    ? "You're on the list 🐾 Check your inbox for Pica's video."
    : "Hmm, that didn't save — try again in a sec?";
  if(r.ok || r.offline) form.reset();
});

/* =====================================================================
   GROUND LINE — Pica walks a short distance on scroll (pixel steps)
   ===================================================================== */
const groundPica = document.getElementById("ground-pica");
if(groundPica && !prefersReduced){
  let ticking = false;
  window.addEventListener("scroll", ()=>{
    if(ticking) return; ticking = true;
    requestAnimationFrame(()=>{
      const p = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1);
      const dist = Math.min(1, Math.max(0, p)) * 120;   // px along the strip
      const step = Math.round(dist/8)*8;                // snap to 8px steps
      groundPica.style.transform = `translateX(${step}px)`;
      groundPica.classList.toggle("walk", window.scrollY > 40);
      ticking = false;
    });
  }, { passive:true });
}
