"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "./api-client";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  globalRole: "SUPERADMIN" | "ADMIN" | "TRAINER" | "ATHLETE";
}

interface SessionResponse {
  authenticated: boolean;
  user: SessionUser | null;
}

// Client-side role gate for the MVP: renders nothing while checking, then
// redirects if unauthenticated or wrong role. Every page's own API calls
// remain the real authorization boundary — this only prevents flashing a
// page the user cannot use.
export function useRequireRole(role: SessionUser["globalRole"]) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch<SessionResponse>("/api/auth/session")
      .then((session) => {
        if (cancelled) return;
        if (!session.authenticated || !session.user || session.user.globalRole !== role) {
          router.replace("/login");
          return;
        }
        setUser(session.user);
        setChecked(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [role, router]);

  return { user, checked };
}
