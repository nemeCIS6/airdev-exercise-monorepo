# Claude Design Prompt — Expense Tracker Prototype

> Paste everything below into Claude Design as a single message. The companion spec (`expense-tracker-spec.md`) is the source of truth for behavior; this prompt translates it into a frontend-only prototype.

---

Build a high-fidelity, production-quality interactive prototype of an **internal Expense Tracker** as a single React artifact. This is a frontend-only prototype with mocked auth, mocked data, and mocked file uploads — no real backend. The prototype will be handed off to Claude Code, which will wire the same UI to a Convex backend, so use **shadcn/ui** components throughout (`@/components/ui/...`) since that's what the production app will use.

## Product summary

Employees submit expenses (description, amount, currency, category, date, optional merchant, required receipt). Their assigned manager reviews submissions and approves or rejects them. The app has two roles — `employee` and `manager` — determined by which email signs in. Every state transition is recorded in a per-expense history timeline visible to both parties.

## Tech for the prototype

- Single React artifact, shadcn/ui components
- Client-side routing via React state (no router library; the artifact runtime doesn't need one)
- In-memory store for mock data; mutations update local state and re-render
- Tailwind for layout, no inline styles
- Use `lucide-react` icons throughout
- **Do not use localStorage or sessionStorage** — artifacts don't support browser storage. Keep all state in React state.

## Mock authentication

There's no real auth. Implement a login form that accepts any password and routes based on email:

| Email | Role | Display name |
|---|---|---|
| `manager@example.com` | manager | Morgan Manager |
| `employee@example.com` | employee | Eddie Employee |

Sign-up always creates an employee. After sign-up, route to an onboarding screen that captures the display name, then drop them into the employee home (with empty state).

A small "Sign out" action in the top nav returns to the sign-in screen.

## Screens to build

All screens from below must be implemented and reachable. Use a top nav that changes by role.

### Unauthenticated
1. **Sign in** — email, password, "Sign in" button, link to sign-up
2. **Sign up** — email, password, confirm password, "Create account" button, link to sign-in
3. **Onboarding** — only shown if signed in but no profile; captures display name

### Employee (after `employee@example.com` signs in)
4. **My Expenses** — table list of the employee's own expenses, filters above the table
5. **New Expense** — creates a draft, then redirects to detail
6. **Expense Detail** — shows fields (editable if draft/rejected, read-only otherwise), history timeline, role-appropriate actions

### Manager (after `manager@example.com` signs in)
7. **Review** — table list of expenses needing review (default filter: pending), filters above
8. **Expense Detail (manager view)** — read-only fields, approve/reject inline actions, history timeline
9. **Team** — table of all employees with a dropdown to change each employee's assigned manager

## Mock data (mirror the production seed script exactly)

**Users:**
- Morgan Manager — `manager@example.com`, role: manager
- Eddie Employee — `employee@example.com`, role: employee, managerId: Morgan

**Expenses (all owned by Eddie):**

1. **Draft** — "Office supplies — printer ink", **$47.83 USD**, supplies, 2 days ago, merchant: (none), receipt: (none yet). History: [created].
2. **Pending** — "Client lunch at Bistro 12", **$89.50 USD**, meals, 5 days ago, merchant: "Bistro 12", receipt: `bistro-12-receipt.jpg` (use a placeholder image). History: [created, submitted].
3. **Approved** — "Conference flight to SF", **$412.00 USD**, travel, 14 days ago, merchant: "United Airlines", receipt: `united-flight-receipt.pdf` (use a PDF icon). History: [created, submitted, approved by Morgan with note "Approved per Q2 travel budget"].
4. **Rejected** — "Team offsite dinner", **$280.00 USD**, meals, 10 days ago, merchant: "The Tavern", receipt: `tavern-receipt.jpg` (placeholder image). History: [created, submitted, rejected by Morgan with reason "Please itemize and resubmit — single line is too vague."].

Each history entry has: actor, action verb, timestamp, optional note.

## Design system

- **shadcn/ui** for all components: Button, Input, Label, Textarea, Select, Card, Table, Badge, Dialog, AlertDialog, Tabs, Toast (use Sonner pattern). Import from `@/components/ui/...`.
- **Color tokens**: use shadcn's default neutral theme. Don't override the design system; the polish should come from layout, spacing, and clean composition, not custom colors.
- **Status badges**:
  - Draft → `variant="secondary"` (gray)
  - Pending → `variant="outline"` with yellow text/border (use Tailwind's `border-yellow-500 text-yellow-700`)
  - Approved → green (use `bg-green-100 text-green-800 border-green-200`)
  - Rejected → `variant="destructive"`
- **Typography**: clean, generous line-height, no walls of text. Use the default shadcn type scale.
- **Layout**: sidebar-free. Top nav + main content area, max-width container (e.g. `max-w-6xl mx-auto px-6`). Tables get full width inside the container.

## Field specifications

### Expense form (new + edit)

Field order, label text, and validation:

1. **Description** — Textarea, required, placeholder "What was this expense for?"
2. **Amount** + **Currency** — number input (required, > 0) + Select dropdown of: USD, EUR, GBP, CAD, AUD, JPY. Default USD.
3. **Category** — Select, required. Options: Travel, Meals, Lodging, Software, Supplies, Other.
4. **Expense date** — native date input, required, `max={today}`. Default to today.
5. **Merchant** — text input, optional, placeholder "e.g. United Airlines"
6. **Receipt** — file input accepting `image/*,application/pdf`. Required to submit. Optional to save draft. On selection: store the filename in state, render either a placeholder image preview (for image types) or a PDF icon + filename (for PDF).

### Action buttons by state

| State | Buttons |
|---|---|
| Draft | Save draft · Submit · Discard draft |
| Pending (employee view) | Withdraw |
| Pending (manager view) | Approve · Reject |
| Rejected (employee view) | Edit · Resubmit (after edits) |
| Approved | (none — read only) |

### Manager approve/reject inline expansion

When the manager clicks **Approve** on a pending expense:
- Inline expansion appears below the action bar
- Optional textarea labeled "Note (optional)"
- "Confirm approval" and "Cancel" buttons
- On confirm: status → approved, write event to history, update timestamps

When the manager clicks **Reject**:
- Inline expansion appears
- Required textarea labeled "Reason (required, 5–500 chars)"
- "Confirm rejection" button disabled until reason is valid
- On confirm: status → rejected, write event, store reason on expense

### Withdraw flow

Clicking **Withdraw** on a pending expense:
- AlertDialog confirmation ("Withdraw this expense? It will return to Draft.")
- On confirm: status → draft, write `withdrawn` event, preserve `submittedAt` on the record (this matters for history accuracy)

### Resubmit flow

When viewing a rejected expense:
- Prominent banner at the top showing the rejection reason
- "Edit" enters edit mode
- After edits, "Resubmit" button: writes `edited` and `resubmitted` events, clears rejection reason, status → pending

## Tables (shared component between employee list and manager review)

### Columns

**Employee — My Expenses**: Date · Merchant · Category · Amount · Status · (row click → detail)

**Manager — Review**: Submitted on · Employee · Merchant · Category · Amount · Status · (row click → detail)

### Filters above the table (in this order)

- **Status** — multi-select via checkboxes in a Popover, default: employee = all, manager = `[pending]`
- **Category** — multi-select via checkboxes in a Popover, default: all
- **Date range** — two date inputs (from / to)
- A "Clear filters" link

### Status counts

Above the filters, show a row of small count chips: "Drafts: 1 · Pending: 1 · Approved: 1 · Rejected: 1" — filtered to the user's scope (own expenses for employee; direct reports for manager).

### Empty state

When no expenses match: a centered card with an icon, "No expenses to show" headline, body text appropriate to the role, and (employee only) a "New expense" CTA.

### Loading state

Skeleton rows (don't actually use a delay; this is for the design demo). Add a "Show loading state" dev toggle in the corner if helpful for screenshots.

## History timeline (on both detail pages)

- Reverse chronological vertical list under a "History" heading
- Each entry: an icon (one per event type), the actor's name and an action verb, a timestamp (relative like "2 hours ago", with absolute on hover via `title` attribute), and an optional note rendered as a blockquote-style indent (always shown for rejection reasons and approval notes)
- Event icons (use `lucide-react`): created → `FilePlus`, submitted → `Send`, withdrawn → `Undo2`, edited → `Pencil`, resubmitted → `Repeat`, approved → `CheckCircle2`, rejected → `XCircle`

## Warn-on-navigate

Implement a `useUnsavedChanges(isDirty: boolean)` hook that attaches a `beforeunload` listener and shows a custom in-app confirmation dialog when navigating between screens inside the artifact (since `beforeunload` won't show on internal route changes). The hook should:
- Track whether the form has unsaved changes since the last save/submit
- Intercept internal navigation when dirty, show an AlertDialog: "You have unsaved changes. Discard them?"
- On confirm → navigate. On cancel → stay.

## Team page (manager only)

Table: Display name · Email · Manager (Select dropdown of all managers + an "Unassigned" option). Changing the Select triggers a toast: "Eddie's manager updated to Morgan." Seeded state: Eddie is already assigned to Morgan.

For prototype purposes, you can show a single seeded employee (Eddie) and the single seeded manager (Morgan). Add a comment in the code noting that the production app supports many of each.

## Empty/loading/error sweep

Every list view and detail view must have an empty state, a loading skeleton, and an error state with a retry button. The states don't need to be triggered by real conditions — render them when there's no mock data, when a `loading` flag is true, or when a deliberately-thrown mock error fires.

## Top nav

- **Unauthenticated**: "Expense Tracker" logo/text on the left, "Sign in" and "Sign up" buttons on the right
- **Employee**: logo · "My Expenses" · "New Expense" · (right side) user menu with name + "Sign out"
- **Manager**: logo · "Review" · "Team" · (right side) user menu with name + "Sign out"

## What's intentionally out of scope for the prototype

- Real auth (mock it)
- Real file storage (use placeholder images and PDF icons)
- Real persistence (in-memory only; refresh resets to seed state — this is fine)
- Email notifications, CSV export, charts/analytics, mobile responsive polish beyond what shadcn gives you by default, multi-level approvals, payment tracking

## Deliverable

A single React artifact, fully interactive, that demonstrates the entire approval flow:

1. Sign in as employee → see "My Expenses" with the four seeded expenses
2. Click the draft → edit → save → submit → see it move to pending
3. Sign out, sign in as manager → see the pending expense in "Review"
4. Open it → approve or reject → see status update and history append
5. Sign out, sign back in as employee → see the updated status and history

Use the prototype's quality bar as a stand-in for the production app. Don't over-design, but every state should feel intentional and finished.
