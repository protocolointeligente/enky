"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className={`${uiClasses.card} flex flex-col gap-3`}>
        <p className={uiClasses.error}>Link inválido. Solicite um novo em “Esqueci minha senha”.</p>
        <Link href="/recuperar-senha" className={uiClasses.link}>
          Recuperar senha
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${uiClasses.card} flex flex-col gap-3`}>
        <p className={uiClasses.success}>Senha redefinida com sucesso.</p>
        <Link href="/login" className={uiClasses.button}>
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${uiClasses.card} flex flex-col gap-4`}>
      {error && <p className={uiClasses.error}>{error}</p>}
      <div>
        <label className={uiClasses.label} htmlFor="password">
          Nova senha
        </label>
        <input
          id="password"
          type="password"
          required
          className={uiClasses.input}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="mt-1 text-xs text-faint">Mín. 10 caracteres, com letras e números.</p>
      </div>
      <div>
        <label className={uiClasses.label} htmlFor="confirm">
          Confirmar nova senha
        </label>
        <input
          id="confirm"
          type="password"
          required
          className={uiClasses.input}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>
      <button type="submit" className={uiClasses.button} disabled={submitting}>
        {submitting ? "Redefinindo..." : "Redefinir senha"}
      </button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <h1 className={uiClasses.heading}>Redefinir senha</h1>
        <Suspense fallback={<p className="text-muted">Carregando...</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
