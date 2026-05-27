"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";

export default function OnboardingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(
    api.users.getMyProfile,
    isAuthenticated ? {} : "skip",
  );
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/sign-in");
      return;
    }
    if (profile) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    setSubmitting(true);
    try {
      await completeOnboarding({ displayName: name.trim() });
      toast.success("Profile set up. You’re ready to track expenses.");
      router.replace("/expenses");
    } catch (e) {
      const message =
        e instanceof ConvexError ? String(e.data) : "Something went wrong.";
      setErr(message);
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="One more thing"
      subtitle="What name should we show on your expense reports?"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dn" required>
            Display name
          </Label>
          <Input
            id="dn"
            placeholder="e.g. Jamie Lee"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        {err && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={!name.trim() || submitting}
        >
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
