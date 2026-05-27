import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

export type Role = "employee" | "manager" | "finance";

export type CallerContext = {
  callerId: Id<"users">;
  profile: Doc<"userProfiles">;
};

export async function requireAuthUserId(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthenticated");
  }
  return userId;
}

export async function getCallerProfile(
  ctx: QueryCtx,
): Promise<CallerContext> {
  const callerId = await requireAuthUserId(ctx);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", callerId))
    .unique();
  if (!profile) {
    throw new ConvexError("No profile — complete onboarding first");
  }
  return { callerId, profile };
}

export async function getCallerProfileOrNull(
  ctx: QueryCtx,
): Promise<CallerContext | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return null;
  return { callerId: userId, profile };
}

export async function assertRole(
  ctx: QueryCtx,
  role: Role,
): Promise<CallerContext> {
  const caller = await getCallerProfile(ctx);
  if (caller.profile.role !== role) {
    throw new ConvexError(`Forbidden: ${role} role required`);
  }
  return caller;
}

export async function getSubmitterProfile(
  ctx: QueryCtx,
  submitterId: Id<"users">,
): Promise<Doc<"userProfiles">> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", submitterId))
    .unique();
  if (!profile) {
    throw new ConvexError("Submitter profile not found");
  }
  return profile;
}

export async function canReadExpense(
  ctx: QueryCtx,
  expense: Doc<"expenses">,
): Promise<CallerContext> {
  const caller = await getCallerProfile(ctx);
  const { callerId, profile } = caller;

  if (expense.employeeId === callerId) return caller;
  if (profile.role === "finance") return caller;
  if (profile.role === "manager") {
    const submitter = await getSubmitterProfile(ctx, expense.employeeId);
    if (submitter.managerId === callerId) return caller;
  }
  throw new ConvexError("Forbidden: cannot read this expense");
}

export async function assertManagerOfSubmitter(
  ctx: QueryCtx,
  expense: Doc<"expenses">,
): Promise<CallerContext> {
  const caller = await assertRole(ctx, "manager");
  const submitter = await getSubmitterProfile(ctx, expense.employeeId);
  if (submitter.managerId !== caller.callerId) {
    throw new ConvexError("Forbidden: not your direct report");
  }
  return caller;
}
