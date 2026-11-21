"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { api } from "@/lib/api";

interface SiteResolution {
  kind: "system" | "tenant" | "unknown";
  business?: { id: string; name: string } | null;
}

/**
 * Sends the visitor to the right portal for the hostname they arrived on.
 *
 * A tenant business domain lands on the tenant portal; everything else on the
 * system console. Only the database knows which hostnames are tenant domains,
 * so this asks the API rather than reading the Host header server-side -
 * doing that would mean duplicating the domain list into console/.env, a
 * second source of truth for something the admin UI edits at runtime.
 *
 * The setup gate is not repeated here: both login pages already redirect to
 * /setup when the instance is uninitialized.
 */
export default function Home() {
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    api<SiteResolution>("/public/site/resolve", { auth: false, retryOn401: false })
      .then((site) => {
        if (cancelled) return;
        router.replace(site.kind === "tenant" ? "/tenant/login" : "/system/login");
      })
      .catch(() => {
        // The backend being unreachable should not strand anyone on a blank
        // page: the system console is the safe default, and its own gate
        // reports the outage properly.
        if (!cancelled) router.replace("/system/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background">
      <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
    </main>
  );
}
