import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Add an email to the waitlist. Dedupes on email (updates the existing row).
export const addWaitlist = mutation({
  args: {
    email: v.string(),
    building: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        building: args.building || existing.building,
        source: args.source,
      });
      return existing._id;
    }
    return await ctx.db.insert("waitlist", {
      email,
      building: args.building || "",
      source: args.source,
      createdAt: Date.now(),
    });
  },
});

// Record an order intent. Fired BEFORE the Dodo redirect so we keep the lead.
export const createOrder = mutation({
  args: {
    email: v.string(),
    amount: v.number(),
    status: v.string(),
    dodoRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    return await ctx.db.insert("orders", {
      email,
      amount: args.amount,
      status: args.status,
      dodoRef: args.dodoRef,
      createdAt: Date.now(),
    });
  },
});

// Usage ping from the plugin (fire-and-forget): email + event kind + token count.
// Users run inference on their OWN OpenRouter key — this is metrics only.
export const logEvent = mutation({
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

// Optional: called by a Dodo webhook to flip an order to paid.
export const markPaid = mutation({
  args: { email: v.string(), dodoRef: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const order = await ctx.db
      .query("orders")
      .withIndex("by_email", (q) => q.eq("email", email))
      .order("desc")
      .first();
    if (order) {
      await ctx.db.patch(order._id, { status: "paid", dodoRef: args.dodoRef });
      return order._id;
    }
    return await ctx.db.insert("orders", {
      email,
      amount: 99,
      status: "paid",
      dodoRef: args.dodoRef,
      createdAt: Date.now(),
    });
  },
});
