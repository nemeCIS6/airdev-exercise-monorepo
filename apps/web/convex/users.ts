import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  assertRole,
  getCallerProfileOrNull,
  requireAuthUserId,
} from "./lib/auth";

async function getEmailForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<string | null> {
  const user = await ctx.db.get(userId);
  return user?.email ?? null;
}

type ProfileWithEmail = Doc<"userProfiles"> & { email: string | null };

async function joinEmail(
  ctx: QueryCtx,
  profile: Doc<"userProfiles">,
): Promise<ProfileWithEmail> {
  return { ...profile, email: await getEmailForUser(ctx, profile.userId) };
}

export const getMyProfile = query({
  args: {},
  handler: async (ctx): Promise<ProfileWithEmail | null> => {
    const caller = await getCallerProfileOrNull(ctx);
    if (!caller) return null;
    return joinEmail(ctx, caller.profile);
  },
});

export const completeOnboarding = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, { displayName }): Promise<Id<"userProfiles">> => {
    const callerId = await requireAuthUserId(ctx);

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", callerId))
      .unique();
    if (existing) {
      throw new ConvexError("Profile already exists");
    }

    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      throw new ConvexError("Display name is required");
    }
    if (trimmed.length > 80) {
      throw new ConvexError("Display name must be 80 characters or fewer");
    }

    const firstManager = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "manager"))
      .first();

    return ctx.db.insert("userProfiles", {
      userId: callerId,
      displayName: trimmed,
      role: "employee",
      managerId: firstManager?.userId,
    });
  },
});

export const listMyTeam = query({
  args: {},
  handler: async (ctx): Promise<ProfileWithEmail[]> => {
    const { callerId } = await assertRole(ctx, "manager");
    const team = await ctx.db
      .query("userProfiles")
      .withIndex("by_managerId", (q) => q.eq("managerId", callerId))
      .collect();
    return Promise.all(team.map((p) => joinEmail(ctx, p)));
  },
});

export const listAllEmployees = query({
  args: {},
  handler: async (ctx): Promise<ProfileWithEmail[]> => {
    await assertRole(ctx, "manager");
    const employees = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "employee"))
      .collect();
    return Promise.all(employees.map((p) => joinEmail(ctx, p)));
  },
});

export const listAllManagers = query({
  args: {},
  handler: async (ctx): Promise<ProfileWithEmail[]> => {
    await assertRole(ctx, "manager");
    const managers = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "manager"))
      .collect();
    return Promise.all(managers.map((p) => joinEmail(ctx, p)));
  },
});

export const reassignEmployeeManager = mutation({
  args: {
    employeeUserId: v.id("users"),
    newManagerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, { employeeUserId, newManagerId }) => {
    await assertRole(ctx, "manager");

    const employeeProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", employeeUserId))
      .unique();
    if (!employeeProfile) {
      throw new ConvexError("Employee profile not found");
    }
    if (employeeProfile.role !== "employee") {
      throw new ConvexError("Target user is not an employee");
    }

    if (newManagerId !== null) {
      const managerProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", newManagerId))
        .unique();
      if (!managerProfile || managerProfile.role !== "manager") {
        throw new ConvexError("Target user is not a manager");
      }
    }

    await ctx.db.patch(employeeProfile._id, {
      managerId: newManagerId ?? undefined,
    });
  },
});
