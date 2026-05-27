"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ChevronDown, LogOut, Receipt } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

export function TopNav() {
  const profile = useQuery(api.users.getMyProfile);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  // Hidden while loading or unauthenticated — auth/onboarding pages render without it.
  if (!profile) return null;

  const homeHref =
    profile.role === "manager"
      ? "/review"
      : profile.role === "finance"
        ? "/finance/review"
        : "/expenses";

  const links =
    profile.role === "manager"
      ? [
          { label: "Review", href: "/review" },
          { label: "Team", href: "/team" },
        ]
      : profile.role === "finance"
        ? [
            { label: "Overview", href: "/finance/overview" },
            { label: "Review", href: "/finance/review" },
          ]
        : [{ label: "My Expenses", href: "/expenses" }];

  const initials =
    profile.displayName
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <header className="border-b border-border bg-background sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-6">
        <Link
          href={homeHref}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Receipt size={16} />
          </span>
          <span>Expense Tracker</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative h-9 inline-flex items-center rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md h-9 px-2 hover:bg-accent"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {initials}
            </span>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-sm font-medium">{profile.displayName}</div>
              <div className="text-[11px] text-muted-foreground capitalize">
                {profile.role}
              </div>
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 min-w-[200px] rounded-md border border-border bg-popover shadow-md p-1 text-sm">
              <div className="px-2.5 py-2 border-b border-border">
                <div className="font-medium">{profile.displayName}</div>
                {profile.email && (
                  <div className="text-muted-foreground text-xs">
                    {profile.email}
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  await signOut();
                  router.push("/sign-in");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
