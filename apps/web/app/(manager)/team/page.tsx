"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "They";
  return trimmed.split(/\s+/)[0];
}

export default function ManagerTeamPage() {
  const employees = useQuery(api.users.listAllEmployees, {});
  const managers = useQuery(api.users.listAllManagers, {});
  const reassign = useMutation(api.users.reassignEmployeeManager);

  const [pending, setPending] = useState<Record<string, boolean>>({});

  const mgrOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: "", label: "Unassigned" }];
    if (!managers) return base;
    return base.concat(
      managers.map((m) => ({ value: m.userId, label: m.displayName })),
    );
  }, [managers]);

  const onChangeManager = async (
    employeeUserId: Id<"users">,
    employeeName: string,
    nextManagerUserId: string,
  ) => {
    const key = String(employeeUserId);
    setPending((p) => ({ ...p, [key]: true }));
    try {
      await reassign({
        employeeUserId,
        newManagerId:
          nextManagerUserId === ""
            ? null
            : (nextManagerUserId as Id<"users">),
      });
      const mgr = nextManagerUserId
        ? managers?.find((m) => m.userId === nextManagerUserId)
        : null;
      toast.success(
        `${firstName(employeeName)}’s manager updated to ${
          mgr ? firstName(mgr.displayName) : "Unassigned"
        }.`,
      );
    } catch (err) {
      const msg =
        err instanceof ConvexError
          ? String(err.data)
          : "Could not update manager.";
      toast.error(msg);
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  };

  const loading = employees === undefined || managers === undefined;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone you can assign managers for.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="skel h-10 w-full" />
          <div className="skel h-10 w-full" />
          <div className="skel h-10 w-full" />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          body="When employees sign up, they'll appear here."
        />
      ) : (
        <>
          {/* Mobile: card list (visible <md). Avatar + name on top,
              email under it, full-width manager select below. */}
          <div className="md:hidden rounded-md border border-border overflow-hidden divide-y divide-border">
            {employees.map((emp) => {
              const key = String(emp.userId);
              return (
                <div key={emp._id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                      {initials(emp.displayName)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {emp.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {emp.email ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                      Manager
                    </div>
                    <Select
                      value={emp.managerId ?? ""}
                      options={mgrOptions}
                      disabled={pending[key]}
                      onChange={(v) =>
                        onChangeManager(emp.userId, emp.displayName, v)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: original table. */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[280px]">Manager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const key = String(emp.userId);
                  return (
                    <TableRow key={emp._id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                            {initials(emp.displayName)}
                          </span>
                          <span className="font-medium">{emp.displayName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {emp.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={emp.managerId ?? ""}
                          options={mgrOptions}
                          disabled={pending[key]}
                          onChange={(v) =>
                            onChangeManager(emp.userId, emp.displayName, v)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
