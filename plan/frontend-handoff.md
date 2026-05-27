# Frontend Handoff — Expense Tracker

_Self-contained handoff for the Claude Code session that builds the Next.js frontend. Paste this into the session along with `expense-tracker-spec.md`, `convex-backend-handoff.md`, and the Claude Design prototype at `plan/claude-design-prototype/`. Backend (Convex schema + functions + seed) is built first per `convex-backend-handoff.md`._

---

## What this doc is for

This is the **frontend-only** build plan. It assumes the Convex backend is already complete and verified per `convex-backend-handoff.md` (schema pushed, auth wired, all queries/mutations working in the Convex dashboard, seed produces 3 users + 5 expenses).

Two reference inputs drive the build:

1. **Behavior + data contract**: `expense-tracker-spec.md` (sections 0, 3, 4, 6, 7) — what each page does, route tree, component specs.
2. **Visual contract**: `plan/claude-design-prototype/project/` — exact pixels, copy, layout, interactions. This is the design source of truth. **Do not improvise UI; port it.**

If they ever conflict, the prototype wins on visuals and copy; the spec wins on behavior and data shape.

---

## Source-of-truth hierarchy

When making decisions, consult in this order:

| Question | Source |
|---|---|
| What does this screen look like? Copy? Layout? | `claude-design-prototype/project/src/*.jsx` + `Expense Tracker.html` |
| What does this button do? What status transitions are allowed? | `expense-tracker-spec.md` §0, §2 (functions) |
| What's the Convex function name + signature? | `expense-tracker-spec.md` §2 + the `convex/` source generated from the backend handoff |
| What's the route URL? | `expense-tracker-spec.md` §3 |
| What goes in env vars? | `expense-tracker-spec.md` §6 + `convex-backend-handoff.md` |

Locked decisions are in `expense-tracker-spec.md` §0. Do not re-litigate.

---

## Where everything lives

```
apps/web/
├── app/
│   ├── layout.tsx                       # ConvexAuthProvider + ConvexReactClient + TopNav
│   ├── page.tsx                         # Role-aware redirect
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── onboarding/page.tsx
│   ├── (employee)/expenses/page.tsx     # My Expenses list (table + filters)
│   ├── (employee)/expenses/new/page.tsx # Creates draft, redirects to detail
│   ├── (employee)/expenses/[id]/page.tsx# Employee detail + edit + history
│   ├── (manager)/review/page.tsx
│   ├── (manager)/review/[id]/page.tsx
│   ├── (manager)/team/page.tsx
│   ├── (finance)/finance/review/page.tsx
│   └── (finance)/finance/review/[id]/page.tsx
├── components/
│   ├── ui/                              # shadcn/ui primitives (Button, Input, Card, etc.)
│   ├── expense-list.tsx                 # Shared table across all 3 roles
│   ├── expense-form.tsx                 # Parent fields + line items section
│   ├── line-items-section.tsx
│   ├── receipt-upload.tsx
│   ├── history-timeline.tsx
│   ├── role-guard.tsx
│   └── top-nav.tsx
├── convex/                              # built by backend handoff — don't touch shapes here
└── lib/
    ├── format.ts                        # money / date / time-ago helpers (port from store.jsx)
    └── utils.ts                         # cn() etc.
```

The route-group folder structure (with `(employee)`, `(manager)`, `(finance)`) already exists from task #1.

---

## Setup (do these first, in order)

### 1. Scaffold Next.js into `apps/web/`

```bash
cd apps/web
# scaffold but keep our pre-created route-group folders
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --eslint --no-import-alias
```

If it complains about the directory not being empty, point it to a temp dir and merge files in, or use `--force`. The existing route-group folders under `app/` are empty and safe to keep.

### 2. Install dependencies

```bash
npm install convex @convex-dev/auth @auth/core
npx shadcn@latest init       # New York style, neutral base color, CSS variables yes
```

Add these shadcn components (matches what the prototype uses):

```bash
npx shadcn@latest add button input textarea label select checkbox card badge dialog popover dropdown-menu separator skeleton sonner table tabs
```

