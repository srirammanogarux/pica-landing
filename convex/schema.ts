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
});
