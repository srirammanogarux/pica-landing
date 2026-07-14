import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  waitlist: defineTable({
    email: v.string(),
    building: v.optional(v.string()),
    source: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  orders: defineTable({
    email: v.string(),
    amount: v.number(),
    status: v.string(),          // initiated | paid | refunded
    dodoRef: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // every Hermes call the plugin makes, per user — activation + usage metrics
  usage: defineTable({
    email: v.string(),
    kind: v.string(),            // lesson | chat
    tokens: v.number(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // in-product feedback: after a user's first practice, Pica asks if it's helping
  feedback: defineTable({
    email: v.string(),
    rating: v.string(),          // up | down
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),
});
