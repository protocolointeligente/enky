"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import { ChevronRightIcon } from "@/components/ui/icons";

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
  PENDING: "bg-orange/15 text-orange-hi",
  EXPIRED: "bg-surface text-faint",
  REVOKED: "bg-danger/15 text-danger",
  ACTIVE: "bg-turq/15 text-turq",
  ENDED: "bg-surface text-faint",
};

// Iniciais para o avatar do atleta (mesmo padrão do calendário).
function initials(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

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

  // Carteira de 200 atletas: busca no cliente + render incremental. A lista
  // vem inteira (payload pequeno), mas só renderizamos uma janela por vez para
  // não jogar 200 linhas no DOM de uma vez. ponytail: paginação server-side só
  // quando a carteira passar de alguns milhares.
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) =>
      `${a.name ?? ""} ${a.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [athletes, query]);
  const visible = filtered.slice(0, visibleCount);

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
        <p className="text-muted">Carregando...</p>
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
          <h2 className={uiClasses.subheading}>Convidar atleta</h2>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={uiClasses.subheading}>Meus atletas ({athletes.length})</h2>
            {athletes.length > 8 && (
              <input
                className={`${uiClasses.input} max-w-xs`}
                placeholder="Buscar por nome ou e-mail..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisibleCount(50);
                }}
              />
            )}
          </div>
          {athletes.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhum atleta ainda. Convide um atleta pelo formulário acima para começar.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted">Nenhum atleta corresponde à busca.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visible.map((athlete) => {
                const label =
                  athlete.name ??
                  athlete.email ??
                  "Atleta convidado — nome ainda não informado";
                const avatar = (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface font-display text-xs font-bold text-muted">
                    {initials(label)}
                  </span>
                );
                const info = (
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{label}</p>
                    {athlete.name && athlete.email && (
                      <p className="truncate text-xs text-muted">{athlete.email}</p>
                    )}
                    {athlete.expiresAt &&
                      (athlete.status === "PENDING" || athlete.status === "EXPIRED") && (
                        <p className="text-xs text-faint">
                          Expira em {athlete.expiresAt.slice(0, 10)}
                          {athlete.resentCount > 0 ? ` · reenviado ${athlete.resentCount}×` : ""}
                        </p>
                      )}
                  </div>
                );
                const badge = (
                  <span className={`${uiClasses.badge} ${STATUS_CLASS[athlete.status]}`}>
                    {STATUS_LABEL[athlete.status]}
                  </span>
                );

                // Atleta ativo: linha inteira leva ao painel de métricas/evolução.
                if (athlete.status === "ACTIVE") {
                  return (
                    <li key={athlete.athleteProfileId}>
                      <Link
                        href={`/treinador/atletas/${athlete.athleteProfileId}`}
                        className="flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-line-strong hover:bg-surface"
                      >
                        {avatar}
                        {info}
                        {badge}
                        <ChevronRightIcon className="shrink-0 text-faint" />
                      </Link>
                    </li>
                  );
                }

                // Convites (pendente/expirado/etc.): sem detalhe, com ações inline.
                return (
                  <li
                    key={athlete.athleteProfileId}
                    className="flex items-center gap-3 rounded-lg border border-line p-3"
                  >
                    {avatar}
                    {info}
                    <div className="flex shrink-0 items-center gap-2">
                      {badge}
                      {athlete.invitationId && athlete.canResend && (
                        <button
                          type="button"
                          className="text-xs text-turq hover:underline disabled:opacity-50"
                          disabled={busyId === athlete.invitationId}
                          onClick={() => handleAction(athlete.invitationId as string, "resend")}
                        >
                          Reenviar
                        </button>
                      )}
                      {athlete.invitationId && athlete.canRevoke && (
                        <button
                          type="button"
                          className="text-xs text-danger hover:underline disabled:opacity-50"
                          disabled={busyId === athlete.invitationId}
                          onClick={() => handleAction(athlete.invitationId as string, "revoke")}
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {filtered.length > visible.length && (
            <button
              type="button"
              className={`${uiClasses.buttonGhost} self-center`}
              onClick={() => setVisibleCount((n) => n + 50)}
            >
              Carregar mais ({visible.length} de {filtered.length})
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
