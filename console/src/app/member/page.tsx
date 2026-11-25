"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, IdCard, LoaderCircle, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemberSession } from "@/hooks/use-member-session";
import { uploadUrl } from "@/lib/api";
import {
  MemberApiError,
  memberApi,
  memberDownload,
  saveMemberBlob,
} from "@/lib/member-api";

/** The member's current card, as `GET /member/id-card` returns it. */
interface CurrentCard {
  id: string;
  issueNumber: number;
  issuedAt: number;
  expiryAt: number | null;
  status: string;
  /** Computed from the date and the clock, never stored. */
  expired: boolean;
}

/**
 * A member's own record.
 *
 * Every value here comes from `GET /member/auth/me`, resolved from the token -
 * there is no member id anywhere in this page, which is what makes it
 * impossible to ask for somebody else's.
 */
export default function MemberPortalPage() {
  const router = useRouter();
  const { member, loading, logout } = useMemberSession();
  const [signingOut, setSigningOut] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  // undefined while unknown, null when none has been issued.
  const [card, setCard] = React.useState<CurrentCard | null | undefined>(undefined);

  React.useEffect(() => {
    if (!member) return;
    memberApi<CurrentCard | null>("/member/id-card")
      .then(setCard)
      // A failure here must not break the page: the member's own details are
      // the point, and the card is an extra.
      .catch(() => setCard(null));
  }, [member]);

  React.useEffect(() => {
    if (!loading && !member) router.replace("/member/login");
  }, [member, loading, router]);

  if (loading || !member) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  /** Label, English value, Tamil value. Tamil is shown only when recorded. */
  const rows: [string, string | null | undefined, string | null | undefined][] = [
    ["Name", member.memberName, member.memberNameTamil],
    ["Business", member.businessName, member.businessNameTamil],
    ["Position", member.associationPosition?.positionName, member.associationPosition?.positionNameTamil],
    ["Trade", member.industry?.industryName, member.industry?.industryNameTamil],
    ["Phone", member.phoneNumber, null],
    ["WhatsApp", member.whatsappNumber, null],
    ["Email", member.email, null],
    ["Date of birth", member.dateOfBirth, null],
    // Rows with no value render nothing, so a member without an Aadhaar
    // simply has no Aadhaar line rather than a masked empty one.
    ["Aadhaar", member.aadhaarLast4 ? `•••• •••• ${member.aadhaarLast4}` : null, null],
    ["Address", [member.addressLine1, member.addressLine2].filter(Boolean).join(", "), null],
    ["Taluk", member.taluk?.talukName, member.taluk?.talukNameTamil],
    ["District", member.district?.districtName, member.district?.districtNameTamil],
    ["State", member.state?.stateName, member.state?.stateNameTamil],
    ["RTO", member.rto ? `${member.rto.rtoCode} — ${member.rto.rtoName}` : null, member.rto?.rtoNameTamil],
  ];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {member.passportPhotoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadUrl(member.passportPhotoPath)}
              alt=""
              className="size-14 rounded-lg border object-cover"
            />
          ) : (
            <div className="flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <IdCard className="size-6" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{member.memberName}</h1>
            {member.memberNameTamil && (
              <p className="truncate text-sm text-muted-foreground">{member.memberNameTamil}</p>
            )}
            <p className="font-mono text-xs text-muted-foreground">{member.memberIdNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>
            {member.status}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              await logout();
            }}
          >
            {signingOut ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            Sign out
          </Button>
        </div>
      </header>

      <section className="rounded-lg border bg-background">
        <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">
          Your details
        </div>
        <dl className="divide-y">
          {rows.map(([label, value, tamil]) =>
            value ? (
              <div key={label} className="grid gap-1 p-4 sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="sm:col-span-2">
                  <span className="text-sm">{value}</span>
                  {tamil && <p className="text-xs text-muted-foreground">{tamil}</p>}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      </section>

      <section className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Membership card</p>
            {card === undefined ? (
              <p className="text-xs text-muted-foreground">Checking…</p>
            ) : card === null ? (
              <p className="text-xs text-muted-foreground">
                None issued yet. Your association issues these — ask them if you
                need one.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Issue {card.issueNumber}
                {card.expiryAt
                  ? card.expired
                    ? ` · expired ${new Date(card.expiryAt * 1000).toLocaleDateString()}`
                    : ` · valid until ${new Date(card.expiryAt * 1000).toLocaleDateString()}`
                  : " · no expiry"}
              </p>
            )}
          </div>
          {card && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  // The card is behind a permission-checked stream, so a plain
                  // <a href> cannot fetch it - the request needs the token.
                  const blob = await memberDownload("/member/id-card/download");
                  saveMemberBlob(blob, `${member.memberIdNumber}.pdf`);
                } catch (error) {
                  toast.error(
                    error instanceof MemberApiError
                      ? error.message
                      : "Could not download your card",
                  );
                } finally {
                  setDownloading(false);
                }
              }}
            >
              {downloading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download
            </Button>
          )}
        </div>
        {card?.expired && (
          <p className="mt-2 text-xs text-destructive">
            This card has expired. Contact your association for a new one.
          </p>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Something wrong? Contact your association — members cannot edit their own
        record here.
      </p>
    </main>
  );
}