Install icons (the prototype uses Lucide):

```bash
npm install lucide-react
```

### 3. Tailwind theme

The prototype defines a custom theme in `Expense Tracker.html` lines 9–37. Mirror these tokens in `tailwind.config.ts` and `app/globals.css` (shadcn already sets most of them; just confirm the HSL values and the Inter font import match).

Add the Inter font via `next/font/google` in `app/layout.tsx`.

### 4. Convex provider

In `app/providers.tsx` (new client component):

```tsx
"use client";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
```

Wrap `<Providers>` around `{children}` in `app/layout.tsx`. Add the auth middleware per Convex Auth's Next.js docs (`middleware.ts` at the repo `apps/web/` root).

### 5. Toast + Nav guard

The prototype uses a `ToastProvider` (in `ui.jsx`) and `NavGuardProvider` (warn-on-navigate when there are unsaved form changes). Replace toast with shadcn's `<Sonner />` (set up in root layout). Port the nav guard logic — it's small — into `components/nav-guard.tsx`.

---

## Build order (16 steps, mirrors the spec's build order)

Each step references the matching prototype file. **Read the prototype file first, then reproduce in Next.js + shadcn.**

### Step 1 — Root layout + provider + top nav

- **Prototype**: `app.jsx` (the `TopNav` component, ~lines 3–77)
- **Build**: `app/layout.tsx`, `app/providers.tsx`, `components/top-nav.tsx`
- **Wires**: ConvexAuthProvider, role-aware nav links (employee: "My Expenses"; manager: "Review" + "Team"; finance: "Review"), user menu with sign-out
- **Convex calls**: `useQuery(api.users.getMyProfile)` to know the role; `useAuthActions().signOut` from `@convex-dev/auth/react`

### Step 2 — Auth pages (sign-in, sign-up, onboarding)

