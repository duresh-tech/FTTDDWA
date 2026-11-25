"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadUrl } from "@/lib/api";
import { MemberApiError, memberApi, memberUpload } from "@/lib/member-api";

interface PublicSite {
  association: Record<string, string>;
  registrationOpen: boolean;
  /**
   * Set when the association files every applicant under one position. The
   * server also narrows `options.positions` to it and overrides the submitted
   * value, so this only decides how the field is PRESENTED.
   */
  fixedPositionId?: string | null;
}

/**
 * Every lookup comes back at once, each child carrying its parent id, so the
 * cascades filter in the browser instead of asking the server on every change.
 */
interface Options {
  positions: { id: string; positionName: string; positionNameTamil: string | null }[];
  industries: { id: string; industryName: string; industryNameTamil: string | null }[];
  states: { id: string; stateName: string; stateNameTamil: string | null }[];
  districts: { id: string; districtName: string; stateId: string }[];
  taluks: { id: string; talukName: string; districtId: string }[];
  rtos: { id: string; rtoName: string; rtoCode: string; tenantDistrictId: string }[];
}

const EMPTY = {
  memberName: "",
  memberNameTamil: "",
  businessName: "",
  businessNameTamil: "",
  associationPositionId: "",
  industryId: "",
  aadhaarNumber: "",
  passportPhotoPath: "",
  phoneNumber: "",
  whatsappNumber: "",
  email: "",
  stateId: "",
  districtId: "",
  talukId: "",
  rtoId: "",
  addressLine1: "",
  addressLine2: "",
  dateOfBirth: "",
  isMarried: false,
  weddingDate: "",
  password: "",
  confirmPassword: "",
};

