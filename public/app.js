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
   THE DEMO — simulated editor walkthrough
   Hermes (the user-side agent) writes code on the left; Pica watches from the
   right panel and teaches. Auto-plays; every prompt also auto-advances so it
   never stalls, but the visitor can click and actually type the practice line.
   ===================================================================== */
const AV = `<img class="sprite sprite--28 msg__avatar" src="/pica.png" alt="Pica" width="28" height="28" />`;
const sleep = (ms)=>new Promise(r=>setTimeout(r, ms));
const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const codeEl    = document.getElementById("ide-code");
const panelEl   = document.getElementById("panel-thread");
const panelStat = document.getElementById("panel-status");
const ideAgent  = document.getElementById("ide-agent");

const LINES = [
  '<span class="k">function</span> Feed() {',
  '  <span class="k">const</span> posts = useFeed()',
  '  <span class="k">return</span> (',
  '    &lt;ul&gt;',
  '      {posts.map(p =&gt; &lt;li&gt;{p.title}&lt;/li&gt;)}',
  '    &lt;/ul&gt;',
  '  )',
  '}',
];
const TEACH_IDX = 4;

const EXPLAIN = {
  friend:    `So <code>posts.map(...)</code> is you telling the screen: “for every post, draw one row.” It's a loop — but the designer way. One list item per item, automatically, no counting. 🐾`,
  professor: `<code>.map()</code> walks the <em>posts</em> array and returns a new one — here each post becomes an <code>&lt;li&gt;</code>. It's declarative iteration: you describe the output, the runtime does the looping.`,
  concept:   `<strong>Concept — mapping a list.</strong> One row of data in, one piece of UI out. You'll spot it every single time a list shows up on a screen.`,
};

let tone = "friend";
let runToken = 0;

function scrollP(){ panelEl.scrollTop = panelEl.scrollHeight; }
function picaBubble(html){
  const d = document.createElement("div"); d.className = "msg msg--pica";
  d.innerHTML = AV + `<span class="msg__text">${html}</span>`;
  panelEl.appendChild(d); scrollP(); return d;
}
function actionBtn(label, ghost){
  const b = document.createElement("button");
  b.className = "panel-action" + (ghost ? " panel-action--ghost" : "");
  b.textContent = label; panelEl.appendChild(b); scrollP(); return b;
}
async function picaTyping(token){
  if(prefersReduced) return;
  const t = document.createElement("div"); t.className = "typing";
  t.innerHTML = AV + `<span class="typing__dots"><span></span><span></span><span></span></span>`;
  panelEl.appendChild(t); scrollP();
  await sleep(600);
  t.remove();
}
// resolve on click OR after ms — whichever first; guarded so a stale run can't fire twice
function clickOrWait(btn, ms){
  return new Promise((res)=>{
    let done = false;
    const go = ()=>{ if(done) return; done = true; res(); };
    btn.addEventListener("click", go, { once:true });
    setTimeout(go, ms);
  });
}

function renderCode(n, opts){
  opts = opts || {};
  const out = [];
  for(let i=0;i<n;i++){
    let content = LINES[i];
    if(i === TEACH_IDX){
      if(opts.blankTeach){
        content = '      {posts.map(p =&gt; &lt;li&gt;{<span class="blank"><input id="blank-in" autocomplete="off" spellcheck="false" placeholder="?" /></span>}&lt;/li&gt;)}';
      } else if(opts.solved){
        content = '      {posts.map(p =&gt; &lt;li&gt;{<span class="hlline" style="width:auto">p.title</span>}&lt;/li&gt;)}';
      } else {
        content = '<span class="tline'+(opts.highlight?' hlline':'')+'">'+LINES[i]+'</span>';
      }
    }
    out.push(content + (opts.caret && i === n-1 ? '<span class="caret"></span>' : ''));
  }
  codeEl.innerHTML = out.join("\n");
}

async function typeCode(token){
  for(let n=1;n<=LINES.length;n++){
    renderCode(n, { caret:true });
    await sleep(prefersReduced ? 40 : 320);
    if(token !== runToken) return false;
  }
  renderCode(LINES.length, {});
  return true;
}