- **Prototype**: `auth.jsx` (SignIn, SignUp, Onboarding components)
- **Build**: `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `app/onboarding/page.tsx`
- **Convex calls**: `useAuthActions().signIn("password", { email, password, flow: "signIn" | "signUp" })`; on first sign-up, `useMutation(api.users.completeOnboarding)({ displayName })`
- **Note**: prototype's `signUp` takes `(email, password, name)` and creates a profile in one shot. With Convex Auth, sign-up creates the auth user only; the `/onboarding` page captures `displayName` separately and calls `completeOnboarding`. Adjust the SignUp form accordingly (drop the `name` field, push it to onboarding).

### Step 3 — RoleGuard + role-aware redirect

- **Prototype**: implicit in `app.jsx`'s `Router` (lines 79–128)
- **Build**: `components/role-guard.tsx`. Used in each route-group's `layout.tsx`:

```tsx
// app/(employee)/layout.tsx
import { RoleGuard } from "@/components/role-guard";
export default function EmployeeLayout({ children }) {
  return <RoleGuard role="employee">{children}</RoleGuard>;
}
```

- **`RoleGuard` logic**: call `useQuery(api.users.getMyProfile)`. If loading → skeleton. If null → push `/onboarding`. If role mismatch → push the right home (employee → `/expenses`, manager → `/review`, finance → `/finance/review`). Else render children.
- **`app/page.tsx`**: thin redirect — if unauth → `/sign-in`, else uses `getMyProfile` to route to the right home.

### Step 4 — Shared expense list table + filters

- **Prototype**: `employee.jsx` (StatusCountChips, MultiCheckPopover, ExpenseFilters, table render) and the equivalent in `manager.jsx` / finance section
- **Build**: `components/expense-list.tsx` — one component used by all three role lists. Props: `expenses`, `viewerRole`, optional `statusDefault`
- **Columns** (from spec §4.1): Summary · Categories breakdown · Total · Currency · Status · Submitted At · (employee column for manager + finance views)
- **Categories breakdown column**: use the prototype's `categoriesColText` helper — top 3 categories with subtotals + "+N more" if more
- **Pages**:
  - `app/(employee)/expenses/page.tsx` → `useQuery(api.expenses.listMyExpenses, { statuses, dateRange })`
  - `app/(manager)/review/page.tsx` → `useQuery(api.expenses.listExpensesForReview, {...})`
  - `app/(finance)/finance/review/page.tsx` → same query, different role context

### Step 5 — New expense form (parent fields + file upload)

- **Prototype**: top section of `detail.jsx` (summary, currency, expenseDate, merchant, receipt upload)
- **Build**: `components/expense-form.tsx` (parent section only at this step), `components/receipt-upload.tsx`
- **Route**: `app/(employee)/expenses/new/page.tsx` — on mount, fire `useMutation(api.expenses.createDraft)({ summary: "", currency: "USD", expenseDate: today() })`, then `router.replace(\`/expenses/${id}\`)`. This matches the prototype's "create then redirect" pattern in `app.jsx`.
- **Receipt upload flow** (replaces prototype's stubbed `receipt: { name, type }`):
  1. `useMutation(api.files.generateUploadUrl)` → POST file to that URL → get `{ storageId }` back
  2. Set `receiptStorageId` on the draft via `saveDraftWithLines`
  3. Render existing receipt via `useQuery(api.files.getReceiptUrl, { storageId })`
- Client-side validation: type in `["image/jpeg","image/png","image/webp","application/pdf"]`, size ≤ 10MB. Server also validates.

### Step 6 — Line items section in the form

- **Prototype**: `detail.jsx` line-items table (the per-line description / category / qty / unit-amount rows + add/remove buttons + live total)
- **Build**: `components/line-items-section.tsx`
- **Save flow**: form holds local `lines[]` state. On "Save draft" / "Submit" click, send full `lines` array to `useMutation(api.expenses.saveDraftWithLines)({ expenseId, parentFields, lines })`. Server diffs and writes per-line events with one `saveGroupId`.
- **Add line**: append `{ id: uid(), description: "", category: "other", quantity: 1, unitAmount: 0 }`. The `id` is client-generated only for React keys and the server-side diff — Convex will assign real IDs on insert.
- **Remove line**: remove from array. On save, server's diff produces a `line_removed` event.
- **Validation**: at least 1 line; per-line description non-empty, `quantity > 0`, `unitAmount > 0`; expenseDate ≤ today; receipt present on submit.

### Step 7 — Employee detail page

- **Prototype**: `detail.jsx` employee view + button bar (Save Draft, Discard, Submit, Withdraw, Resubmit)
- **Build**: `app/(employee)/expenses/[id]/page.tsx`
- **Reads**: `useQuery(api.expenses.getExpense, { id })` + `useQuery(api.events.listEventsForExpense, { id })` + `useQuery(api.files.getReceiptUrl, { storageId })`
- **Status → editable rules**: editable when `status in ["draft","rejected"]`. Read-only for `pending_*` and `approved`.
- **Button visibility** (from spec §4.3):
  - `draft`: Save Draft · Discard · Submit (Submit disabled until lines + receipt valid)
  - `pending_manager` / `pending_finance`: Withdraw
  - `approved`: no buttons
  - `rejected`: Save Draft · Resubmit (banner shows rejection reason + which step)
- **Mutations**: `saveDraftWithLines`, `submitExpense`, `withdrawExpense`, `resubmitRejected`, `discardDraft`

### Step 8 — Manager detail page

- **Prototype**: `detail.jsx` manager view (read-only fields + approve/reject inline expansions)
- **Build**: `app/(manager)/review/[id]/page.tsx`
- **Authorization**: backend already enforces direct-report check. UI: if `getExpense` throws (caught error), show "Not authorized" empty state.
- **Buttons**: visible only when `status === "pending_manager"`. Approve (optional note, expands inline) → `managerApprove`. Reject (required reason, 5–500 chars) → `managerReject`.
- **Status banners**: if status moved on (pending_finance / approved / rejected), show a read-only banner with who decided and when.

### Step 9 — Finance detail page

- **Prototype**: `detail.jsx` finance view — same as manager but with an extra "Manager approval" summary block at the top
- **Build**: `app/(finance)/finance/review/[id]/page.tsx`
- **Manager-approval summary block** (spec §4.4b): shows `managerDecidedBy` display name, `managerDecidedAt` formatted, and the manager's approval note (from the `manager_approved` event in the timeline). Renders only when status ≥ `pending_finance`.
- **Buttons**: visible only when `status === "pending_finance"`. `financeApprove` (optional note) / `financeReject` (required reason, 5–500 chars).

### Step 10 — History timeline (on all 3 detail pages)

- **Prototype**: `detail.jsx` timeline component
- **Build**: `components/history-timeline.tsx`
- **Data**: `listEventsForExpense` returns events DESC by timestamp, joined with actor displayName
- **Grouping**: events sharing a `saveGroupId` collapse into one expandable entry ("Edited 4 line items — click to expand"). Top-level events (created, submitted, withdrawn, resubmitted, manager_approved, finance_approved, rejected) render individually.
- **Icons + colors per event type**: mirror the prototype exactly. Each event row shows: icon, actor name, action label, time-ago, optional note (rejection reason, approval note).
- **Cuttable**: per the spec's "where to cut" list, the `saveGroupId` grouping is the first thing to drop if time runs short — render all events flat.

### Step 11 — Team page (manager only)

- **Prototype**: `manager.jsx` `ManagerTeam` component
- **Build**: `app/(manager)/team/page.tsx`
- **Reads**: `useQuery(api.users.listAllEmployees)` → table of employees with their current manager
- **Mutation**: `useMutation(api.users.reassignEmployeeManager)({ employeeId, managerId })` from a dropdown in each row
- **Cuttable**: per spec, the dropdown is cuttable; a read-only list is acceptable if time runs short.

### Step 12 — Empty / loading / error states sweep

- For each `useQuery`, render shadcn `<Skeleton>` blocks while loading. Match the prototype's `.skel` shimmer aesthetic — shadcn skeleton already does this.
- Empty states: lists with zero rows show the prototype's empty-state copy (e.g., "No expenses yet. Create your first.").
- Error boundary at each `[id]/page.tsx` for "Expense not found" and "Not authorized."

### Step 13 — Verify against the 3 reviewer test paths

Per the spec's submission requirements §9, these three flows must work on the live URL:

- Eddie submits → Morgan approves → Fiona approves → status flows correctly, history updates at each step
- Eddie submits → Morgan rejects → Eddie resubmits → Morgan approves → Fiona approves
- Eddie submits → Morgan approves → Fiona rejects → ends at rejected

### Step 14 — Wire Gemini OCR button (last feature — depends on backend §8)

**Skip unless the backend's `ai.ts` action is already implemented per `convex-backend-handoff.md` §8.**

- **Where**: line-items section of the form, only visible after a receipt is uploaded on a draft
- **Button**: "Auto-fill from receipt" with a sparkles icon. Loading state spins for ~3–8s.
- **Logic**:
  ```ts
  const extract = useAction(api.ai.extractLinesFromReceipt);
  const lines = await extract({ storageId: receiptStorageId });
  // Append (don't replace) onto local form state. Employee can then edit / remove / save.
  ```
- **Failure UX**: see backend handoff §8.

---

## Visual fidelity rules

The prototype is the visual contract. When building each screen:

1. **Open the matching prototype file first.** Read it top to bottom before writing the Next.js version.
2. **Match copy verbatim** — button labels, empty state messages, banner text, status chip wording.
3. **Match layout structure** — same column order, same spacing, same card grouping, same modal/popover positions.
4. **Use shadcn primitives**, not hand-rolled ones. The prototype's `ui.jsx` re-implements shadcn aesthetics by hand because Claude Design didn't have package access. We do — use the real shadcn components and the visual output matches.
5. **Theme tokens**: the prototype's `Expense Tracker.html` (lines 9–37) defines the exact HSL color tokens. shadcn's `New York` neutral preset is close; verify and adjust if needed.
6. **Icons**: use `lucide-react` with the exact same icon names the prototype passes to its `<Icon name="X" />` helper.

**Do not improvise UI changes.** If something in the prototype seems wrong, ask before deviating.

---

## Mapping: prototype mutations → Convex functions

The prototype's `store.jsx` is the in-memory analog of the Convex backend. Use this table when porting any screen:

| Prototype call (in `store.jsx`) | Convex equivalent |
|---|---|
| `store.signIn(email)` | `useAuthActions().signIn("password", {...})` |
| `store.signUp(email, pwd, name)` | `useAuthActions().signIn("password", { ..., flow: "signUp" })` + `api.users.completeOnboarding` |
| `store.setDisplayName(name)` | `api.users.completeOnboarding({ displayName })` |
| `store.signOut()` | `useAuthActions().signOut()` |
| `store.currentUser()` | `useQuery(api.users.getMyProfile)` |
| `store.createDraft(ownerId)` | `api.expenses.createDraft(...)` |
| `store.saveDraft(id, actorId, patch)` | `api.expenses.saveDraftWithLines(...)` |
| `store.submitExpense(id, actorId, patch)` | `saveDraftWithLines(...)` then `submitExpense({ id })` |
| `store.resubmitExpense(id, actorId, patch)` | `saveDraftWithLines(...)` then `resubmitRejected({ id })` |
| `store.withdrawExpense(id, actorId)` | `api.expenses.withdrawExpense({ id })` |
| `store.discardDraft(id)` | `api.expenses.discardDraft({ id })` |
| `store.managerApprove(id, actorId, note)` | `api.expenses.managerApprove({ id, note })` |
| `store.financeApprove(id, actorId, note)` | `api.expenses.financeApprove({ id, note })` |
| `store.rejectExpense(id, actorId, reason, "manager")` | `api.expenses.managerReject({ id, reason })` |
| `store.rejectExpense(id, actorId, reason, "finance")` | `api.expenses.financeReject({ id, reason })` |
| `store.assignManager(empId, mgrId)` | `api.users.reassignEmployeeManager(...)` |
| _(prototype mutates `expense.lines` in place)_ | Full `lines` array passed to `saveDraftWithLines`; server diffs |

The prototype's `lineTotal`, `expenseTotal`, `lineSummary`, `categoryBreakdown`, `categoriesColText`, `formatMoney`, `formatDate`, `formatDateTime`, `timeAgo` helpers should be ported verbatim into `lib/format.ts`. They're pure functions and need no Convex access.

---

## Acceptance checks (before declaring frontend done)

- [ ] All 3 role landings render the right top-nav and the right list query
- [ ] Sign-up of a new email lands on `/onboarding`, captures display name, then routes to `/expenses` as employee
- [ ] All 5 seeded expenses appear in Eddie's list with correct totals (sum of qty × unitAmount per line)
- [ ] Morgan's `/review` shows the 1 `pending_manager` expense; Fiona's `/finance/review` shows the 1 `pending_finance` expense
- [ ] Manager cannot approve at step 2; finance cannot approve at step 1 (server enforces; UI hides buttons)
- [ ] All 3 reviewer test paths from spec §9 work end-to-end
- [ ] Receipt upload roundtrip (JPG + PDF), file size check, MIME check
- [ ] Withdraw from `pending_finance` clears the manager's prior approval (verify via timeline + by re-submitting → goes back to step 1)
- [ ] Resubmit from rejected always lands at `pending_manager` regardless of who rejected
- [ ] Empty states + loading skeletons render for every list/detail page
- [ ] Gemini OCR button (§14) only renders after a receipt is uploaded, gracefully degrades on failure

---

## Quick reference

| Topic | Source |
|---|---|
| Locked decisions | `expense-tracker-spec.md` §0 |
| Route tree | `expense-tracker-spec.md` §3 |
| Component specs (columns, fields, button rules) | `expense-tracker-spec.md` §4 |
| Convex function signatures | `expense-tracker-spec.md` §2 + the source generated from backend handoff |
| Env vars | `expense-tracker-spec.md` §6 |
| Visual contract | `plan/claude-design-prototype/project/src/*.jsx` |
| Backend build plan | `plan/convex-backend-handoff.md` |
| Gemini OCR (final feature) | `plan/convex-backend-handoff.md` §8 + Step 14 above |
