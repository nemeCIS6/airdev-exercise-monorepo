import { Badge } from "@/components/ui/badge";
import type { Status } from "@/lib/format";

interface StatusBadgeProps {
  status: Status;
  rejectedByRole?: "manager" | "finance" | null;
}

export function StatusBadge({ status, rejectedByRole }: StatusBadgeProps) {
  if (status === "draft") return <Badge variant="secondary">Draft</Badge>;

  if (status === "pending_manager") {
    return (
      <span
        title="Awaiting manager review"
        className="inline-flex items-center whitespace-nowrap rounded-md border border-yellow-500 px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-50/60"
      >
        <span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-500/15 text-[9px] font-bold text-yellow-700">
          1
        </span>
        Pending Manager
      </span>
    );
  }

  if (status === "pending_finance") {
    return (
      <span
        title="Awaiting finance review"
        className="inline-flex items-center whitespace-nowrap rounded-md border border-blue-400 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50"
      >
        <span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500/15 text-[9px] font-bold text-blue-700">
          2
        </span>
        Pending Finance
      </span>
    );
  }

  if (status === "approved") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Approved
      </span>
    );
  }

  if (status === "rejected") {
    const who =
      rejectedByRole === "finance"
        ? "Finance"
        : rejectedByRole === "manager"
          ? "Manager"
          : null;
    return (
      <span
        title={who ? `Rejected by ${who}` : "Rejected"}
        className="inline-flex items-center whitespace-nowrap rounded-md border border-transparent bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground cursor-help"
      >
        {who ? `Rejected · ${who}` : "Rejected"}
      </span>
    );
  }

  return <Badge variant="outline">{status}</Badge>;
}
