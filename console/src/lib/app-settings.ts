/**
 * Public, unauthenticated fetch for app-wide branding (name/logo). Used by
 * both the system dashboard and tenant settings UI, so it intentionally
 * avoids the authenticated api()/tenantApi() clients.
 */

import { getApiUrl } from "@/lib/runtime-config";
import { withConsoleKey } from "@/lib/console-key";

export interface AppSettings {
  appName: string;
  logoPath: string | null;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const response = await fetch(`${getApiUrl()}/system/app-settings/public/branding`, {
    // Unauthenticated, but still a keyed route: @Public() turns off the JWT
    // guard, not the API key guard.
    headers: await withConsoleKey({ "x-device-type": "website" }),
  });
  if (!response.ok) throw new Error("Failed to load app settings");
  const data = await response.json();
  return { appName: data.appName, logoPath: data.logoPath ?? null };
}
