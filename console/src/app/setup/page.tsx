"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimation } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleCheck,
  CircleX,
  ImageUp,
  LoaderCircle,
  Rocket,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Stepper } from "@/components/setup/stepper";
import { fadeUp, shake } from "@/components/motion/variants";
import { ThemeToggle } from "@/components/theme-toggle";
import { setupInitialize, setupUploadLogo } from "@/lib/api";
import { uploadUrl } from "@/lib/runtime-config";
import { invalidateSetupStatus, useSetupStatus } from "@/hooks/use-setup-status";

const STEPS = ["Welcome", "Administrator", "Branding", "Options", "Review"];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

interface WizardForm {
  fName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  appName: string;
  logoPath: string | null;
  createTenantRole: boolean;
}

const EMPTY_FORM: WizardForm = {
  fName: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  appName: "FTTDDWA",
  logoPath: null,
  createTenantRole: true,
};

/**
 * First-run setup wizard.
 *
 * Deliberately sits outside both the /system and /tenant trees, so neither
 * session provider wraps it and nothing tries to authenticate a user that
 * does not exist yet.
 *
 * Every step is collected client-side and submitted as ONE request at the
 * end, so a failure can never leave a half-initialized instance.
 */
export default function SetupPage() {
  const router = useRouter();
  const { initialized, status } = useSetupStatus();
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<WizardForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const cardControls = useAnimation();

  React.useEffect(() => {
    cardControls.start("visible");
  }, [cardControls]);

  // Reverse guard: nothing to set up on an initialized instance.
  React.useEffect(() => {
    if (initialized === true && !done) router.replace("/system/login");
  }, [initialized, done, router]);

  // Adopt the current app name as the default once status arrives.
  React.useEffect(() => {
    if (status?.appName) {
      setForm((previous) =>
        previous.appName === EMPTY_FORM.appName
          ? { ...previous, appName: status.appName }
          : previous,
      );
    }
  }, [status?.appName]);

  function update<K extends keyof WizardForm>(key: K, value: WizardForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  /** Mirrors the backend Zod rules so problems surface before submitting. */
  function validateAdminStep(): string | null {
    if (!form.fName.trim()) return "Full name is required";
    if (form.username.trim().length < 3) return "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9._-]+$/.test(form.username))
      return "Username may only contain letters, numbers, dot, underscore and hyphen";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return "Enter a valid email address";
    if (form.password.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(form.password)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(form.password)) return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(form.password)) return "Password must contain a digit";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    return null;
  }

  function next() {
    if (step === 1) {
      const problem = validateAdminStep();
      if (problem) {
        toast.error(problem);
        cardControls.start(shake);
        return;
      }
    }
    if (step === 2 && !form.appName.trim()) {
      toast.error("Application name is required");
      cardControls.start(shake);
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function onLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo exceeds the 5 MB limit");
      return;
    }
    setUploadingLogo(true);
    try {
      const { path } = await setupUploadLogo(file);
      update("logoPath", path);
      toast.success("Logo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onFinish() {
    setSaving(true);
    try {
      const result = await setupInitialize({
        admin: {
          fName: form.fName.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
        },
        branding: { appName: form.appName.trim(), logoPath: form.logoPath },
        createTenantRole: form.createTenantRole,
      });
      invalidateSetupStatus();
      setDone(true);
      toast.success(
        `Setup complete - ${result.roleKey} created with ${result.permissionCount} permissions`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
      cardControls.start(shake);
    } finally {
      setSaving(false);
    }
  }

  // Avoid flashing the wizard at someone who is about to be redirected away.
  if (initialized === true && !done) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-start justify-center p-4 sm:items-center">
        <motion.div
          className="w-full max-w-lg"
          initial="hidden"
          animate={cardControls}
          variants={fadeUp}
        >
          <Card className="w-full">
            {done ? (
              <SuccessPanel
                appName={form.appName.trim()}
                tenantRoleCreated={form.createTenantRole}
                onContinue={() => router.replace("/system/login")}
              />
            ) : (
              <>
                <CardHeader>
                  <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Rocket className="size-6" />
                  </div>
                  <CardTitle className="text-center text-xl">{STEPS[step]}</CardTitle>
                  <CardDescription className="text-center">
                    Step {step + 1} of {STEPS.length}
                  </CardDescription>
                  <Stepper steps={STEPS} current={step} className="mt-4" />
                </CardHeader>

                <CardContent className="space-y-4">
                  {step === 0 && <WelcomeStep reachable={initialized !== null} />}

                  {step === 1 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        This account gets the{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                          SYSTEM_SUPER_ADMIN
                        </code>{" "}
                        role, which holds every permission in the system.
                      </p>
                      <Field
                        id="fName"
                        label="Full name"
                        value={form.fName}
                        onChange={(value) => update("fName", value)}
                        placeholder="Jane Doe"
                        autoComplete="name"
                      />
                      <Field
                        id="username"
                        label="Username"
                        value={form.username}
                        onChange={(value) => update("username", value)}
                        placeholder="jane.doe"
                        autoComplete="username"
                        hint="Letters, numbers, dot, underscore and hyphen. Stored lowercase."
                      />
                      <Field
                        id="email"
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(value) => update("email", value)}
                        placeholder="jane@example.com"
                        autoComplete="email"
                      />
                      <Field
                        id="password"
                        label="Password"
                        type="password"
                        value={form.password}
                        onChange={(value) => update("password", value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        hint="At least 8 characters, with an uppercase letter, a lowercase letter and a digit."
                      />
                      <Field
                        id="confirmPassword"
                        label="Confirm password"
                        type="password"
                        value={form.confirmPassword}
                        onChange={(value) => update("confirmPassword", value)}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-4">
                      <Field
                        id="appName"
                        label="Application name"
                        value={form.appName}
                        onChange={(value) => update("appName", value)}
                        placeholder="FTTDDWA"
                        hint="Shown in the browser tab, the sidebar and on the sign-in cards."
                      />

                      <div className="space-y-2">
                        <Label htmlFor="logo">Logo (optional)</Label>
                        <div className="flex items-center gap-3">
                          {form.logoPath ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={uploadUrl(form.logoPath)}
                              alt="Logo preview"
                              className="size-12 rounded-lg border object-contain"
                            />
                          ) : (
                            <span className="flex size-12 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                              <ImageUp className="size-5" />
                            </span>
                          )}
                          <Input
                            id="logo"
                            type="file"
                            accept="image/*"
                            onChange={onLogoChange}
                            disabled={uploadingLogo}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {uploadingLogo
                            ? "Uploading..."
                            : "PNG, JPEG, SVG or WebP, up to 5 MB. You can also set this later in App Settings."}
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Checkbox
                          id="createTenantRole"
                          checked={form.createTenantRole}
                          onCheckedChange={(checked) =>
                            update("createTenantRole", checked === true)
                          }
                          className="mt-0.5"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="createTenantRole" className="font-medium">
                            Also create a tenant role
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Adds a{" "}
                            <code className="rounded bg-muted px-1 py-0.5 text-xs">
                              TENANT_ADMIN
                            </code>{" "}
                            role scoped to the tenant portal. Tenant users can only be
                            assigned tenant-visible roles, so without this the tenant
                            portal stays unusable until you create one yourself under
                            Roles.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <dl className="space-y-3 text-sm">
                      <Summary label="Administrator" value={form.fName.trim()} />
                      <Summary label="Username" value={form.username.trim().toLowerCase()} />
                      <Summary label="Email" value={form.email.trim().toLowerCase()} />
                      <Summary label="Role" value="SYSTEM_SUPER_ADMIN (all permissions)" />
                      <Separator />
                      <Summary label="Application name" value={form.appName.trim()} />
                      <Summary label="Logo" value={form.logoPath ? "Uploaded" : "None"} />
                      <Summary
                        label="Tenant role"
                        value={form.createTenantRole ? "TENANT_ADMIN created" : "Not created"}
                      />
                    </dl>
                  )}
                </CardContent>

                <CardFooter className="justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={back}
                    disabled={step === 0 || saving}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>

                  {step < STEPS.length - 1 ? (
                    <Button type="button" onClick={next} disabled={uploadingLogo}>
                      Continue
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button type="button" onClick={onFinish} disabled={saving}>
                      {saving && <LoaderCircle className="size-4 animate-spin" />}
                      Finish setup
                    </Button>
                  )}
                </CardFooter>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </main>
  );
}

function WelcomeStep({ reachable }: { reachable: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This instance has no accounts yet. The next few steps create the first
        administrator, set the application name, and prepare the permission set.
      </p>
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        {reachable ? (
          <>
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
            <span>API and database reachable</span>
          </>
        ) : (
          <>
            <CircleX className="size-4 shrink-0 text-destructive" />
            <span>Waiting for the API — check that the backend container is healthy</span>
          </>
        )}
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <UserCog className="size-4 shrink-0" /> One administrator account
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="size-4 shrink-0" /> SYSTEM_SUPER_ADMIN role, all permissions
        </li>
        <li className="flex items-center gap-2">
          <Building2 className="size-4 shrink-0" /> Application name and logo
        </li>
      </ul>
    </div>
  );
}

function SuccessPanel({
  appName,
  tenantRoleCreated,
  onContinue,
}: {
  appName: string;
  tenantRoleCreated: boolean;
  onContinue: () => void;
}) {
  return (
    <>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CircleCheck className="size-6" />
        </div>
        <CardTitle className="text-xl">{appName} is ready</CardTitle>
        <CardDescription>
          Setup is complete and this installer is now permanently closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Sign in with the administrator account you just created.</p>
        {!tenantRoleCreated && (
          <p className="rounded-lg border p-3">
            You skipped the tenant role. To use the tenant portal, create a role with
            &quot;visible to tenants&quot; enabled under Roles first — tenant users
            cannot be created without one.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button type="button" className="w-full" onClick={onContinue}>
          Go to sign in
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
