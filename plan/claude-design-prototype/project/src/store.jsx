// Mock data store: line-item expenses + two-step approval (manager → finance).

const StoreCtx = React.createContext(null);

// ---- Helpers ----
function uid() { return Math.random().toString(36).slice(2, 10); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10 + (n % 6), 23 + (n % 30), 0, 0); return d.toISOString(); }
function today() { const d = new Date(); return d.toISOString().slice(0, 10); }
function dateNDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const CATEGORIES = ['Travel', 'Meals', 'Lodging', 'Software', 'Supplies', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
const CURRENCY_SYMBOL = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', JPY: '¥' };

const STATUSES = ['draft', 'pending_manager', 'pending_finance', 'approved', 'rejected'];
const STATUS_LABEL = {
  draft: 'Draft',
  pending_manager: 'Pending Manager',
  pending_finance: 'Pending Finance',
  approved: 'Approved',
  rejected: 'Rejected',
};

// ---- Seed users ----
const MORGAN = { id: 'u_morgan', name: 'Morgan Manager', email: 'manager@example.com',  role: 'manager',  managerId: null };
const EDDIE  = { id: 'u_eddie',  name: 'Eddie Employee', email: 'employee@example.com', role: 'employee', managerId: 'u_morgan' };
const FIONA  = { id: 'u_fiona',  name: 'Fiona Finance',  email: 'finance@example.com',  role: 'finance',  managerId: null };

function makeLine({ description, category, quantity = 1, unitAmount, sortOrder }) {
  return { id: 'l_' + uid(), description, category, quantity, unitAmount, sortOrder };
}

function seed() {
  // NOTE (prototype): production app supports many of each role; we seed one per role for demo.
  const users = [MORGAN, EDDIE, FIONA];

  // ---- Expense 1: Draft ----
  const e1Lines = [
    makeLine({ description: 'Black ink cartridge', category: 'Supplies', quantity: 2, unitAmount: 24.99, sortOrder: 0 }),
    makeLine({ description: 'A4 paper ream',       category: 'Supplies', quantity: 1, unitAmount: 8.50,  sortOrder: 1 }),
  ];

  // ---- Expense 2: Pending Manager ----
  const e2Group = 'g_' + uid();
  const e2Lines = [
    makeLine({ description: 'Lunch entrées', category: 'Meals', quantity: 2, unitAmount: 32.00, sortOrder: 0 }),
    makeLine({ description: 'Beverages',     category: 'Meals', quantity: 1, unitAmount: 18.50, sortOrder: 1 }),
    makeLine({ description: 'Tip',           category: 'Meals', quantity: 1, unitAmount: 7.00,  sortOrder: 2 }),
  ];

  // ---- Expense 3: Pending Finance ----
  const e3Group = 'g_' + uid();
  const e3Lines = [
    makeLine({ description: 'Notion workspace seat',  category: 'Software', quantity: 1, unitAmount: 14.00, sortOrder: 0 }),
    makeLine({ description: 'Figma editor seat',      category: 'Software', quantity: 1, unitAmount: 15.00, sortOrder: 1 }),
    makeLine({ description: 'Linear standard seat',   category: 'Software', quantity: 1, unitAmount: 10.00, sortOrder: 2 }),
  ];

  // ---- Expense 4: Approved ----
  const e4Group = 'g_' + uid();
  const e4Lines = [
    makeLine({ description: 'Round-trip flight SFO',            category: 'Travel',   quantity: 1, unitAmount: 312.00, sortOrder: 0 }),
    makeLine({ description: 'Conference proceedings (digital)', category: 'Software', quantity: 1, unitAmount: 100.00, sortOrder: 1 }),
  ];

  // ---- Expense 5: Rejected by manager ----
  const e5Lines = [
    makeLine({ description: 'Dinner for team', category: 'Meals', quantity: 1, unitAmount: 280.00, sortOrder: 0 }),
  ];

  const ev = (action, actor, atDays, extras = {}) => ({
    id: uid(), action, actor, at: daysAgo(atDays),
    note: null,
    actorRoleAtTime: actor === 'u_morgan' ? 'manager' : actor === 'u_fiona' ? 'finance' : 'employee',
    ...extras,
  });

  const expenses = [
    // --- 1: Draft ---
    {
      id: 'e_draft', employeeId: 'u_eddie', status: 'draft',
      summary: 'Office supplies — printer ink and paper', currency: 'USD',
      expenseDate: dateNDaysAgo(2), merchant: '', receipt: null,
      submittedAt: null,
      managerDecidedAt: null, managerDecidedBy: null,
      financeDecidedAt: null, financeDecidedBy: null,
      rejectedByRole: null, rejectionReason: null,
      lines: e1Lines,
      history: [ ev('created', 'u_eddie', 2) ],
      createdAt: daysAgo(2), updatedAt: daysAgo(2),
    },

    // --- 2: Pending Manager ---
    {
      id: 'e_pending_mgr', employeeId: 'u_eddie', status: 'pending_manager',
      summary: 'Client lunch at Bistro 12', currency: 'USD',
      expenseDate: dateNDaysAgo(5), merchant: 'Bistro 12',
      receipt: { name: 'bistro-12-receipt.jpg', type: 'image/jpeg' },
      submittedAt: daysAgo(4),
      managerDecidedAt: null, managerDecidedBy: null,
      financeDecidedAt: null, financeDecidedBy: null,
      rejectedByRole: null, rejectionReason: null,
      lines: e2Lines,
      history: [
        ev('created', 'u_eddie', 5),
        ev('line_added', 'u_eddie', 5, { note: lineSummary(e2Lines[0], 'USD'), saveGroupId: e2Group }),
        ev('line_added', 'u_eddie', 5, { note: lineSummary(e2Lines[1], 'USD'), saveGroupId: e2Group }),
        ev('line_added', 'u_eddie', 5, { note: lineSummary(e2Lines[2], 'USD'), saveGroupId: e2Group }),
        ev('submitted', 'u_eddie', 4),
      ],
      createdAt: daysAgo(5), updatedAt: daysAgo(4),
    },

    // --- 3: Pending Finance ---
    {
      id: 'e_pending_fin', employeeId: 'u_eddie', status: 'pending_finance',
      summary: 'Monthly SaaS subscriptions', currency: 'USD',
      expenseDate: dateNDaysAgo(3), merchant: 'Various',
      receipt: { name: 'saas-receipts.pdf', type: 'application/pdf' },
      submittedAt: daysAgo(3),
      managerDecidedAt: daysAgo(2), managerDecidedBy: 'u_morgan',
      financeDecidedAt: null, financeDecidedBy: null,
      rejectedByRole: null, rejectionReason: null,
      lines: e3Lines,
      history: [
        ev('created', 'u_eddie', 3),
        ev('line_added', 'u_eddie', 3, { note: lineSummary(e3Lines[0], 'USD'), saveGroupId: e3Group }),
        ev('line_added', 'u_eddie', 3, { note: lineSummary(e3Lines[1], 'USD'), saveGroupId: e3Group }),
        ev('line_added', 'u_eddie', 3, { note: lineSummary(e3Lines[2], 'USD'), saveGroupId: e3Group }),
        ev('submitted', 'u_eddie', 3),
        ev('manager_approved', 'u_morgan', 2, { note: 'Standard monthly tooling — approved.' }),
      ],
      createdAt: daysAgo(3), updatedAt: daysAgo(2),
    },

    // --- 4: Approved ---
    {
      id: 'e_approved', employeeId: 'u_eddie', status: 'approved',
      summary: 'Conference trip to SF', currency: 'USD',
      expenseDate: dateNDaysAgo(14), merchant: 'United Airlines + Hilton',
      receipt: { name: 'conference-receipt.pdf', type: 'application/pdf' },
      submittedAt: daysAgo(13),
      managerDecidedAt: daysAgo(12), managerDecidedBy: 'u_morgan',
      financeDecidedAt: daysAgo(11), financeDecidedBy: 'u_fiona',
      rejectedByRole: null, rejectionReason: null,
      lines: e4Lines,
      history: [
        ev('created', 'u_eddie', 14),
        ev('line_added', 'u_eddie', 14, { note: lineSummary(e4Lines[0], 'USD'), saveGroupId: e4Group }),
        ev('line_added', 'u_eddie', 14, { note: lineSummary(e4Lines[1], 'USD'), saveGroupId: e4Group }),
        ev('submitted', 'u_eddie', 13),
        ev('manager_approved', 'u_morgan', 12, { note: 'Approved per Q2 travel budget.' }),
        ev('finance_approved', 'u_fiona',  11, { note: 'Cleared for reimbursement.' }),
      ],
      createdAt: daysAgo(14), updatedAt: daysAgo(11),
    },

    // --- 5: Rejected (by manager) ---
    {
      id: 'e_rejected', employeeId: 'u_eddie', status: 'rejected',
      summary: 'Team offsite dinner', currency: 'USD',
      expenseDate: dateNDaysAgo(10), merchant: 'The Tavern',
      receipt: { name: 'tavern-receipt.jpg', type: 'image/jpeg' },
      submittedAt: daysAgo(9),
      managerDecidedAt: daysAgo(8), managerDecidedBy: 'u_morgan',
      financeDecidedAt: null, financeDecidedBy: null,
      rejectedByRole: 'manager',
      rejectionReason: 'Please itemize the meals and any alcohol separately, then resubmit.',
      lines: e5Lines,
      history: [
        ev('created', 'u_eddie', 10),
        ev('line_added', 'u_eddie', 10, { note: lineSummary(e5Lines[0], 'USD') }),
        ev('submitted', 'u_eddie', 9),
        ev('rejected', 'u_morgan', 8, { note: 'Please itemize the meals and any alcohol separately, then resubmit.' }),
      ],
      createdAt: daysAgo(10), updatedAt: daysAgo(8),
    },
  ];

  return { users, expenses };
}

// ---- Computed helpers ----
function lineTotal(line) {
  const q = parseFloat(line.quantity) || 0;
  const u = parseFloat(line.unitAmount) || 0;
  return Math.round(q * u * 100) / 100;
}
function expenseTotal(expense) {
  return (expense.lines || []).reduce((s, l) => s + lineTotal(l), 0);
}
function lineSummary(line, currency) {
  return `${line.description} — ${formatMoney(lineTotal(line), currency)}`;
}
function categoryBreakdown(expense) {
  const byCat = new Map();
  (expense.lines || []).forEach(l => {
    if (!l.category) return;
    byCat.set(l.category, (byCat.get(l.category) || 0) + lineTotal(l));
  });
  return Array.from(byCat.entries())
    .map(([category, subtotal]) => ({ category, subtotal }))
    .sort((a, b) => b.subtotal - a.subtotal);
}
function categoriesColText(expense) {
  const items = categoryBreakdown(expense);
  if (items.length === 0) return '—';
  const cur = expense.currency;
  if (items.length === 1) return `${items[0].category} ${formatMoney(items[0].subtotal, cur)}`;
  const top = items.slice(0, 3);
  let txt = top.map(it => `${it.category} ${formatMoney(it.subtotal, cur)}`).join(' · ');
  if (items.length > 3) txt += ` · +${items.length - 3} more`;
  if (txt.length > 60) txt = txt.slice(0, 57) + '…';
  return txt;
}

// ---- Diff lines for history events ----
function diffLines(oldLines, newLines, currency) {
  const oldById = new Map(oldLines.map(l => [l.id, l]));
  const newById = new Map(newLines.map(l => [l.id, l]));
  const events = [];
  newLines.forEach(l => {
    if (!oldById.has(l.id)) events.push({ action: 'line_added', note: lineSummary(l, currency) });
  });
  oldLines.forEach(l => {
    if (!newById.has(l.id)) events.push({ action: 'line_removed', note: lineSummary(l, currency) });
  });
  newLines.forEach(l => {
    const prev = oldById.get(l.id);
    if (!prev) return;
    const changed = prev.description !== l.description || prev.category !== l.category ||
      parseFloat(prev.quantity) !== parseFloat(l.quantity) || parseFloat(prev.unitAmount) !== parseFloat(l.unitAmount);
    if (changed) events.push({ action: 'line_edited', note: lineSummary(l, currency) });
  });
  return events;
}

// ---- Provider ----
function StoreProvider({ children }) {
  const [data, setData] = React.useState(seed);
  const [session, setSession] = React.useState(null);

  const api = React.useMemo(() => {
    const currentUser = () => session ? data.users.find(u => u.id === session.userId) : null;

    const stampEvent = (actorId, action, extras = {}) => {
      const actor = data.users.find(u => u.id === actorId);
      return {
        id: uid(), at: new Date().toISOString(), actor: actorId, action,
        actorRoleAtTime: actor ? actor.role : 'employee',
        note: null, ...extras,
      };
    };

    const applyEdit = (expenseId, actorId, patch, opts = {}) => {
      const now = new Date().toISOString();
      const groupId = 'g_' + uid();
      setData(d => ({ ...d, expenses: d.expenses.map(e => {
        if (e.id !== expenseId) return e;
        const newLines = patch.lines || e.lines;
        const currency = patch.currency || e.currency;
        const lineEvents = diffLines(e.lines, newLines, currency).map(ev =>
          stampEvent(actorId, ev.action, { note: ev.note, saveGroupId: groupId })
        );
        let newHistory = [...e.history, ...lineEvents];
        if (opts.appendEvent) newHistory.push(stampEvent(actorId, opts.appendEvent.action, opts.appendEvent));
        return { ...e, ...patch, history: newHistory, updatedAt: now };
      })}));
    };

    return {
      // ---- Auth ----
      signIn: (email) => {
        const u = data.users.find(x => x.email.toLowerCase() === email.toLowerCase());
        if (!u) return { ok: false, error: 'No account with that email. Try sign-up.' };
        setSession({ userId: u.id });
        return { ok: true, user: u };
      },
      signUp: (email, _password, name) => {
        if (data.users.find(x => x.email.toLowerCase() === email.toLowerCase())) {
          return { ok: false, error: 'An account with that email already exists.' };
        }
        const newUser = { id: 'u_' + uid(), email, name: name || '', role: 'employee', managerId: 'u_morgan', needsOnboarding: !name };
        setData(d => ({ ...d, users: [...d.users, newUser] }));
        setSession({ userId: newUser.id });
        return { ok: true, user: newUser };
      },
      setDisplayName: (name) => {
        const u = currentUser(); if (!u) return;
        setData(d => ({ ...d, users: d.users.map(x => x.id === u.id ? { ...x, name, needsOnboarding: false } : x) }));
      },
      signOut: () => setSession(null),
      currentUser,

      // ---- Expense mutations ----
      createDraft: (ownerId) => {
        const id = 'e_' + uid();
        const now = new Date().toISOString();
        const exp = {
          id, employeeId: ownerId, status: 'draft',
          summary: '', currency: 'USD',
          expenseDate: today(), merchant: '', receipt: null,
          submittedAt: null,
          managerDecidedAt: null, managerDecidedBy: null,
          financeDecidedAt: null, financeDecidedBy: null,
          rejectedByRole: null, rejectionReason: null,
          lines: [makeLine({ description: '', category: '', quantity: 1, unitAmount: 0, sortOrder: 0 })],
          history: [ stampEvent(ownerId, 'created') ],
          createdAt: now, updatedAt: now,
        };
        setData(d => ({ ...d, expenses: [exp, ...d.expenses] }));
        return id;
      },

      saveDraft: (id, actorId, patch) => applyEdit(id, actorId, patch),

      submitExpense: (id, actorId, patch) => applyEdit(id, actorId, {
        ...patch, status: 'pending_manager', submittedAt: new Date().toISOString(),
      }, { appendEvent: { action: 'submitted' } }),

      // Always restart at step 1 (manager), regardless of which step rejected
      resubmitExpense: (id, actorId, patch) => applyEdit(id, actorId, {
        ...patch,
        status: 'pending_manager',
        submittedAt: new Date().toISOString(),
        rejectionReason: null,
        rejectedByRole: null,
        managerDecidedAt: null, managerDecidedBy: null,
        financeDecidedAt: null, financeDecidedBy: null,
      }, { appendEvent: { action: 'resubmitted' } }),

      withdrawExpense: (id, actorId) => {
        setData(d => ({ ...d, expenses: d.expenses.map(e => {
          if (e.id !== id) return e;
          // If we were at pending_finance, manager's prior approval is undone.
          const clearedMgr = e.status === 'pending_finance';
          return {
            ...e,
            status: 'draft',
            updatedAt: new Date().toISOString(),
            managerDecidedAt: clearedMgr ? null : e.managerDecidedAt,
            managerDecidedBy: clearedMgr ? null : e.managerDecidedBy,
            history: [...e.history, stampEvent(actorId, 'withdrawn')],
          };
        })}));
      },

      discardDraft: (id) => {
        setData(d => ({ ...d, expenses: d.expenses.filter(e => e.id !== id) }));
      },

      managerApprove: (id, actorId, note) => {
        const now = new Date().toISOString();
        setData(d => ({ ...d, expenses: d.expenses.map(e => e.id === id ? {
          ...e, status: 'pending_finance',
          managerDecidedAt: now, managerDecidedBy: actorId,
          rejectedByRole: null, rejectionReason: null,
          updatedAt: now,
          history: [...e.history, stampEvent(actorId, 'manager_approved', { note: note || null })],
        } : e)}));
      },

      financeApprove: (id, actorId, note) => {
        const now = new Date().toISOString();
        setData(d => ({ ...d, expenses: d.expenses.map(e => e.id === id ? {
          ...e, status: 'approved',
          financeDecidedAt: now, financeDecidedBy: actorId,
          rejectedByRole: null, rejectionReason: null,
          updatedAt: now,
          history: [...e.history, stampEvent(actorId, 'finance_approved', { note: note || null })],
        } : e)}));
      },

      rejectExpense: (id, actorId, reason, role) => {
        const now = new Date().toISOString();
        setData(d => ({ ...d, expenses: d.expenses.map(e => e.id === id ? {
          ...e, status: 'rejected',
          rejectedByRole: role,
          rejectionReason: reason,
          // Record the decision timestamp on whichever step rejected
          ...(role === 'manager'
            ? { managerDecidedAt: now, managerDecidedBy: actorId }
            : { financeDecidedAt: now, financeDecidedBy: actorId }),
          updatedAt: now,
          history: [...e.history, stampEvent(actorId, 'rejected', { note: reason })],
        } : e)}));
      },

      // team
      assignManager: (employeeId, managerId) => {
        setData(d => ({ ...d, users: d.users.map(u => u.id === employeeId ? { ...u, managerId: managerId || null } : u) }));
      },
    };
  }, [data, session]);

  const value = { data, session, ...api };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

function useStore() { return React.useContext(StoreCtx); }

// ---- Formatting ----
function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
  } catch { return `${CURRENCY_SYMBOL[currency] || ''}${(amount || 0).toFixed(2)} ${currency}`; }
}
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk} week${wk === 1 ? '' : 's'} ago`;
  const mo = Math.floor(day / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}

Object.assign(window, {
  StoreProvider, useStore, CATEGORIES, CURRENCIES, CURRENCY_SYMBOL, STATUSES, STATUS_LABEL,
  formatMoney, formatDate, formatDateTime, timeAgo, today,
  lineTotal, expenseTotal, lineSummary, categoryBreakdown, categoriesColText, diffLines, makeLine,
});
