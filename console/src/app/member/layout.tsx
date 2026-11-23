import { MemberSessionProvider } from "@/hooks/use-member-session";

/**
 * The member portal's own chrome: none of the staff console's.
 *
 * Members are not staff - no sidebar, no settings rail, no permission-filtered
 * navigation, because there is nothing to navigate. Each page renders itself
 * and the session provider is the only thing in common.
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <MemberSessionProvider>
      <div className="min-h-dvh bg-muted/30">{children}</div>
    </MemberSessionProvider>
  );
}
