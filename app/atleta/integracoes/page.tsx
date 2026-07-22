"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { formatDistance, formatDuration, formatPace } from "@/app/_lib/activity-format";

interface ConnectionView {
  id: string;
  status: "ACTIVE" | "REVOKED";
  connectedAt: string;
  lastSyncedAt: string | null;
}

interface ActivityView {
  id: string;
  name: string | null;
  rawType: string;
  modality: string | null;
  startedAt: string;
  localDate: string;
  distanceMeters: number | null;
  movingSeconds: number | null;
  elevationGainMeters: number | null;
  paceSecondsPerKm: number | null;
  matchStatus: "UNMATCHED" | "MATCHED" | "AMBIGUOUS";
}

interface IntegrationState {
  configured: boolean;
  connection: ConnectionView | null;
  activities: ActivityView[];
}

// Motivos que o callback devolve na query string (nunca texto do provedor —
// ver app/api/athlete/integrations/strava/callback/route.ts).
const CALLBACK_REASONS: Record<string, string> = {
  autorizacao_negada: "Você cancelou a autorização no Strava.",
  estado_invalido: "O pedido expirou ou não pôde ser validado. Tente conectar de novo.",
  codigo_ausente: "O Strava não devolveu o código de autorização.",
  escopo_insuficiente:
    "É preciso permitir o acesso a todas as atividades, inclusive as privadas — sem isso seu histórico ficaria incompleto.",
  falha_conexao: "Não foi possível concluir a conexão com o Strava.",
};

const MATCH_LABELS: Record<ActivityView["matchStatus"], string> = {
  MATCHED: "Vinculada ao treino do dia",
  UNMATCHED: "Sem treino planejado",
  AMBIGUOUS: "Mais de um treino possível no dia",
};

function AthleteIntegrationsContent() {
  const { checked } = useRequireRole("ATHLETE");
  const searchParams = useSearchParams();

  const [state, setState] = useState<IntegrationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await apiFetch<IntegrationState>("/api/athlete/integrations/strava"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!checked) return;
    void load();
  }, [checked, load]);

  // Resultado do retorno do Strava.
  useEffect(() => {
    const result = searchParams.get("strava");
    if (result === "conectado") setNotice("Strava conectado. Importe suas atividades recentes.");
    if (result === "erro") {
      setError(CALLBACK_REASONS[searchParams.get("motivo") ?? ""] ?? "Não foi possível conectar.");
    }
  }, [searchParams]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { authorizationUrl } = await apiFetch<{ authorizationUrl: string }>(
        "/api/athlete/integrations/strava/authorize",
        { method: "POST" },
      );
      // Navegação de verdade, não fetch: o OAuth acontece no site do Strava.
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível iniciar a conexão.");
      setBusy(false);
    }
  }

  async function importActivities() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { summary } = await apiFetch<{
        summary: { imported: number; updated: number; skipped: number; matched: number };
      }>("/api/athlete/integrations/strava/import", { method: "POST" });

      setNotice(
        summary.imported === 0 && summary.updated === 0
          ? "Nenhuma atividade nova encontrada."
          : `${summary.imported} nova(s), ${summary.updated} atualizada(s), ${summary.matched} vinculada(s) a treinos.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível importar.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar o Strava? Suas atividades já importadas continuam aqui.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/athlete/integrations/strava", { method: "DELETE" });
      setNotice("Strava desconectado. A ENKY não tem mais acesso à sua conta.");
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível desconectar.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const connected = state?.connection?.status === "ACTIVE";

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Integrações</span>
          <h1 className={uiClasses.heading}>Strava</h1>
          <p className={uiClasses.hint}>
            Conecte para que suas atividades apareçam junto do que foi planejado. Seu treinador
            passa a ver o realizado sem você digitar nada.
          </p>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}
        {notice && <p className={uiClasses.success}>{notice}</p>}

        <section className={uiClasses.card}>
          {!state?.configured ? (
            <p className={uiClasses.hint}>
              A integração com o Strava não está disponível nesta instalação.
            </p>
          ) : connected ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-turq">Conectado</span>
                  <span className="text-xs text-faint">
                    Desde{" "}
                    {new Date(state.connection!.connectedAt).toLocaleDateString("pt-BR")}
                    {state.connection!.lastSyncedAt
                      ? ` · última importação em ${new Date(
                          state.connection!.lastSyncedAt,
                        ).toLocaleDateString("pt-BR")}`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={uiClasses.button}
                  onClick={importActivities}
                  disabled={busy}
                >
                  {busy ? "Importando…" : "Importar atividades recentes"}
                </button>
                <button
                  type="button"
                  className={uiClasses.buttonDanger}
                  onClick={disconnect}
                  disabled={busy}
                >
                  Desconectar
                </button>
              </div>
              <p className="text-xs text-faint">
                Importamos os últimos 30 dias. Atividades novas chegam sozinhas depois de
                conectar.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className={uiClasses.hint}>
                Você será levado ao Strava para autorizar. A ENKY nunca vê sua senha e você pode
                desconectar quando quiser.
              </p>
              <button type="button" className={uiClasses.button} onClick={connect} disabled={busy}>
                {busy ? "Abrindo o Strava…" : "Conectar com o Strava"}
              </button>
            </div>
          )}
        </section>

        {state && state.activities.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={uiClasses.subheading}>Atividades importadas</h2>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-petrol/70">
              {state.activities.map((activity) => (
                <li key={activity.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-ink">
                      {activity.name ?? activity.rawType}
                    </span>
                    <span className="shrink-0 text-xs text-faint">
                      {new Date(`${activity.localDate}T00:00:00`).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {activity.modality ? modalityLabel(activity.modality) : activity.rawType}
                    {formatDistance(activity.distanceMeters) &&
                      ` · ${formatDistance(activity.distanceMeters)}`}
                    {formatDuration(activity.movingSeconds) &&
                      ` · ${formatDuration(activity.movingSeconds)}`}
                    {formatPace(activity.paceSecondsPerKm, activity.modality) &&
                      ` · ${formatPace(activity.paceSecondsPerKm, activity.modality)}`}
                    {activity.elevationGainMeters !== null &&
                      ` · ${activity.elevationGainMeters} m de ganho`}
                  </span>
                  <span className="text-[11px] text-faint">{MATCH_LABELS[activity.matchStatus]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href="/atleta" className={uiClasses.link}>
          ← Voltar
        </Link>
      </div>
    </main>
  );
}

// `useSearchParams` exige Suspense no App Router — sem ele a página inteira
// vira client-side rendering no build.
export default function AthleteIntegrationsPage() {
  return (
    <Suspense
      fallback={
        <main className={uiClasses.page}>
          <p className="text-muted">Carregando...</p>
        </main>
      }
    >
      <AthleteIntegrationsContent />
    </Suspense>
  );
}