function waitForBlank(token){
  return new Promise((res)=>{
    const inp = document.getElementById("blank-in");
    let done = false;
    const finish = (v)=>{ if(done || token !== runToken) return; done = true; res(v); };
    if(inp){
      inp.addEventListener("keydown", (e)=>{ if(e.key === "Enter"){ e.preventDefault(); finish(inp.value.trim()); }});
      setTimeout(()=>{ try{ inp.focus(); }catch(e){} }, 30);
    }
    setTimeout(()=>finish(inp ? inp.value.trim() : ""), 9000); // auto-advance if idle
  });
}

async function play(){
  const token = ++runToken;
  codeEl.innerHTML = ""; panelEl.innerHTML = "";
  panelStat.textContent = "waking up…";
  ideAgent.textContent = "● Hermes · idle";
  const abort = ()=> token !== runToken;

  // 1 — greeting + permission
  await picaTyping(token); if(abort()) return;
  picaBubble(`Hey — I'm <strong>Pica</strong> 🐾 I'll ride along while Hermes writes your code. Mind if I watch?`);
  const allow = actionBtn("Allow Pica to watch");
  await clickOrWait(allow, 3600); if(abort()) return;
  allow.remove();
  const okd = picaBubble(`Perfect — I'll stay quiet until something's worth knowing. Go build. 👀`);

  // 2 — Hermes writes code
  panelStat.textContent = "watching your code";
  ideAgent.textContent = "● Hermes · writing";
  await sleep(700); if(abort()) return;
  await typeCode(token); if(abort()) return;
  ideAgent.textContent = "● Hermes · done";

  // 3 — detect
  await sleep(500);
  await picaTyping(token); if(abort()) return;
  renderCode(LINES.length, { highlight:true });
  picaBubble(`Ooh — that <code>.map()</code> line. Want to know what it's actually doing? 🐾`);
  const yes = actionBtn("Yes, explain");
  await clickOrWait(yes, 4200); if(abort()) return;
  yes.remove();

  // 4 — explain (in chosen tone)
  await picaTyping(token); if(abort()) return;
  picaBubble(EXPLAIN[tone]);
  await picaTyping(token); if(abort()) return;
  picaBubble(EXPLAIN.concept);

  // 5 — practice offer
  await sleep(400);
  const tryBtn = actionBtn("Now let me try it");
  await clickOrWait(tryBtn, 4200); if(abort()) return;
  tryBtn.remove();

  // 6 — practice: blank the line, wait for the visitor to type
  renderCode(LINES.length, { blankTeach:true });
  picaBubble(`Your turn — fill the blank. What should each row show? <span class="hint">(hint: the post's <em>title</em>)</span>`);
  const answer = await waitForBlank(token); if(abort()) return;
  const right = /title/i.test(answer);
  renderCode(LINES.length, { solved:true });
  await picaTyping(token); if(abort()) return;
  picaBubble(right
    ? `✓ <strong>p.title</strong> — nailed it. You just wrote the line Hermes would've. <strong>Concept unlocked: mapping a list.</strong>`
    : `Close — the answer's <strong>p.title</strong>: show each post's title. You'll get the next one. <strong>Concept unlocked: mapping a list.</strong>`);

  // 7 — payoff + gate
  await sleep(400);
  await picaTyping(token); if(abort()) return;
  picaBubble(`That's 1 concept today. The free taste covers a couple a day — unlock unlimited + an evening drill for <strong>₹99</strong>. 🐾`);
  const buy = actionBtn("Unlock everything — ₹99");
  buy.addEventListener("click", ()=> document.getElementById("buy").scrollIntoView({ behavior:"smooth" }));
  panelStat.textContent = "that's the loop ✦ replay below";
}

/* tone toggle — restarts the run in the chosen voice */
document.querySelectorAll(".tone-btn").forEach((b)=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".tone-btn").forEach((x)=>x.classList.remove("is-active"));
    b.classList.add("is-active"); tone = b.dataset.tone; play();
  });
});
const replayBtn = document.getElementById("demo-replay");
if(replayBtn) replayBtn.addEventListener("click", play);

/* autoplay once the demo scrolls into view */
let demoStarted = false;
function startDemo(){ if(demoStarted) return; demoStarted = true; play(); }
if("IntersectionObserver" in window){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach((e)=>{ if(e.isIntersecting){ startDemo(); io.disconnect(); } });
  }, { threshold:0.3 });
  io.observe(document.getElementById("proto"));
} else { startDemo(); }

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
