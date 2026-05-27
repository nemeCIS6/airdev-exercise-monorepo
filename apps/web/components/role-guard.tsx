"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Role = "employee" | "manager" | "finance";

const HOME_FOR_ROLE: Record<Role, string> = {
  employee: "/expenses",
  manager: "/review",
  finance: "/finance/review",
};

export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
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
    if (profile.role !== role) {
      router.replace(HOME_FOR_ROLE[profile.role]);
    }
  }, [authLoading, isAuthenticated, profile, role, router]);

  if (authLoading || !isAuthenticated || !profile || profile.role !== role) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="skel h-4 w-32" />
      </div>
    );
  }

  return <>{children}</>;
}
