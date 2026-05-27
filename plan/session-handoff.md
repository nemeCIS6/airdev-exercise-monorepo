# Expense Tracker — Session Handoff

_Portable summary of the entire planning session. Paste this into Cowork (or any fresh Claude chat) along with the four attached files below to continue work without context loss._

---

## Quick orientation: what is this?

This is the **Airdev Technical Exercise — Expense Tracker** build. The exercise asks for a small but production-quality web app with employee expense submission and an approval flow. Tech stack is fixed by the brief: **Convex** (backend + DB + file storage + auth) and a **React/Next.js** frontend. Three-day clock to build and submit; **today is the last day**.

Planning has been done. Spec is locked. Prototype is in progress in Claude Design. Implementation will be done with Claude Code at home.

---

## Current status

**Build clock**: last day. Realistic build window: 6–8 hours. Scope is tight on this budget (see "honest time reality" at the bottom).

**Done:**
1. Requirements consolidated from the brief PDF + video transcript
2. Scope triaged — what's in v1, what's deferred, what's cut
3. Design decisions locked (form shape, list views, history, seed data, etc.)
4. Implementation spec written — schema, server functions, route tree, components, seed, build order
5. Prototype prompt for Claude Design written (initial single-approver version)
6. **Line items added mid-planning** — every expense composed of 1+ line items with per-line description, category, quantity, unit amount
7. **Multi-step approval added mid-planning** — new `finance` role, fixed two-step chain Manager → Finance, either step can reject

**In progress:**
- Prototype in Claude Design. Initial version (pre-line-items, pre-multi-step) is built and working. Two follow-up prompts queued to refactor the prototype:
  1. Add line items
  2. Add finance role + two-step approval

**Not started:**
- Claude Code implementation
- Deploy
- Submission

---

## What the app does

**Roles** (3 in v1): `employee`, `manager`, `finance`

**Flow**:
1. Employee creates a draft expense with line items + receipt
2. Employee submits → status `pending_manager`
3. Employee's assigned manager approves or rejects
   - Approve → status `pending_finance`
   - Reject → status `rejected` (with required reason; editable + resubmittable)
4. Any finance user approves or rejects
   - Approve → status `approved` (immutable)
   - Reject → status `rejected` (with required reason)
5. Rejected expenses can be edited and resubmitted — always restart at `pending_manager`
6. Pending expenses (either step) can be withdrawn back to draft

**Key shape**: an expense is a **parent record** (summary, currency, date, merchant, receipt) plus **1+ line items** (description, category, quantity, unitAmount). Per-line category and amount. Currency is set once at the parent.

---

## Locked decisions (do not re-litigate)

These were settled through structured stress-testing. Each has a reason; the reason is in the spec.

| # | Decision |
|---|---|
| 1 | Scope is approval pipeline, not payment. No "Paid" status. |
| 2 | Three roles in v1: employee, manager, finance. Schema designed to add admin later. |
| 3 | Each employee has one assigned manager. Configurable from a manager-facing Team page. |
| 4 | Finance is a shared pool — any finance user can act at step 2. |
| 5 | Self-serve signup creates employees only. Manager + finance accounts are seeded. |
| 6 | Two-step chain Manager → Finance is **fixed in v1**. Schema designed for configurable chains in v2 but doesn't build them. |
| 7 | Resubmit always restarts at step 1 (manager), even if finance rejected. |
| 8 | Lifecycle: `draft → pending_manager → pending_finance → approved` OR rejected from either step. |
| 9 | Drafts: explicit "Save draft" button + warn-on-navigate. **No debounced autosave.** |
| 10 | Approve = optional note. Reject = required reason (5–500 chars). No "Request changes" state. |
| 11 | Audit trail: separate `expense_events` table. Per-line events with `saveGroupId` so timeline can collapse same-save edits. `actorRoleAtTime` captured on each event. |
| 12 | Currency stored per-expense, no FX conversion. Six options: USD, EUR, GBP, CAD, AUD, JPY. Default USD. |
| 13 | Categories: fixed enum (Travel, Meals, Lodging, Software, Supplies, Other). Per-line, not per-expense. |
| 14 | Receipt required at submit. Single file, image or PDF, ≤10MB. Stored in Convex file storage. |
| 15 | Manager sees direct reports only. Finance sees all `pending_finance` org-wide. |
| 16 | Managers and finance cannot submit expenses in v1 (clean role separation). |
| 17 | Dashboard = filterable list + status counts. No charts. No CSV export. |
| 18 | Notifications: none. Status reflected in-app only. |
| 19 | Auth: Convex Auth (email + password). Not Clerk. |
| 20 | Build the prototype in Claude Design first; hand off to Claude Code with prototype + spec. |
| 21 | shadcn/ui for the UI component library (prototype + production). |

---

## Tech stack (locked by brief)

- **Backend, DB, file storage, auth**: Convex (Convex Auth with email/password)
- **Frontend**: Next.js App Router + TypeScript + Tailwind + shadcn/ui
- **Deploy**: Vercel (frontend) + Convex managed cloud (backend)

---

## Files to attach when continuing this work

There are four key files. Attach **all of them** when picking this up in a new chat.

1. **`expense-tracker-spec.md`** — the implementation spec. Schema, server functions, route tree, component specs, seed data, build order, README outline. This is what Claude Code will consume. (622 lines)

2. **`claude-design-prompt.md`** — original prompt for Claude Design that built the initial prototype (single-approver, no line items). Already used. Kept for reference. (204 lines)

