// Auth screens: SignIn, SignUp, Onboarding

function AuthShell({ children, title, subtitle, footer }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Icon name="Receipt" size={16} /></span>
            <span>Expense Tracker</span>
          </div>
          <div className="text-sm text-muted-foreground">Internal prototype</div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <Card><CardContent className="pt-6">{children}</CardContent></Card>
          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

function SignIn({ go }) {
  const store = useStore();
  const toast = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [err, setErr] = React.useState(null);
  const submit = (e) => {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) return setErr('Email is required.');
    if (!password) return setErr('Password is required.');
    const r = store.signIn(email.trim(), password);
    if (!r.ok) return setErr(r.error);
    toast.success(`Welcome back, ${r.user.name.split(' ')[0]}`);
    go({ name: 'home' });
  };
  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your work email to access the expense tracker."
      footer={<>Don't have an account? <button className="font-medium text-foreground hover:underline" onClick={() => go({ name: 'signup' })}>Create one</button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" required>Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" required>Password</Label>
          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {err && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{err}</div>}
        <Button type="submit" className="w-full">Sign in</Button>

        <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1.5 flex items-center gap-1.5 whitespace-nowrap"><Icon name="Info" size={12} /> Demo accounts</div>
          <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
            <span>Manager</span><code className="font-mono text-[11px]">manager@example.com</code>
            <span>Finance</span><code className="font-mono text-[11px]">finance@example.com</code>
            <span>Employee</span><code className="font-mono text-[11px]">employee@example.com</code>
          </div>
          <div className="mt-1.5">Any password works.</div>
        </div>
      </form>
    </AuthShell>
  );
}

function SignUp({ go }) {
  const store = useStore();
  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [err, setErr] = React.useState(null);
  const submit = (e) => {
    e.preventDefault(); setErr(null);
    if (!email.trim()) return setErr('Email is required.');
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    const r = store.signUp(email.trim(), pw);
    if (!r.ok) return setErr(r.error);
    go({ name: 'onboarding' });
  };
  return (
    <AuthShell
      title="Create your account"
      subtitle="New sign-ups join as employees by default."
      footer={<>Already have an account? <button className="font-medium text-foreground hover:underline" onClick={() => go({ name: 'signin' })}>Sign in</button></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="su_email" required>Email</Label><Input id="su_email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoFocus /></div>
        <div className="space-y-2"><Label htmlFor="su_pw" required>Password</Label><Input id="su_pw" type="password" placeholder="At least 6 characters" value={pw} onChange={e => setPw(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="su_pw2" required>Confirm password</Label><Input id="su_pw2" type="password" placeholder="Repeat password" value={pw2} onChange={e => setPw2(e.target.value)} /></div>
        {err && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{err}</div>}
        <Button type="submit" className="w-full">Create account</Button>
      </form>
    </AuthShell>
  );
}

function Onboarding({ go }) {
  const store = useStore();
  const toast = useToast();
  const [name, setName] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    store.setDisplayName(name.trim());
    toast.success('Profile set up. You\u2019re ready to track expenses.');
    go({ name: 'home' });
  };
  return (
    <AuthShell title="One more thing" subtitle="What name should we show on your expense reports?">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="dn" required>Display name</Label><Input id="dn" placeholder="e.g. Jamie Lee" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
        <Button type="submit" className="w-full" disabled={!name.trim()}>Continue</Button>
      </form>
    </AuthShell>
  );
}

Object.assign(window, { SignIn, SignUp, Onboarding });
