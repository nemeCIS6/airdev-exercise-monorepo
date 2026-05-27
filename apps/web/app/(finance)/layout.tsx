import { RoleGuard } from "@/components/role-guard";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard role="finance">{children}</RoleGuard>;
}
