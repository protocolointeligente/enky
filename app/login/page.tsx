"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

interface LoginResponse {
  userId: string;
}

interface SessionResponse {
  authenticated: boolean;
  user: { globalRole: "SUPERADMIN" | "ADMIN" | "TRAINER" | "ATHLETE" } | null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const session = await apiFetch<SessionResponse>("/api/auth/session");
      const role = session.user?.globalRole;
      router.push(role === "ATHLETE" ? "/atleta" : "/treinador");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <h1 className={uiClasses.heading}>Entrar — ENKY</h1>
        <form onSubmit={handleSubmit} className={`${uiClasses.card} flex flex-col gap-4`}>
          {error && <p className={uiClasses.error}>{error}</p>}
          <div>
            <label className={uiClasses.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              className={uiClasses.input}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              className={uiClasses.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className={uiClasses.button} disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="text-sm text-slate-400">
          Ainda não tem conta de treinador?{" "}
          <Link href="/registrar" className={uiClasses.link}>
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