3. **`claude-design-followup-line-items.md`** — follow-up prompt for Claude Design to refactor the prototype to support line items. Should be pasted into the **existing Claude Design chat**, not a new one. (157 lines)

4. **`claude-design-followup-multi-approval.md`** — follow-up prompt for Claude Design to add the finance role and two-step approval. Pasted into the same chat **after** the line-items follow-up. (158 lines)

---

## Where to pick up

Depending on where you are:

### If the prototype isn't refactored yet
1. Open the existing Claude Design chat (the one that built the original prototype)
2. Paste `claude-design-followup-line-items.md`
3. Iterate until it works — test the five flows it lists at the bottom
4. Paste `claude-design-followup-multi-approval.md`
5. Iterate until the multi-step flows work — test all five flows it lists at the bottom
6. Time-box this whole loop to ~90 minutes max. The prototype is a spec validator, not the deliverable.

### If the prototype is refactored and ready
1. Paste this handoff doc + the spec into a fresh chat (Cowork or Claude)
2. Paste the final prototype code as well
3. Ask: "Draft the Claude Code prompt that hands off the spec and prototype for implementation."
4. Get back the prompt
5. Open Claude Code at home, paste the prompt + spec + prototype, build top to bottom

### If you're mid-build with Claude Code and need help
1. Paste this handoff doc + the spec into a fresh chat
2. Paste the relevant chunk of Claude Code's output + the error / question
3. Get a targeted answer

---

## Build order summary (from the spec)

When Claude Code starts, the order is:

1. Scaffold (Next.js + Tailwind + Convex + Convex Auth)
2. Schema (3 tables + auth tables, all 3 roles, multi-step status enum)
3. Auth wiring (sign in / sign up / sign out / onboarding)
4. `getMyProfile` + `RoleGuard` for all 3 roles
5. Expense list + filters (same component for all 3 roles)
6. New expense form — parent fields + file upload
7. Line items section in the form (with server-side diff via `saveDraftWithLines`)
8. Employee detail page (edit / withdraw / resubmit)
9. Manager detail page (managerApprove / managerReject)
10. Finance detail page (financeApprove / financeReject, with manager approval callout)
11. History timeline on all 3 detail pages (with saveGroupId grouping)
12. Team page (manager only — reassign employees)
13. Empty / loading / error states sweep
14. Seed script (5 expenses, 3 users, idempotent)
15. Deploy to Vercel + run seed against prod
16. README (setup + design decisions + assumptions)

**Where to cut if running long** (in priority order, from the spec):
1. saveGroupId timeline grouping (still write events, just don't collapse them visually)
2. Status badge tooltips on rejected expenses
3. Team page reassignment dropdown (read-only employee list is enough)

**Do NOT cut**: the two-step approval flow, the line items, or the seed data. Those are the spine.

---

## Honest time reality

The original budget of 6–8 hours was for single-approver, no line items. Line items + multi-step add an estimated 4–6 hours of work. Realistic total: **10–14 hours** for a first-time Convex user.

This was raised mid-planning and the choice was made to keep the expanded scope. The "where to cut" list above exists for this reason. **If not 70% done by hour 5, start cutting immediately.**

---

## Submission requirements (from brief)

- [ ] Public GitHub repo with `README.md` (setup + design decisions) and `.env.example`
- [ ] Live Vercel URL, fully functional, seed run against production
- [ ] **Three test account credentials** in submission message:
  - `employee@example.com` / `employee123!` (Eddie Employee)
  - `manager@example.com` / `manager123!` (Morgan Manager)
  - `finance@example.com` / `finance123!` (Fiona Finance)
  - Note: brief only requires 2 (employee + manager). Adding finance because two-step approval needs all three roles to be demoable.
- [ ] End-to-end verified on the live URL:
  - Employee submits → manager approves → finance approves → status flows correctly, history updates at each step
  - Employee submits → manager rejects → employee resubmits → manager approves → finance approves
  - Employee submits → manager approves → finance rejects → ends at rejected

---

## Open items / risks to watch

- **Convex Auth setup** (JWT_PRIVATE_KEY, JWKS): generate per their docs. Easy step but can eat 15 min on first try.
- **Convex storage signed URLs**: may have a TTL. Re-fetch on each load rather than caching.
- **`submittedAt` preservation rule** on withdraw/resubmit cycles: easy to get wrong. Spec is explicit but eyeball the implementation.
- **Step 7 (line items in form with server-side diff)** is the hardest single piece of code in the build. Budget ≥ 90 minutes. If it's blocking, simplify by writing one event per save instead of one per line change.
- **Prototype scope** is bigger now too. If Claude Design gets confused applying both follow-ups separately, paste them together as one combined refactor.

---

## How this planning conversation went (in case context matters)

The session covered: requirements consolidation → scope triage with explicit "in / deferred / cut" decisions on every open item → design decisions (form shape, list columns, history, seed) → spec assembly → prototype prompt for Claude Design. After the prototype was built once, **two scope additions came in mid-planning**:

1. **Line items**: I pushed back on full expressiveness (per-line amount + per-line category + per-line events) because of time cost. The decision was to take full expressiveness anyway — heard, locked, moved on.
2. **Multi-step approval**: I pushed back **harder** because the brief explicitly flags multi-level approvals as future scope. The decision was to build it anyway, as a fixed two-step Manager → Finance chain (the simplest version that's still genuinely multi-step). The schema is designed so configurable chains can be added in v2.

The spec, the prototype follow-ups, and this handoff all reflect both additions.
