// Top-level App: router + top nav.

function TopNav({ route, go }) {
  const store = useStore();
  const user = store.currentUser();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navGuard = useNavGuard();
  const menuRef = React.useRef(null);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const navTo = (target) => navGuard.requestNav(() => go(target));
  const isActive = (name) => route.name === name || (name === 'home' && route.name === 'home') || (name === 'detail' && route.name === 'detail');

  const links = user.role === 'manager'
    ? [
        { name: 'home', label: 'Review', target: { name: 'home' } },
        { name: 'team', label: 'Team', target: { name: 'team' } },
      ]
    : user.role === 'finance'
    ? [
        { name: 'home', label: 'Review', target: { name: 'home' } },
      ]
    : [
        { name: 'home', label: 'My Expenses', target: { name: 'home' } },
      ];

  return (
    <header className="border-b border-border bg-background sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        <button onClick={() => navTo({ name: 'home' })} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Icon name="Receipt" size={16} /></span>
          <span>Expense Tracker</span>
        </button>
        <nav className="flex items-center gap-1">
          {links.map(l => (
            <button
              key={l.name}
              onClick={() => navTo(l.target)}
              className={cn('relative h-9 rounded-md px-3 text-sm font-medium transition-colors',
                (route.name === l.name) ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60')}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2 rounded-md h-9 px-2 hover:bg-accent">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{user.name.split(' ').map(s => s[0]).join('').slice(0, 2)}</span>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-sm font-medium">{user.name}</div>
              <div className="text-[11px] text-muted-foreground capitalize">{user.role}</div>
            </div>
            <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="pop absolute right-6 mt-1 min-w-[200px] rounded-md border border-border bg-popover shadow-md p-1 text-sm">
              <div className="px-2.5 py-2 border-b border-border">
                <div className="font-medium">{user.name}</div>
                <div className="text-muted-foreground text-xs">{user.email}</div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navGuard.requestNav(() => { store.signOut(); }); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent">
                <Icon name="LogOut" size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Router() {
  const store = useStore();
  const [route, setRoute] = React.useState({ name: 'signin' });
  const navGuard = useNavGuard();

  const go = React.useCallback((target) => setRoute(target), []);

  // Auto-route on session changes
  const user = store.currentUser();
  React.useEffect(() => {
    if (!user) { setRoute({ name: 'signin' }); return; }
    if (user.needsOnboarding) { setRoute({ name: 'onboarding' }); return; }
    // If route is auth-only and we have a user, push them home
    if (['signin','signup','onboarding'].includes(route.name)) setRoute({ name: 'home' });
  }, [user]);

  // Employee: handle 'new' as a side-effect that creates a draft, then redirects.
  // MUST be declared before any early returns so hook order is stable across renders.
  React.useEffect(() => {
    if (user && !user.needsOnboarding && route.name === 'new' && user.role === 'employee') {
      const id = store.createDraft(user.id);
      setRoute({ name: 'detail', id });
    }
  }, [route.name, user]);

  if (!user) {
    if (route.name === 'signup') return <SignUp go={go} />;
    return <SignIn go={go} />;
  }
  if (user.needsOnboarding) return <Onboarding go={go} />;

  const main = (() => {
    if (route.name === 'home') {
      if (user.role === 'manager') return <ManagerReview go={go} />;
      if (user.role === 'finance') return <FinanceReview go={go} />;
      return <MyExpenses go={go} />;
    }
    if (route.name === 'team' && user.role === 'manager') return <ManagerTeam />;
    if (route.name === 'detail') return <ExpenseDetail id={route.id} go={go} />;
    if (route.name === 'new') return null;
    return null;
  })();

  return (
    <div className="min-h-screen">
      <TopNav route={route} go={go} />
      {main}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <StoreProvider>
        <NavGuardProvider>
          <Router />
        </NavGuardProvider>
      </StoreProvider>
    </ToastProvider>
  );
}

Object.assign(window, { TopNav, Router, App });
