"use client";

import { useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { EmptyState } from "@/components/ui/empty-state";
import { LayersIcon } from "@/components/ui/icons";
import type { AssessmentView } from "@/modules/assessments/assessment-service";
import { formatSecondsAsPace, isPaceUnit, type Zone } from "@/modules/assessments/zones";

function unitLabel(unit: string): string {
  return unit === "s/km" ? "/km" : unit === "s/100m" ? "/100m" : unit;
}

function formatResult(value: number, unit: string): string {
  return isPaceUnit(unit) ? `${formatSecondsAsPace(value)} ${unitLabel(unit)}` : `${value} ${unit}`;
}

function zoneRange(z: Zone, unit: string): string {
  const fmt = (v: number) => (isPaceUnit(unit) ? formatSecondsAsPace(v) : String(v));
  const label = unitLabel(unit);
  if (z.min === null) return `≤ ${fmt(z.max as number)} ${label}`;
  if (z.max === null) return `≥ ${fmt(z.min)} ${label}`;
  return `${fmt(z.min)}–${fmt(z.max)} ${label}`;
}

// Avaliações do atleta (§28): histórico de testes físicos registrados pelo
// treinador. Só leitura — o atleta não edita avaliação.
export default function AthleteAssessmentsPage() {
  const { checked } = useRequireRole("ATHLETE");
  const [items, setItems] = useState<AssessmentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ assessments: AssessmentView[] }>("/api/athlete/assessments")
      .then((r) => setItems(r.assessments))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro ao carregar."));
  }, [checked]);

  if (!checked || (items === null && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Avaliações</span>
          <h1 className={uiClasses.heading}>Meus testes físicos</h1>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {items && items.length === 0 && (
          <EmptyState
            title="Nenhuma avaliação ainda"
            description="Seus testes físicos e zonas aparecem aqui quando seu treinador os registra."
            icon={<LayersIcon width={28} height={28} />}
          />
        )}

        {items && items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 rounded-xl border border-line bg-petrol/70 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{a.testType}</span>
                  <span className="font-display text-lg font-semibold text-ink">
                    {formatResult(a.resultValue, a.unit)}
                  </span>
                </div>
                <span className="text-xs text-muted">
                  {new Date(a.performedAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                  {a.protocol && ` · ${a.protocol}`}
                </span>
                {a.zones && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-faint">
                      Zonas de treino
                    </span>
                    {a.zones.zones.map((z) => (
                      <div key={z.label} className="flex items-baseline justify-between text-sm">
                        <span className="text-muted">{z.label}</span>
                        <span className="font-medium text-ink">{zoneRange(z, a.zones!.unit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
