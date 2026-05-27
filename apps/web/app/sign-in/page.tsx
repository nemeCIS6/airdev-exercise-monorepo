"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Info } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email.trim()) return setErr("Email is required.");
    if (!password) return setErr("Password is required.");
    setSubmitting(true);
    try {
      await signIn("password", {
        email: email.trim(),
        password,
        flow: "signIn",
      });
      router.replace("/");
    } catch {
      setErr("Invalid email or password.");
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your work email to access the expense tracker."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" required>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {err && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
            <Info size={12} /> Demo accounts
          </div>
          <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
            <span>Manager</span>
            <code className="font-mono text-[11px]">manager@example.com</code>
            <span>Finance</span>
            <code className="font-mono text-[11px]">finance@example.com</code>
            <span>Employee</span>
            <code className="font-mono text-[11px]">employee@example.com</code>
          </div>
          <div className="mt-1.5">
            Passwords:{" "}
            <code className="font-mono text-[11px]">manager123!</code>,{" "}
            <code className="font-mono text-[11px]">finance123!</code>,{" "}
            <code className="font-mono text-[11px]">employee123!</code>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
