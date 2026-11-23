/**
 * Thin API client for the tenant-facing backend, parallel to lib/api.ts.
 * Namespaced (token key, CSRF cookie, refresh/login paths) so a tenant
 * session and a system-admin session can coexist in the same browser
 * without clobbering each other.
 */

import { readStored, removeStored, writeStored } from "@/lib/storage";
import { getApiUrl } from "@/lib/runtime-config";
import { withConsoleKey } from "@/lib/console-key";


const TENANT_ACCESS_TOKEN_KEY = "tenant.accessToken";

export function getTenantAccessToken(): string | null {
  return readStored(TENANT_ACCESS_TOKEN_KEY);
}

export function setTenantAccessToken(token: string | null) {
  if (token) writeStored(TENANT_ACCESS_TOKEN_KEY, token);
  else removeStored(TENANT_ACCESS_TOKEN_KEY);
}

function getTenantCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)tenant_csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export class TenantApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  csrf?: boolean;
  retryOn401?: boolean;
}

export async function tenantApi<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    csrf = false,
    retryOn401 = true,
  } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-device-type": "website",
  };
  if (auth) {
    const token = getTenantAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (csrf) {
    const csrfToken = getTenantCsrfToken();
    if (csrfToken) headers["x-csrf-token"] = csrfToken;
  }
  // The console's own API key, issued by the setup wizard and read from
  // GET /system/setup/status. Sent from here rather than injected by the
  // gateway, so there is one mechanism in Docker and in `npm run dev` and a
  // reissued key needs no rebuild. It names the calling APPLICATION; the
  // Authorization header above is the identity.
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && retryOn401) {
    const refreshed = await tryTenantRefresh();
    if (refreshed) {
      return tenantApi<T>(path, { ...options, retryOn401: false });
    }
    setTenantAccessToken(null);
    if (typeof window !== "undefined") {
      window.location.href = "/tenant/login";
    }
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (data && Array.isArray(data.errors) && data.errors.length > 0
        ? data.errors
            .map((issue: { path?: (string | number)[]; message: string }) =>
              issue.path && issue.path.length > 0
                ? `${issue.path.join(".")}: ${issue.message}`
                : issue.message,
            )
            .join("; ")
        : undefined) ||
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Request failed (${response.status})`;
    throw new TenantApiError(response.status, message, data);
  }
  return data as T;
}

/**
 * Fetches a binary response (a generated ID card PDF) and hands back a Blob.
 *
 * A plain `<a href>` cannot be used for these: the file lives in private
 * storage behind a permission check, so the request needs the Authorization
 * header, the console API key and the device header like any other. The
 * caller turns the Blob into a download.
 */
export async function tenantDownload(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<Blob> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-device-type": "website",
  };
  const token = getTenantAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    // An error on this route still answers in JSON, so read it that way to
    // surface the real message rather than "failed to download".
    const data = await response.json().catch(() => null);
    const message =
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Download failed (${response.status})`;
    throw new TenantApiError(response.status, message, data);
  }
  return response.blob();
}

/** Saves a Blob to the viewer's machine under the given filename. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: revoking synchronously can cancel the download
  // in some browsers before it has started reading the object.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Uploads the tenant user's own profile picture and returns its stored path. */
export async function uploadTenantAvatar(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = { "x-device-type": "website" };
  const token = getTenantAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}/tenant/account/avatar`, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Upload failed (${response.status})`;
    throw new TenantApiError(response.status, message, data);
  }
  return data as { path: string };
}

/** Uploads the tenant user's own business logo and returns its stored path. */
export async function uploadTenantBusinessLogo(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = { "x-device-type": "website" };
  const token = getTenantAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}/tenant/business/logo`, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Upload failed (${response.status})`;
    throw new TenantApiError(response.status, message, data);
  }
  return data as { path: string };
}

/** Generic file upload for any tenant self-service feature. Returns the stored path. */
export async function uploadTenantFile(file: File): Promise<{ path: string; driver: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = { "x-device-type": "website" };
  const token = getTenantAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}/tenant/uploads`, {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Upload failed (${response.status})`;
    throw new TenantApiError(response.status, message, data);
  }
  return data as { path: string; driver: string };
}

async function tryTenantRefresh(): Promise<boolean> {
  try {
    const csrfToken = getTenantCsrfToken();
    if (!csrfToken) return false;
    const response = await fetch(`${getApiUrl()}/tenant/refresh`, {
      method: "POST",
      headers: await withConsoleKey({
        "Content-Type": "application/json",
        "x-device-type": "website",
        "x-csrf-token": csrfToken,
      }),
      credentials: "include",
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (data?.accessToken) {
      setTenantAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------- Typed API shapes ----------

export interface TenantSessionUser {
  id: string;
  systemCode?: string;
  fName?: string;
  username: string;
  email: string;
  roleId: string;
  roleKey?: string;
  role?: { id: string; roleKey: string; displayName: string };
  permissions?: string[];
}

export interface TenantLoginResponse {
  user: TenantSessionUser;
  permissions: string[];
  accessToken: string;
  csrfToken: string;
  redirectTo: string;
}

export interface TenantDashboardStats {
  businesses: number;
}

export interface TenantAccountProfile {
  id: string;
  systemCode: string;
  fName: string;
  username: string;
  email: string;
  phone: string | null;
  avatarPath: string | null;
  roleId: string;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  createdAt: number;
  updatedAt: number;
  role?: { id: string; roleKey: string; displayName: string };
}

export interface TenantBusinessProfile {
  id: string;
  systemCode: string;
  name: string;
  tagLine: string | null;
  email: string;
  phone: string;
  country: string;
  countryCode: string;
  state: string;
  city: string;
  pincode: string;
  addressLine1: string;
  addressLine2: string | null;
  logoPath: string | null;
  taxNumber: string | null;
  isParentBusiness: boolean;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED" | "DELETED";
  createdAt: number;
  updatedAt: number;
}
