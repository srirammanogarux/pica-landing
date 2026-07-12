import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Is this email on the waitlist? (signup on the landing page = the license)
export const isSignedUp = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const row = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    return !!row;
  },
});

// How many calls in the last 24h — protects the shared OpenRouter key.
export const usageToday = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("usage")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    return rows.filter((r) => r.createdAt > dayAgo).length;
  },
});

export const logUsage = internalMutation({
  args: { email: v.string(), kind: v.string(), tokens: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("usage", {
      email: args.email.trim().toLowerCase(),
      kind: args.kind,
      tokens: args.tokens,
      createdAt: Date.now(),
    });
  },
});