export default function MemberRegisterPage() {
  const [site, setSite] = React.useState<PublicSite | null>(null);
  const [options, setOptions] = React.useState<Options | null>(null);
  const [form, setForm] = React.useState(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);

  /**
   * Uploads the applicant's photo and keeps only the path it returns.
   *
   * Its own request rather than part of the submission: the image is far
   * larger than the rest of the form, and a failed submit should not mean
   * taking the photo again. The server re-checks the size and reads the type
   * from the file's own bytes, so the accept attribute here is a convenience,
   * not the control.
   */
  async function uploadPhoto(file: File) {
    setPhotoBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await memberUpload<{ path: string }>("/public/member/photo", body);
      set({ passportPhotoPath: result.path });
    } catch (error) {
      toast.error(
        error instanceof MemberApiError ? error.message : "Could not upload the photo",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      memberApi<PublicSite>("/public/member/site", { auth: false, retryOn401: false }),
      memberApi<Options>("/public/member/options", { auth: false, retryOn401: false }),
    ])
      .then(([s, o]) => {
        setSite(s);
        setOptions(o);
        // Nothing to choose, so choose it for them. Without this the applicant
        // has to open a one-item dropdown to satisfy a field they were never
        // given a decision about.
        if (s.fixedPositionId) {
          setForm((f) => ({ ...f, associationPositionId: s.fixedPositionId! }));
        }
      })
      .catch(() => setLoadFailed(true));
  }, []);

  // Changing a parent clears everything under it, so a district from the old
  // state cannot survive into the submission.
  const onStateChange = (stateId: string) =>
    setForm((f) => ({ ...f, stateId, districtId: "", talukId: "", rtoId: "" }));
  const onDistrictChange = (districtId: string) =>
    setForm((f) => ({ ...f, districtId, talukId: "", rtoId: "" }));

  const districts = options?.districts.filter((d) => d.stateId === form.stateId) ?? [];
  const taluks = options?.taluks.filter((t) => t.districtId === form.districtId) ?? [];
  // RTOs hang off the DISTRICT, not the taluk above them on this form.
  const rtos = options?.rtos.filter((r) => r.tenantDistrictId === form.districtId) ?? [];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("The two passwords do not match");
      return;
    }
    setSaving(true);
    try {
      // confirmPassword never leaves the browser: it exists to catch a typo,
      // and the server has no use for a second copy.
      const payload = { ...form, confirmPassword: undefined };
      const result = await memberApi<{ applicationNumber: string }>(
        "/public/member/apply",
        {
          method: "POST",
          auth: false,
          retryOn401: false,
          body: {
            ...payload,
            memberNameTamil: form.memberNameTamil || undefined,
            businessNameTamil: form.businessNameTamil || undefined,
            whatsappNumber: form.whatsappNumber || undefined,
            addressLine2: form.addressLine2 || undefined,
            weddingDate: form.isMarried && form.weddingDate ? form.weddingDate : undefined,
            // Optional now - the server duplicate-checks only when given.
            aadhaarNumber: form.aadhaarNumber || undefined,
            passportPhotoPath: form.passportPhotoPath || undefined,
          },
        },
      );
      setSubmitted(result.applicationNumber);
    } catch (error) {
      toast.error(
        error instanceof MemberApiError ? error.message : "Could not submit your application",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground">
          This address does not accept membership applications.
        </p>
      </Shell>
    );
  }

  if (site && !site.registrationOpen) {
    return (
      <Shell>
        <p className="text-center text-sm text-muted-foreground">
          This association is not accepting applications at the moment.
        </p>
        <p className="text-center text-sm">
          <Link href="/member/login" className="font-medium hover:underline">
            Already a member? Sign in
          </Link>
        </p>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h2 className="text-lg font-semibold">Application received</h2>
          <p className="text-sm text-muted-foreground">
            Your application number is{" "}
            <span className="font-mono font-medium text-foreground">{submitted}</span>.
            Keep it safe.
          </p>
          <p className="text-sm text-muted-foreground">
            The association will review it. You will be able to sign in with the
            password you chose once your membership is approved — your membership
            number will be issued then.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Back to the home page</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (!options) {
    return (
      <Shell>
        <div className="flex justify-center py-8">
          <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Shell wide>
      <form onSubmit={onSubmit} className="space-y-6">
        <Section title="About you">
          <Field label="Full name" required>
            <Input required maxLength={100} value={form.memberName}
              onChange={(e) => set({ memberName: e.target.value })} />
          </Field>
          <Field label="Full name (Tamil)">
            <Input maxLength={100} value={form.memberNameTamil}
              onChange={(e) => set({ memberNameTamil: e.target.value })} />
          </Field>
          <Field label="Date of birth" required>
            <Input type="date" required value={form.dateOfBirth}
              onChange={(e) => set({ dateOfBirth: e.target.value })} />
          </Field>
          <Field label="Aadhaar number">
            <Input inputMode="numeric" placeholder="12 digits (optional)"
              value={form.aadhaarNumber}
              onChange={(e) => set({ aadhaarNumber: e.target.value })} />
          </Field>
          <Field label="Your photo">
            {/* `capture` asks a phone for the camera and is ignored on a
                desktop, which falls back to the file picker - so one input
                serves both without sniffing the device. */}
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              disabled={photoBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadPhoto(file);
              }}
            />
            {photoBusy && (
              <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
            )}
            {form.passportPhotoPath && !photoBusy && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploadUrl(form.passportPhotoPath)}
                  alt=""
                  className="size-14 rounded-md border object-cover"
                />
                <span className="text-xs text-muted-foreground">Photo attached</span>
              </div>
            )}
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={form.isMarried}
                onCheckedChange={(v) => set({ isMarried: v === true, weddingDate: "" })} />
              Married
            </label>
          </div>
          {form.isMarried && (
            <Field label="Wedding date">
              <Input type="date" value={form.weddingDate}
                onChange={(e) => set({ weddingDate: e.target.value })} />
            </Field>
          )}
        </Section>

        <Section title="Your business">
          <Field label="Business name" required>
            <Input required maxLength={100} value={form.businessName}
              onChange={(e) => set({ businessName: e.target.value })} />
          </Field>
          <Field label="Business name (Tamil)">
            <Input maxLength={100} value={form.businessNameTamil}
              onChange={(e) => set({ businessNameTamil: e.target.value })} />
          </Field>
          <Field label="Position" required>
            {site?.fixedPositionId ? (
              // Fixed by the association. Shown read-only rather than hidden:
              // the applicant should see what they are applying AS, and the
              // server sets this field regardless of what is sent.
              <Input
                readOnly
                // No invented fallback: the server narrows the list to this
                // one row, so a miss here means something is wrong and a
                // plausible-looking name would hide it.
                value={
                  options.positions.find((o) => o.id === site.fixedPositionId)
                    ?.positionName ?? ""
                }
              />
            ) : (
              <Combobox
                options={options.positions.map((o) => ({ value: o.id, label: o.positionName }))}
                value={form.associationPositionId}
                onValueChange={(v) => set({ associationPositionId: v })}
                placeholder="Select a position" />
            )}
          </Field>
          <Field label="Trade" required>
            <Combobox
              options={options.industries.map((o) => ({ value: o.id, label: o.industryName }))}
              value={form.industryId}
              onValueChange={(v) => set({ industryId: v })}
              placeholder="Select a trade" />
          </Field>
        </Section>

        <Section title="Contact">
          <Field label="Phone" required>
            <Input required value={form.phoneNumber}
              onChange={(e) => set({ phoneNumber: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsappNumber}
              onChange={(e) => set({ whatsappNumber: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <Input type="email" required value={form.email}
              onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </Section>

        <Section title="Address">
          <Field label="Address line 1" required>
            <Input required maxLength={255} value={form.addressLine1}
              onChange={(e) => set({ addressLine1: e.target.value })} />
          </Field>
          <Field label="Address line 2">
            <Input maxLength={255} value={form.addressLine2}
              onChange={(e) => set({ addressLine2: e.target.value })} />
          </Field>
          <Field label="State" required>
            <Combobox
              options={options.states.map((o) => ({ value: o.id, label: o.stateName }))}
              value={form.stateId} onValueChange={onStateChange}
              placeholder="Select a state" />
          </Field>
          <Field label="District" required>
            <Combobox
              options={districts.map((o) => ({ value: o.id, label: o.districtName }))}
              value={form.districtId} onValueChange={onDistrictChange}
              placeholder={form.stateId ? "Select a district" : "Select a state first"} />
          </Field>
          <Field label="Taluk" required>
            <Combobox
              options={taluks.map((o) => ({ value: o.id, label: o.talukName }))}
              value={form.talukId} onValueChange={(v) => set({ talukId: v })}
              placeholder={form.districtId ? "Select a taluk" : "Select a district first"} />
          </Field>
          <Field label="RTO" required>
            <Combobox
              options={rtos.map((o) => ({ value: o.id, label: `${o.rtoCode} — ${o.rtoName}` }))}
              value={form.rtoId} onValueChange={(v) => set({ rtoId: v })}
              placeholder={form.districtId ? "Select an RTO" : "Select a district first"} />
          </Field>
        </Section>

        <Section title="Your password">
          <Field label="Password" required>
            <Input type="password" required minLength={8} autoComplete="new-password"
              value={form.password} onChange={(e) => set({ password: e.target.value })} />
          </Field>
          <Field label="Confirm password" required>
            <Input type="password" required minLength={8} autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => set({ confirmPassword: e.target.value })} />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            You will sign in with your membership number and this password, once
            the association approves your application.
          </p>
        </Section>

        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Cancel
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Submit application
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-dvh justify-center p-4 py-8">
      <div className={wide ? "w-full max-w-2xl space-y-6" : "w-full max-w-sm space-y-6"}>
        <h1 className="text-center text-xl font-semibold">Membership application</h1>
        {children}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">{title}</div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label required={required}>{label}</Label>
      {children}
    </div>
  );
}
