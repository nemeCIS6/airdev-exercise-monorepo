import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { canReadExpense } from "./lib/auth";

type EventWithActor = Doc<"expense_events"> & {
  actor: { displayName: string; role: string } | null;
};

export const listEventsForExpense = query({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, { expenseId }): Promise<EventWithActor[]> => {
    const expense = await ctx.db.get(expenseId);
    if (!expense) throw new ConvexError("Expense not found");
    await canReadExpense(ctx, expense);

    const events = await ctx.db
      .query("expense_events")
      .withIndex("by_expense_and_timestamp", (q) => q.eq("expenseId", expenseId))
      .order("desc")
      .collect();

    const actorCache = new Map<
      Id<"users">,
      { displayName: string; role: string } | null
    >();
    const lookupActor = async (
      actorId: Id<"users">,
    ): Promise<{ displayName: string; role: string } | null> => {
      if (actorCache.has(actorId)) return actorCache.get(actorId)!;
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", actorId))
        .unique();
      const result = profile
        ? { displayName: profile.displayName, role: profile.role }
        : null;
      actorCache.set(actorId, result);
      return result;
    };

    return Promise.all(
      events.map(async (event) => ({
        ...event,
        actor: await lookupActor(event.actorId),
      })),
    );
  },
});
