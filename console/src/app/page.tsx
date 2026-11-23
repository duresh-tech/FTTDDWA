"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IdCard, LoaderCircle, Mail, MapPin, Phone, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api, uploadUrl } from "@/lib/api";
import { memberApi } from "@/lib/member-api";

interface SiteResolution {
  kind: "system" | "tenant" | "unknown";
  business?: { id: string; name: string } | null;
}

interface PublicSite {
  association: Record<string, string>;
  registrationOpen: boolean;
}

/**
 * The front door, decided by the hostname the visitor arrived on.
 *
 * A business domain now renders the association's own HOME PAGE rather than
 * bouncing to a staff login: on a tenant's own domain the public are members
 * and prospective members, not administrators. Staff reach /tenant/login from
 * the quiet link at the bottom, or by typing it, as they already do.
 *
 * Everything else still goes to the system console. Only the database knows
 * which hostnames are business domains, so this asks the API rather than
 * reading the Host header - doing that would duplicate the domain list into
 * console/.env, a second source of truth for something the admin UI edits at
 * run time.
 */
export default function Home() {
  const router = useRouter();
  const [site, setSite] = React.useState<PublicSite | null>(null);
  const [state, setState] = React.useState<"loading" | "tenant">("loading");

  React.useEffect(() => {
    let cancelled = false;

    api<SiteResolution>("/public/site/resolve", { auth: false, retryOn401: false })
      .then(async (resolution) => {
        if (cancelled) return;
        if (resolution.kind !== "tenant") {
          router.replace("/system/login");
          return;
        }
        // The association's own details. If this fails the page still renders
        // with its buttons - a visitor who cannot see the tagline can still
        // sign in.
        const details = await memberApi<PublicSite>("/public/member/site", {
          auth: false,
          retryOn401: false,
        }).catch(() => null);
        if (cancelled) return;
        setSite(details);
        setState("tenant");
      })
      .catch(() => {
        // The backend being unreachable should not strand anyone on a blank
        // page: the system console is the safe default and its own gate
        // reports the outage properly.
        if (!cancelled) router.replace("/system/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const a = site?.association ?? {};
  const name = a["association.name"];
  const nameTamil = a["association.nameTamil"];
  const shortName = a["association.shortName"];
  const tagline = a["association.tagline"];
  const taglineTamil = a["association.taglineTamil"];
  const logo = a["association.logo1Path"];
  const address = [a["association.officeAddress"], a["association.pincode"]]
    .filter(Boolean)
    .join(" — ");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={uploadUrl(logo)} alt="" className="mx-auto size-20 object-contain" />
          ) : (
            <div className="mx-auto flex size-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <IdCard className="size-8" />
            </div>
          )}

          {shortName && <p className="text-sm font-medium tracking-wide">{shortName}</p>}
          <h1 className="text-balance text-2xl font-semibold">{name ?? "Membership Portal"}</h1>
          {nameTamil && <p className="text-balance text-lg text-muted-foreground">{nameTamil}</p>}

          {tagline && <p className="text-sm text-muted-foreground">{tagline}</p>}
          {taglineTamil && <p className="text-sm text-muted-foreground">{taglineTamil}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/member/login">
              <IdCard className="size-4" /> Member login
            </Link>
          </Button>
          {/* Offered only when the association is accepting applications. */}
          {site?.registrationOpen && (
            <Button asChild size="lg" variant="outline">
              <Link href="/member/register">
                <UserPlus className="size-4" /> Apply for membership
              </Link>
            </Button>
          )}
        </div>

        {(a["association.phoneNumber"] || a["association.email"] || address) && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {address && (
              <p className="flex items-center justify-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" /> {address}
              </p>
            )}
            {a["association.phoneNumber"] && (
              <p className="flex items-center justify-center gap-1.5">
                <Phone className="size-3.5 shrink-0" /> {a["association.phoneNumber"]}
              </p>
            )}
            {a["association.email"] && (
              <p className="flex items-center justify-center gap-1.5">
                <Mail className="size-3.5 shrink-0" /> {a["association.email"]}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <Link href="/tenant/login" className="hover:underline">
            Staff login
          </Link>
        </p>
      </div>
    </main>
  );
}
