"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IdCard, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemberSession, type MemberProfile } from "@/hooks/use-member-session";
import {
  MemberApiError,
  memberApi,
  setMemberAccessToken,
  setMemberRefreshToken,
} from "@/lib/member-api";

interface PublicSite {
  association: Record<string, string>;
  registrationOpen: boolean;
}

interface LoginResponse {
  member: MemberProfile;
  accessToken: string;
  refreshToken: string;
}

export default function MemberLoginPage() {
  const router = useRouter();
  const { member, loading: sessionLoading, refresh } = useMemberSession();

  const [site, setSite] = React.useState<PublicSite | null>(null);
  const [form, setForm] = React.useState({ memberIdNumber: "", password: "" });
  const [saving, setSaving] = React.useState(false);

  // Already signed in? The portal is where they meant to be.
  React.useEffect(() => {
    if (!sessionLoading && member) router.replace("/member");
  }, [member, sessionLoading, router]);

  React.useEffect(() => {
    memberApi<PublicSite>("/public/member/site", { auth: false, retryOn401: false })
      .then(setSite)
      // A 404 means this hostname serves no association. The form still works
      // for nobody, so the page says so rather than pretending.
      .catch(() => setSite(null));
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await memberApi<LoginResponse>("/member/auth/login", {
        method: "POST",
        auth: false,
        retryOn401: false,
        body: form,
      });
      setMemberAccessToken(data.accessToken);
      setMemberRefreshToken(data.refreshToken);
      refresh();
      router.replace("/member");
    } catch (error) {
      toast.error(
        error instanceof MemberApiError ? error.message : "Could not sign you in",
      );
    } finally {
      setSaving(false);
    }
  }

  const name = site?.association["association.name"];
  const nameTamil = site?.association["association.nameTamil"];
  const shortName = site?.association["association.shortName"];

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <IdCard className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">{shortName ?? name ?? "Member Login"}</h1>
          {nameTamil && <p className="text-sm text-muted-foreground">{nameTamil}</p>}
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-background p-6">
          <div className="space-y-1">
            <Label required htmlFor="memberIdNumber">
              Membership Number
            </Label>
            <Input
              id="memberIdNumber"
              required
              autoComplete="username"
              placeholder="TN72001"
              value={form.memberIdNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, memberIdNumber: e.target.value.trim() }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label required htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <LoaderCircle className="size-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        {site?.registrationOpen && (
          <p className="text-center text-sm text-muted-foreground">
            Not a member yet?{" "}
            <Link href="/member/register" className="font-medium text-foreground hover:underline">
              Apply for membership
            </Link>
          </p>
        )}

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            Back to the home page
          </Link>
        </p>
      </div>
    </main>
  );
}
