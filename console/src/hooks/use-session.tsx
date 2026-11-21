"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, getAccessToken, setAccessToken, type SessionUser } from "@/lib/api";
import { useSetupStatus } from "@/hooks/use-setup-status";

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
}

const SessionContext = React.createContext<SessionState | null>(null);

/**
 * Fetches /system/me once per mount and shares it via context. Wrap the system
 * dashboard route tree once (in DashboardLayout) so nested components calling
 * useSession() don't each trigger their own /system/me request.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { initialized } = useSetupStatus();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      // A brand-new instance has no accounts at all - send the visitor to the
      // installer rather than to a sign-in form nobody can pass. `initialized`
      // is null while unknown (loading, or the status call failed), and we
      // must not redirect on null or a backend hiccup would eject signed-in
      // users into /setup.
      if (initialized === false) {
        router.replace("/setup");
        return;
      }
      if (!getAccessToken()) {
        router.replace("/system/login");
        return;
      }
      try {
        const me = await api<SessionUser>("/system/me");
        if (!cancelled) {
          setUser(me);
          setLoading(false);
        }
      } catch {
        if (!cancelled) router.replace("/system/login");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router, initialized]);

  const logout = React.useCallback(async () => {
    try {
      await api("/system/logout", { method: "POST", csrf: true, retryOn401: false });
    } catch {
      // best effort; clear local state regardless
    }
    setAccessToken(null);
    router.replace("/system/login");
  }, [router]);

  const hasPermission = React.useCallback(
    (permissionKey: string) => user?.permissions?.includes(permissionKey) ?? false,
    [user],
  );

  const value = React.useMemo(
    () => ({ user, loading, logout, hasPermission }),
    [user, loading, logout, hasPermission],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Client-side auth guard: reads the session loaded by SessionProvider. */
export function useSession(): SessionState {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
