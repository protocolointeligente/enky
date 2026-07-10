"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";

type RosterStatus = "PENDING" | "EXPIRED" | "REVOKED" | "ACTIVE" | "ENDED";

interface RosterEntry {
  athleteProfileId: string;
  invitationId: string | null;
  name: string | null;
  email: string | null;
  status: RosterStatus;
  invitedAt: string | null;
  expiresAt: string | null;
  resentCount: number;
  canResend: boolean;
  canRevoke: boolean;
}

const STATUS_LABEL: Record<RosterStatus, string> = {
  PENDING: "Convite pendente",
  EXPIRED: "Convite expirado",
  REVOKED: "Convite revogado",
  ACTIVE: "Conta ativa",
  ENDED: "Vínculo encerrado",
};

const STATUS_CLASS: Record<RosterStatus, string> = {
  PENDING: "bg-amber-900 text-amber-200",
  EXPIRED: "bg-slate-700 text-slate-300",
  REVOKED: "bg-red-900 text-red-200",
  ACTIVE: "bg-emerald-900 text-emerald-200",
  ENDED: "bg-slate-800 text-slate-400",
};

export default function TrainerAthletesPage() {
  const { checked } = useRequireRole("TRAINER");
  const [athletes, setAthletes] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    return apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster")
      .then((result) => setAthletes(result.athletes))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, []);

  useEffect(() => {
    if (!checked) return;
    load().finally(() => setLoading(false));
  }, [checked, load]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setInviting(true);
    try {
      await apiFetch("/api/athletes/invitations", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          athleteName: inviteName.trim() === "" ? undefined : inviteName.trim(),
        }),
      });
      setInviteEmail("");
      setInviteName("");
      setNotice("Convite enviado. O atleta receberá um e-mail com o link de ativação.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setInviting(false);
    }
  }

  async function handleAction(invitationId: string, action: "resend" | "revoke") {
    setError(null);
    setNotice(null);
    setBusyId(invitationId);
    try {
      await apiFetch(`/api/athletes/invitations/${invitationId}/${action}`, { method: "POST" });
      setNotice(action === "resend" ? "Convite reenviado." : "Convite revogado.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setBusyId(null);
    }
  }

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <h1 className={uiClasses.heading}>Atletas</h1>

        {error && <p className={uiClasses.error}>{error}</p>}
        {notice && <p className={uiClasses.success}>{notice}</p>}

        <section className={`${uiClasses.card} flex flex-col gap-4`}>
          <h2 className="font-semibold text-slate-100">Convidar atleta</h2>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className={uiClasses.label} htmlFor="inviteEmail">
                E-mail
              </label>
              <input
                id="inviteEmail"
                type="email"
                required
                className={uiClasses.input}
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className={uiClasses.label} htmlFor="inviteName">
                Nome provisório (opcional)
              </label>
              <input
                id="inviteName"
                className={uiClasses.input}
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
              />
            </div>
            <button type="submit" className={uiClasses.button} disabled={inviting}>
              {inviting ? "Enviando..." : "Convidar"}
            </button>
          </form>
        </section>

        <section className={`${uiClasses.card} flex flex-col gap-3`}>
          <h2 className="font-semibold text-slate-100">Meus atletas ({athletes.length})</h2>
          {athletes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhum atleta ainda. Convide um atleta pelo formulário acima para começar.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {athletes.map((athlete) => (
                <li
                  key={athlete.athleteProfileId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">
                      {athlete.name ??
                        athlete.email ??
                        "Atleta convidado — nome ainda não informado"}
                    </p>
                    {athlete.name && athlete.email && (
                      <p className="truncate text-xs text-slate-400">{athlete.email}</p>
                    )}
                    {athlete.expiresAt &&
                      (athlete.status === "PENDING" || athlete.status === "EXPIRED") && (
                        <p className="text-xs text-slate-500">
                          Expira em {athlete.expiresAt.slice(0, 10)}
                          {athlete.resentCount > 0 ? ` · reenviado ${athlete.resentCount}×` : ""}
                        </p>
                      )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`${uiClasses.badge} ${STATUS_CLASS[athlete.status]}`}>
                      {STATUS_LABEL[athlete.status]}
                    </span>
                    {athlete.invitationId && athlete.canResend && (
                      <button
                        type="button"
                        className="text-xs text-[#00e6c3] hover:underline disabled:opacity-50"
                        disabled={busyId === athlete.invitationId}
                        onClick={() => handleAction(athlete.invitationId as string, "resend")}
                      >
                        Reenviar
                      </button>
                    )}
                    {athlete.invitationId && athlete.canRevoke && (
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        disabled={busyId === athlete.invitationId}
                        onClick={() => handleAction(athlete.invitationId as string, "revoke")}
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
