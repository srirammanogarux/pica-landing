import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// The plugin talks to these endpoints. The user's signup email is the license;
// the OpenRouter key lives ONLY here (env var), never on the user's machine.
const MODEL = "nousresearch/hermes-4-70b";
const DAILY_CAP = 150; // calls per email per 24h — protects the shared key

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const http = httpRouter();

// Verify a signup email — the plugin calls this once at activation.
http.route({
  path: "/pica/auth",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!email.includes("@")) return json({ ok: false });
    const ok = await ctx.runQuery(internal.pica.isSignedUp, { email });
    return json({ ok });
  }),
});

// Proxy a chat completion to OpenRouter (Hermes 4) for a signed-up email.
http.route({
  path: "/pica/chat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 24) {
      return json({ error: "bad_request" }, 400);
    }
    const ok = await ctx.runQuery(internal.pica.isSignedUp, { email });
    if (!ok) return json({ error: "not_signed_up" }, 403);

    const used = await ctx.runQuery(internal.pica.usageToday, { email });
    if (used >= DAILY_CAP) return json({ error: "daily_limit" }, 429);

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return json({ error: "server_not_configured" }, 500);

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://pica-landing.vercel.app",
        "X-Title": "Pica",
      },
      body: JSON.stringify({
        model: MODEL, // pinned server-side — clients can't pick expensive models
        messages,
        temperature: 0.6,
        max_tokens: 900,
      }),
    });
    if (!r.ok) return json({ error: "upstream_" + r.status }, 502);
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";
    if (!reply) return json({ error: "empty_reply" }, 502);

    await ctx.runMutation(internal.pica.logUsage, {
      email,
      kind: String(body.kind || "chat"),
      tokens: Number(data?.usage?.total_tokens || 0),
    });
    return json({ reply });
  }),
});

export default http;
