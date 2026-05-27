import { RoleGuard } from "@/components/role-guard";

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGuard role="manager">{children}</RoleGuard>;
}
