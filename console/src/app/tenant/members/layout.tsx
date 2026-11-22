import { TenantShell } from "@/components/tenant-shell";

export default function TenantMembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TenantShell>{children}</TenantShell>;
}
