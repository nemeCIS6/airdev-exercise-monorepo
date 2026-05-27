# CLAUDE.md — Project Rails

_Read this first. Every Claude session working on this repo must follow these rails._

## What this is

The **Airdev Expense Tracker** technical exercise. A small but production-quality web app for employee expense submission with a fixed two-step approval chain (Manager → Finance). Stack is locked by the brief: **Convex** (backend, DB, file storage, auth) + **Next.js App Router** frontend.

This is a monorepo: the Next.js app + Convex backend both live at `apps/web/`.

## Source-of-truth hierarchy 

Read in this order. If two sources conflict, the higher one wins.

1. **`plan/expense-tracker-spec.md`** — the locked implementation spec. Schema, server functions, route tree, component specs, seed, README outline. Section 0 is the locked decisions log; **never re-litigate those decisions**.
2. **`plan/claude-design-prototype/project/`** — the visual contract. Hand-rolled HTML/CSS/JS prototype from Claude Design. Pixel-perfect target for the Next.js UI. Read the matching prototype file before building any screen.
3. **`plan/convex-backend-handoff.md`** — step-by-step backend build plan. Includes Gemini OCR as §8 (deferred to the very end).
4. **`plan/frontend-handoff.md`** — step-by-step frontend build plan. Maps prototype files to Next.js routes and Convex calls.
5. **`plan/session-handoff.md`** — high-level orientation if you're picking this up cold.

The other planning files (`claude-design-prompt.md`, `claude-design-followup-*.md`) are historical artifacts of how the prototype was built. Reference only if needed.

## File layout

```
airdev-exercise-monorepo/
├── CLAUDE.md                            # this file
├── plan/                                # all planning + design + handoff docs
│   ├── expense-tracker-spec.md
│   ├── convex-backend-handoff.md
│   ├── frontend-handoff.md
│   ├── session-handoff.md
│   ├── claude-design-prototype/         # visual contract
│   └── (other planning artifacts)
└── apps/
    └── web/                             # Next.js app + Convex backend
        ├── app/                         # App Router pages
        ├── components/
        ├── convex/                      # schema + server functions + seed
        ├── lib/
        └── public/
```

Working folders (`app/(employee)`, `app/(manager)`, `app/(finance)`, `convex/`, etc.) already exist as empty scaffolds.

## Hard rules

1. **Spec decisions are locked.** Section 0 of `expense-tracker-spec.md` is non-negotiable. Don't propose changes to status flow, role model, approval chain, currency list, category list, receipt rules, or any other locked decision without explicit user approval.

2. **Match the prototype visually.** The prototype in `plan/claude-design-prototype/` is the design source of truth. Use shadcn/ui primitives but match the prototype's layout, copy, spacing, and color tokens. Don't improvise UI; don't redesign; don't substitute different copy.

3. **Use Convex for all state.** No `localStorage`, no `sessionStorage`, no in-memory mock stores in production code. The prototype's `store.jsx` is a reference for behavior only — its data lives in Convex via the queries/mutations defined in spec §2.

4. **Three test accounts, exact credentials:**
   - `employee@example.com` / `employee123!` — Eddie Employee
   - `manager@example.com` / `manager123!` — Morgan Manager
   - `finance@example.com` / `finance123!` — Fiona Finance

   These come from the seed script. Don't change the emails, names, or passwords — they're in the submission checklist.

5. **Gemini OCR is the LAST feature.** Receipt → auto-populate line items via Gemini Vision is scoped in `convex-backend-handoff.md` §8 and `frontend-handoff.md` step 14. **Do not build it until the entire app is otherwise complete, deployed, and the three reviewer test paths pass on the live URL.** It's a delight feature, not core flow.

6. **Always check `auth.getUserId(ctx)` first in Convex functions.** No function trusts the client to pass role or userId. Authorization helpers are in spec §2.3.

7. **`saveDraftWithLines` is the only mutation that touches `expense_lines`.** It diffs server-side and writes events with a shared `saveGroupId`. Don't create a separate "addLine" or "deleteLine" mutation.

8. **Status is authoritative.** Manager mutations check `status === "pending_manager"`. Finance mutations check `status === "pending_finance"`. Approved is immutable. Rejected is editable and resubmittable. Resubmit always restarts at `pending_manager`.

9. **`submittedAt` is set ONCE and survives withdraw/resubmit cycles.** Easy to get wrong. The spec is explicit; verify when implementing `withdrawExpense` and `resubmitRejected`.

## What NOT to do

- Don't run `npm run dev`, `npx convex dev`, or any long-running server without the user asking. The user runs them in their own terminals.
- Don't push to a Convex production deployment or deploy to Vercel without explicit instruction.
- Don't add features outside the spec. If something seems missing, ask.
- Don't drop a dependency on the spec's locked enums (currencies, categories, statuses, roles). They're part of the contract.
- Don't change the prototype files in `plan/claude-design-prototype/`. They're the reference, not editable.
- Don't combine the two follow-up prompts into the prototype — they've already been applied. The prototype as-is is the final visual reference.

## Build order

The single canonical sequence is in `plan/expense-tracker-spec.md` §8 ("Build order"). It's tracked task-by-task in the live task list. Always check `TaskList` before starting work.

In summary: scaffold → schema → auth → role guard → list + filters → form (parent → line items) → detail pages (employee → manager → finance) → history timeline → team page → state sweep → seed → deploy → README → Gemini OCR.

## Submission requirements (last task)

The brief requires (from `plan/expense-tracker-spec.md` §9):
- Public GitHub repo with `README.md` (setup + design decisions) and `.env.example`
- Live Vercel URL, fully functional, seed run against production
- Three test account credentials in the submission message
- Three end-to-end flows verified live: full approval, reject-and-resubmit, manager-approves-finance-rejects

## Tone for this project

The user is steering this build directly. Move fast, ask before deviating, flag risks plainly, and don't pad responses with unnecessary explanation. When in doubt about a visual or data detail, point at the prototype or the spec rather than guessing.
