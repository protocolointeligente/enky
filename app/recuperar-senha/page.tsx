"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <h1 className={uiClasses.heading}>Esqueci minha senha</h1>
        {sent ? (
          <div className={`${uiClasses.card} flex flex-col gap-3`}>
            <p className={uiClasses.success}>
              Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.
              Verifique sua caixa de entrada.
            </p>
            <Link href="/login" className={uiClasses.link}>
              ← Voltar para entrar
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`${uiClasses.card} flex flex-col gap-4`}>
            {error && <p className={uiClasses.error}>{error}</p>}
            <p className="text-sm text-muted">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
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
            <button type="submit" className={uiClasses.button} disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar link"}
            </button>
            <Link href="/login" className={uiClasses.link}>
              ← Voltar para entrar
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
