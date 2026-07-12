/* =====================================================================
   PICA — landing page logic (email list only)
   One place to change things. The only job: capture emails into Convex.
   ===================================================================== */
const CONFIG = {
  // Convex deployment URL, e.g. https://your-deployment-123.convex.cloud
  // Leave blank to run the page (signups log to the console instead of saving).
  CONVEX_URL: "https://doting-cuttlefish-341.convex.cloud",
  SOURCE: "landing",
};

/* ---------- Convex HTTP client (no build step) ---------- */
async function convexMutation(path, args){
  if(!CONFIG.CONVEX_URL){
    console.info("[pica] CONVEX_URL not set — would save:", path, args);
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
const saveEmail = (email) =>
  convexMutation("mutations:addWaitlist", { email, building:"", source:CONFIG.SOURCE });

/* ---------- signup forms (hero + bottom both land in one place) ---------- */
const validEmail = (v)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

document.querySelectorAll("[data-signup]").forEach((form)=>{
  const msg = form.parentElement.querySelector("[data-signup-msg]");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = form.email.value.trim();
    if(!validEmail(email)){ if(msg) msg.textContent = "That email looks off — mind checking it?"; return; }
    if(msg) msg.textContent = "Adding you…";
    const r = await saveEmail(email);
    if(r.ok || r.offline){
      if(msg) msg.innerHTML = 'You\'re in 🐾 <a href="/pica.vsix" download>Download the plugin</a>, install it in VS Code / Cursor (Extensions → ⋯ → <em>Install from VSIX</em>), and tell Pica this same email.';
      confetti(form.querySelector("button"));
      form.reset();
    } else if(msg){
      msg.textContent = "Hmm, that didn't save — try again in a sec?";
    }
  });
});

/* ---------- delight pass (all gated on prefers-reduced-motion) ---------- */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// pixel confetti burst from an element (used on signup success)
function confetti(fromEl){
  if(reduced || !fromEl) return;
  const r = fromEl.getBoundingClientRect();
  const colors = ["#E8823C","#F7A878","#5E9E45","#F5E663","#E24FB4","#4EC9F5"];
  const bits = [];
  for(let i=0;i<26;i++){
    const b = document.createElement("i");
    b.className = "confetti-bit";
    b.style.background = colors[i % colors.length];
    b.style.left = (r.left + r.width/2) + "px";
    b.style.top = (r.top + r.height/2) + "px";
    document.body.appendChild(b);
    bits.push({ el:b, x:0, y:0, vx:(Math.random()-.5)*7, vy:-(2+Math.random()*5.5), rot:Math.random()*360 });
  }
  const t0 = performance.now();
  (function tick(t){
    const done = t - t0 > 1100;
    bits.forEach(function(p){
      p.x += p.vx; p.y += p.vy; p.vy += .28; p.rot += 14;
      p.el.style.transform = "translate(" + p.x + "px," + p.y + "px) rotate(" + Math.round(p.rot/45)*45 + "deg)";
      if(done) p.el.remove();
    });
    if(!done) requestAnimationFrame(tick);
  })(t0);
}

if(!reduced){
  // 1 — hero cat blinks (swap to the closed-eyes frame for 130ms, randomly)
  const cat = document.querySelector(".hero__cat img");
  if(cat){
    const blink = new Image(); blink.src = "/pica-blink.png";
    const open = cat.src;
    (function blinkLoop(){
      setTimeout(function(){
        cat.src = blink.src;
        setTimeout(function(){ cat.src = open; blinkLoop(); }, 130);
      }, 2200 + Math.random()*2600);
    })();
    // cat perks up when you focus the signup box
    const heroCat = document.querySelector(".hero__cat");
    document.querySelectorAll(".signup input[name=email]").forEach(function(inp){
      inp.addEventListener("focus", function(){ heroCat.classList.add("peek"); });
      inp.addEventListener("blur", function(){ heroCat.classList.remove("peek"); });
    });
  }

  // 2 — typewriter on the accent line
  const tl = document.getElementById("typeline");
  if(tl){
    const full = tl.textContent;
    tl.textContent = "";
    let i = 0;
    (function type(){
      if(i <= full.length){ tl.textContent = full.slice(0, i); i++; setTimeout(type, 42); }
      else tl.classList.add("done");
    })();
  }

  // 3 — scroll reveals with stagger (progressive enhancement: classes added by JS)
  const targets = document.querySelectorAll(".acts__head, .feat, .step, .join__card");
  targets.forEach(function(el){ el.classList.add("reveal"); });
  const groups = {};
  document.querySelectorAll(".feat").forEach(function(el,i){ el.style.animationDelay = (i%3)*110 + "ms"; });
  document.querySelectorAll(".step").forEach(function(el,i){ el.style.animationDelay = i*130 + "ms"; });
  if("IntersectionObserver" in window){
    const io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold:.2 });
    targets.forEach(function(el){ io.observe(el); });
  } else {
    targets.forEach(function(el){ el.classList.add("in"); });
  }

  // 4 — ambient pixels drifting up through the hero
  const hero = document.querySelector(".hero");
  if(hero){
    const colors = ["#E8823C","#5E9E45","#F7A878","#E24FB4","#4EC9F5"];
    for(let i=0;i<9;i++){
      const p = document.createElement("i");
      p.className = "amb";
      p.style.background = colors[i % colors.length];
      p.style.left = (5 + Math.random()*90) + "%";
      p.style.bottom = (-10 - Math.random()*30) + "px";
      p.style.animationDuration = (14 + Math.random()*16) + "s";
      p.style.animationDelay = (-Math.random()*20) + "s";
      hero.appendChild(p);
    }
  }
}

/* ---------- the cat walks the ground line on scroll (pixel steps) ---------- */
const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const groundPica = document.getElementById("ground-pica");
if(groundPica && !prefersReduced){
  let ticking = false;
  window.addEventListener("scroll", ()=>{
    if(ticking) return; ticking = true;
    requestAnimationFrame(()=>{
      const p = window.scrollY / (document.body.scrollHeight - window.innerHeight || 1);
      const step = Math.round(Math.min(1, Math.max(0, p)) * 120 / 8) * 8;
      groundPica.style.transform = `translateX(${step}px)`;
      groundPica.classList.toggle("walk", window.scrollY > 40);
      ticking = false;
    });
  }, { passive:true });
}
