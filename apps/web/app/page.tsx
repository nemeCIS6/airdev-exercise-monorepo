"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(
    api.users.getMyProfile,
    isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/sign-in");
      return;
    }
    if (profile === undefined) return;
    if (profile === null) {
      router.replace("/onboarding");
      return;
    }
    const home =
      profile.role === "manager"
        ? "/review"
        : profile.role === "finance"
          ? "/finance/review"
          : "/expenses";
    router.replace(home);
  }, [authLoading, isAuthenticated, profile, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="skel h-4 w-32" />
    </div>
  );
}
