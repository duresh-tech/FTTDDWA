/**
 * Thin API client for the system backend.
 * - Adds the mandatory x-device-type header
 * - Attaches the JWT access token
 * - Sends cookies (refresh token / CSRF) with credentials: "include"
 * - Transparently refreshes the access token once on 401
 */

import { readStored, removeStored, writeStored } from "@/lib/storage";
import { getApiUrl } from "@/lib/runtime-config";
import { withConsoleKey } from "@/lib/console-key";

// Re-exported for import-path continuity: callers that need a URL for a stored
// file should use uploadUrl(path) rather than concatenating an origin.
export { getUploadsOrigin, uploadUrl } from "@/lib/runtime-config";

const ACCESS_TOKEN_KEY = "system.accessToken";

export function getAccessToken(): string | null {
  return readStored(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (token) writeStored(ACCESS_TOKEN_KEY, token);
  else removeStored(ACCESS_TOKEN_KEY);
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
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

export async function api<T = unknown>(
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
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (csrf) {
    const csrfToken = getCsrfToken();
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
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, { ...options, retryOn401: false });
    }
    setAccessToken(null);
    if (typeof window !== "undefined") {
      window.location.href = "/system/login";
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
    throw new ApiError(response.status, message, data);
  }
  return data as T;
}

/** Uploads a file via multipart/form-data and returns its stored path. */
export async function uploadFile(file: File): Promise<{ path: string; driver: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = { "x-device-type": "website" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}/system/uploads`, {
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
    throw new ApiError(response.status, message, data);
  }
  return data as { path: string; driver: string };
}

/** Uploads a file for a FILE-dataType app setting; returns its stored path (caller sets it as the setting's value). */
export async function uploadAppSettingFile(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const headers: Record<string, string> = { "x-device-type": "website" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}/system/app-settings/upload`, {
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
    throw new ApiError(response.status, message, data);
  }
  return data as { path: string };
}

async function tryRefresh(): Promise<boolean> {
  try {
    const csrfToken = getCsrfToken();
    if (!csrfToken) return false;
    const response = await fetch(`${getApiUrl()}/system/refresh`, {
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
      setAccessToken(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------- Typed API shapes ----------

export interface SessionUser {
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

export interface LoginResponse {
  user: SessionUser;
  permissions: string[];
  accessToken: string;
  csrfToken: string;
  redirectTo: string;
}

export interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListResponse<T> {
  items: T[];
  meta: ListMeta;
}

export interface DashboardStats {
  users: number;
  activeUsers: number;
  roles: number;
  permissions: number;
  activeSessions: number;
}

// ---------------------------------------------------------------------------
// First-run setup
//
// These two run before any account exists, so they send no Authorization
// header and must never go through api(): its 401 handler hard-redirects to
// /system/login, which would eject the user from the wizard.
// ---------------------------------------------------------------------------

export interface SetupAdminInput {
  fName: string;
  username: string;
  email: string;
  password: string;
}

export interface SetupInitializeResult {
  user: { id: string; username: string; email: string };
  roleKey: string;
  permissionCount: number;
  tenantRoleCreated: boolean;
}

/** Uploads a branding logo during first-run setup. Returns its stored path. */
export async function setupUploadLogo(file: File): Promise<{ path: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${getApiUrl()}/system/setup/logo`, {
    method: "POST",
    headers: { "x-device-type": "website" },
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Logo upload failed (${response.status})`;
    throw new ApiError(response.status, message, data);
  }
  return data as { path: string };
}

/** Initializes the instance: SYSTEM_SUPER_ADMIN role, first admin, branding. */
export async function setupInitialize(body: {
  admin: SetupAdminInput;
  branding: { appName: string; logoPath?: string | null };
  createTenantRole: boolean;
}): Promise<SetupInitializeResult> {
  return api<SetupInitializeResult>("/system/setup/initialize", {
    method: "POST",
    auth: false,
    retryOn401: false,
    body,
  });
}
