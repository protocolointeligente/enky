"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

interface ActivateResponse {
  userId: string;
  athleteProfileId: string;
}

function ActivateInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch<ActivateResponse>("/api/athletes/invitations/activate", {
        method: "POST",
        body: JSON.stringify({ token, name, password }),
      });
      router.push("/atleta");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <p className={uiClasses.error}>Link de convite inválido — nenhum token encontrado.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={`${uiClasses.card} flex flex-col gap-4`}>
      {error && <p className={uiClasses.error}>{error}</p>}
      <div>
        <label className={uiClasses.label} htmlFor="name">
          Nome completo
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
        <label className={uiClasses.label} htmlFor="password">
          Crie uma senha
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
        {submitting ? "Ativando..." : "Ativar conta"}
      </button>
    </form>
  );
}

export default function ActivateInvitationPage() {
  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <h1 className={uiClasses.heading}>Ativar convite — ENKY</h1>
        <Suspense fallback={<p className="text-slate-400">Carregando...</p>}>
          <ActivateInvitationForm />
        </Suspense>
      </div>
    </main>
  );
}
