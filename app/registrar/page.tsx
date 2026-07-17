"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

interface RegisterResponse {
  userId: string;
  organizationId: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch<RegisterResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      router.push("/treinador");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <h1 className={uiClasses.heading}>Cadastro de treinador — ENKY</h1>
        <form onSubmit={handleSubmit} className={`${uiClasses.card} flex flex-col gap-4`}>
          {error && <p className={uiClasses.error}>{error}</p>}
          <div>
            <label className={uiClasses.label} htmlFor="name">
              Nome
            </label>
            <input
              id="name"
              required
              minLength={2}
              className={uiClasses.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
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
              minLength={8}
              className={uiClasses.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className={uiClasses.button} disabled={submitting}>
            {submitting ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
        <p className="text-sm text-muted">
          Já tem conta?{" "}
          <Link href="/login" className={uiClasses.link}>
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
