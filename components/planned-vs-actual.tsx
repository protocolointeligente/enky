"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { formatDistance, formatDuration, formatPace } from "@/app/_lib/activity-format";
import { modalityLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { StatusBadge } from "@/components/ui/badge";

// Planejado × Realizado (Fase 11) — o critério de aceite "treinador visualiza
// planejado versus realizado".
//
// A tela NÃO julga: mostra os dois lados lado a lado e cala. Não há barra de
// aderência, não há "87% cumprido", não há verde/vermelho de aprovação. O
// sistema não sabe a intenção da sessão — 9,4km num prescrito de 10km pode ser
// um treino perfeito ou uma desistência, e só o treinador, olhando o feedback e
// o atleta, sabe qual. Ver modules/integrations/planned-vs-actual.ts.

interface ActualView {
  id: string;
  name: string | null;
  rawType: string;
  modality: string | null;
  localDate: string;
  distanceMeters: number | null;
  movingSeconds: number | null;
  elevationGainMeters: number | null;
  paceSecondsPerKm: number | null;
  matchStatus: "UNMATCHED" | "MATCHED" | "AMBIGUOUS";
}

interface Row {
  workout: {
    id: string;
    title: string;
    modality: string;
    status: string;
    plannedDate: string;
  };
  actual: ActualView | null;
}

interface View {
  rows: Row[];
  unplanned: ActualView[];
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function ActualSummary({ actual }: { actual: ActualView }) {
  const parts = [
    formatDistance(actual.distanceMeters),
    formatDuration(actual.movingSeconds),
    formatPace(actual.paceSecondsPerKm, actual.modality),
    actual.elevationGainMeters !== null ? `${actual.elevationGainMeters} m` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="truncate text-sm text-ink">{actual.name ?? actual.rawType}</span>
      <span className="tabular text-xs text-muted">{parts.join(" · ")}</span>
    </div>
  );
}

export function PlannedVsActual({ athleteId }: { athleteId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<View>(`/api/trainer/athletes/${athleteId}/planned-vs-actual`)
      .then(setView)
      .catch((err) =>
        setError(err instanceof ApiClientError ? err.message : "Erro inesperado."),
      )
      .finally(() => setLoading(false));
  }, [athleteId]);

  if (loading) {
    return (
      <section className={uiClasses.panel}>
        <div className="px-5 py-4">
          <p className="text-sm text-muted">Carregando planejado × realizado...</p>
        </div>
      </section>
    );
  }

  // A comparação é um PERIFÉRICO da tela: se ela falhar, o resto do detalhe do
  // atleta continua servindo. Por isso um erro aqui vira uma linha discreta, e
  // não uma tela de erro que engoliria a página inteira.
  if (error || !view) {
    return (
      <section className={uiClasses.panel}>
        <div className="px-5 py-4">
          <p className="text-sm text-faint">Não foi possível carregar o realizado. {error}</p>
        </div>
      </section>
    );
  }

  const withActual = view.rows.filter((row) => row.actual).length;

  return (
    <section className={uiClasses.panel}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className={uiClasses.subheading}>Planejado × Realizado</h2>
          <span className="text-xs text-faint">Últimos 28 dias · atividades importadas do Strava</span>
        </div>
        <span className="text-xs text-faint">
          {withActual} de {view.rows.length} com registro
        </span>
      </div>

      {view.rows.length === 0 && view.unplanned.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-sm text-faint">
            Nenhum treino no período. Quando o atleta conectar o Strava, o realizado aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {view.rows.map((row) => (
            <li key={row.workout.id} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-3 px-5 py-3">
              <span className="text-xs font-semibold text-ink">
                {formatDay(row.workout.plannedDate)}
              </span>

              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-ink">{row.workout.title}</span>
                <span className="text-xs text-muted">{modalityLabel(row.workout.modality)}</span>
              </div>

              {row.actual ? (
                <ActualSummary actual={row.actual} />
              ) : (
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.workout.status} />
                  <span className="text-xs text-faint">sem registro</span>
                </div>
              )}
            </li>
          ))}

          {/* Realizado sem plano. Não é ruído a esconder: é volume real do
              atleta — omitir mostraria uma semana mais leve do que a que ele
              de fato teve. */}
          {view.unplanned.map((actual) => (
            <li
              key={actual.id}
              className="grid grid-cols-[4rem_1fr_1fr] items-center gap-3 bg-surface/40 px-5 py-3"
            >
              <span className="text-xs font-semibold text-ink">{formatDay(actual.localDate)}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-faint">
                  {actual.matchStatus === "AMBIGUOUS"
                    ? "Mais de um treino possível no dia"
                    : "Fora do planejado"}
                </span>
                <span className="text-xs text-muted">
                  {actual.modality ? modalityLabel(actual.modality) : actual.rawType}
                </span>
              </div>
              <ActualSummary actual={actual} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
