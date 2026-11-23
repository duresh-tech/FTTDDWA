/**
 * API client for the MEMBER portal, parallel to lib/api.ts and
 * lib/tenant-api.ts.
 *
 * Namespaced the same way those are - its own token key and refresh path - so
 * a member session, a tenant-staff session and a system-admin session can
 * coexist in one browser without clobbering each other. Somebody who runs the
 * association and is also a member of it is a completely ordinary case.
 */

import { readStored, removeStored, writeStored } from "@/lib/storage";
import { getApiUrl } from "@/lib/runtime-config";
import { withConsoleKey } from "@/lib/console-key";

const MEMBER_ACCESS_TOKEN_KEY = "member.accessToken";
const MEMBER_REFRESH_TOKEN_KEY = "member.refreshToken";

export function getMemberAccessToken(): string | null {
  return readStored(MEMBER_ACCESS_TOKEN_KEY);
}

export function setMemberAccessToken(token: string | null) {
  if (token) writeStored(MEMBER_ACCESS_TOKEN_KEY, token);
  else removeStored(MEMBER_ACCESS_TOKEN_KEY);
}

export function getMemberRefreshToken(): string | null {
  return readStored(MEMBER_REFRESH_TOKEN_KEY);
}

export function setMemberRefreshToken(token: string | null) {
  if (token) writeStored(MEMBER_REFRESH_TOKEN_KEY, token);
  else removeStored(MEMBER_REFRESH_TOKEN_KEY);
}

export class MemberApiError extends Error {
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
  /** Public endpoints (the home page, the lookups, the form) send no token. */
  auth?: boolean;
  retryOn401?: boolean;
}

export async function memberApi<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, retryOn401 = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-device-type": "website",
  };
  if (auth) {
    const token = getMemberAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  // The console's own API key. `public/member/*` is @SkipApiKey and does not
  // need it, but sending it there is harmless and keeps one code path.
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && auth && retryOn401) {
    const refreshed = await tryMemberRefresh();
    if (refreshed) return memberApi<T>(path, { ...options, retryOn401: false });
    clearMemberSession();
    if (typeof window !== "undefined") window.location.href = "/member/login";
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
    throw new MemberApiError(response.status, message, data);
  }
  return data as T;
}

/**
 * Swaps the refresh token for a new pair.
 *
 * The server ROTATES it - the presented token is revoked as the new one is
 * issued - so the stored refresh token must be replaced here too, or the next
 * attempt presents a revoked one.
 */
export async function tryMemberRefresh(): Promise<boolean> {
  const refreshToken = getMemberRefreshToken();
  if (!refreshToken) return false;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-device-type": "website",
    };
    await withConsoleKey(headers);
    const response = await fetch(`${getApiUrl()}/member/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken) return false;
    setMemberAccessToken(data.accessToken);
    if (data.refreshToken) setMemberRefreshToken(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetches a binary response (the member's card PDF) as a Blob.
 *
 * A plain `<a href>` cannot reach it: the file is in private storage behind a
 * guard, so the request needs the Authorization header and the API key like
 * any other.
 */
export async function memberDownload(path: string): Promise<Blob> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-device-type": "website",
  };
  const token = getMemberAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  await withConsoleKey(headers);

  const response = await fetch(`${getApiUrl()}${path}`, {
    method: "GET",
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    // An error on this route still answers in JSON, so read it that way to
    // surface the real message rather than "download failed".
    const data = await response.json().catch(() => null);
    const message =
      (data && (Array.isArray(data.message) ? data.message[0] : data.message)) ||
      `Download failed (${response.status})`;
    throw new MemberApiError(response.status, message, data);
  }
  return response.blob();
}

/** Saves a Blob to the viewer's machine under the given filename. */
export function saveMemberBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick: doing it synchronously can cancel the download
  // before the browser has read the object.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function clearMemberSession() {
  setMemberAccessToken(null);
  setMemberRefreshToken(null);
}
