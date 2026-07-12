"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { panelPathForRole } from "@/app/_lib/role-routes";
import type { SessionUser } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";

interface SessionResponse {
  authenticated: boolean;
  user: SessionUser | null;
}

type HomeState = { kind: "loading" } | { kind: "anonymous" };

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<HomeState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiFetch<SessionResponse>("/api/auth/session")
      .then((session) => {
        if (cancelled) return;
        if (session.authenticated && session.user) {
          router.replace(panelPathForRole(session.user.globalRole));
          return;
        }
        setState({ kind: "anonymous" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1c] px-6 text-center">
      <h1 className="bg-gradient-to-r from-[#00e6c3] to-[#0066ff] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
        ENKY
      </h1>
      <p className="mt-3 text-base text-slate-300 sm:text-lg">
        Human Performance Intelligence Platform
      </p>

      {state.kind === "loading" && <p className="mt-8 text-sm text-slate-500">Carregando...</p>}

      {state.kind === "anonymous" && (
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/login" className={uiClasses.button}>
            Entrar
          </Link>
          <Link href="/registrar" className={uiClasses.buttonSecondary}>
            Criar conta de treinador
          </Link>
        </div>
      )}
    </main>
  );
}
