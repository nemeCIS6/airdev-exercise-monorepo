import { RoleGuard } from "@/components/role-guard";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard role="employee">{children}</RoleGuard>;
}
