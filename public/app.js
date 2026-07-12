/* =====================================================================
   PICA — landing page logic (email list only)
   One place to change things. The only job: capture emails into Convex.
   ===================================================================== */
const CONFIG = {
  // Convex deployment URL, e.g. https://your-deployment-123.convex.cloud
  // Leave blank to run the page (signups log to the console instead of saving).
  CONVEX_URL: "",
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
    if(msg) msg.textContent = (r.ok || r.offline)
      ? "You're on the list 🐾 I'll email your install link soon."
      : "Hmm, that didn't save — try again in a sec?";
    if(r.ok || r.offline) form.reset();
  });
});

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
