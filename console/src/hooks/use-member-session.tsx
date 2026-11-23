"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  clearMemberSession,
  getMemberAccessToken,
  getMemberRefreshToken,
  memberApi,
} from "@/lib/member-api";

/** A member's own record, as `GET /member/auth/me` returns it. */
export interface MemberProfile {
  id: string;
  systemCode: string;
  memberIdNumber: string;
  memberName: string;
  memberNameTamil: string | null;
  businessName: string;
  businessNameTamil: string | null;
  phoneNumber: string;
  whatsappNumber: string | null;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  dateOfBirth: string;
  isMarried: boolean;
  weddingDate: string | null;
  passportPhotoPath: string | null;
  status: string;
  createdAt: number;
  /** The last four digits. The number itself never leaves the server. */
  aadhaarLast4: string;
  associationPosition: { positionName: string; positionNameTamil: string | null } | null;
  industry: { industryName: string; industryNameTamil: string | null } | null;
  state: { stateName: string; stateNameTamil: string | null } | null;
  district: { districtName: string; districtNameTamil: string | null } | null;
  taluk: { talukName: string; talukNameTamil: string | null } | null;
  rto: { rtoName: string; rtoNameTamil: string | null; rtoCode: string } | null;
}

interface MemberSession {
  member: MemberProfile | null;
  loading: boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

const Context = React.createContext<MemberSession | null>(null);

/**
 * The member portal's session, parallel to TenantSessionProvider.
 *
 * It carries no permissions, because a member holds no RBAC role. There is
 * nothing to gate a member's own screens on beyond being signed in.
 */
export function MemberSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [member, setMember] = React.useState<MemberProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    // No token at all means "not signed in", which is not an error worth a
    // round trip or a toast.
    if (!getMemberAccessToken() && !getMemberRefreshToken()) {
      setMember(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    memberApi<MemberProfile>("/member/auth/me")
      .then(setMember)
      .catch(() => setMember(null))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load]);

  const logout = React.useCallback(async () => {
    const refreshToken = getMemberRefreshToken();
    // The server revokes the session; the catch is so a network failure still
    // signs the member out of THIS browser, which is what they asked for.
    await memberApi("/member/auth/logout", {
      method: "POST",
      body: { refreshToken },
    }).catch(() => undefined);
    clearMemberSession();
    setMember(null);
    router.replace("/member/login");
  }, [router]);

  const value = React.useMemo(
    () => ({ member, loading, refresh: load, logout }),
    [member, loading, load, logout],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMemberSession(): MemberSession {
  const context = React.useContext(Context);
  if (!context) {
    throw new Error("useMemberSession must be used inside MemberSessionProvider");
  }
  return context;
}
