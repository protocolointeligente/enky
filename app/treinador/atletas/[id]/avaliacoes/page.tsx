"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import type { AssessmentView } from "@/modules/assessments/assessment-service";
import type { Zone } from "@/modules/assessments/zones";

function zoneRange(z: Zone, unit: string): string {
  if (z.min === null) return `≤ ${z.max} ${unit}`;
  if (z.max === null) return `≥ ${z.min} ${unit}`;
  return `${z.min}–${z.max} ${unit}`;
}

// Sugestões comuns — texto livre, o treinador pode digitar outro.
const COMMON_TESTS = ["Limiar de FC", "Pace de limiar", "FTP", "VO2max", "CSS", "1RM", "Salto vertical"];

export default function TrainerAssessmentsPage() {
  const { checked } = useRequireRole("TRAINER");
  const params = useParams();
  const athleteId = String(params.id);

  const [items, setItems] = useState<AssessmentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [testType, setTestType] = useState("");
  const [resultValue, setResultValue] = useState("");
  const [unit, setUnit] = useState("");
  const [protocol, setProtocol] = useState("");

  const load = useCallback(() => {
    apiFetch<{ assessments: AssessmentView[] }>(`/api/trainer/athletes/${athleteId}/assessments`)
      .then((r) => setItems(r.assessments))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro ao carregar."));
  }, [athleteId]);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  const value = Number(resultValue.replace(",", "."));
  const valid = testType.trim().length >= 2 && Number.isFinite(value) && unit.trim().length >= 1;

  async function record() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/athletes/${athleteId}/assessments`, {
        method: "POST",
        body: JSON.stringify({
          testType: testType.trim(),
          resultValue: value,
          unit: unit.trim(),
          protocol: protocol.trim() || undefined,
        }),
      });
      setTestType("");
      setResultValue("");
      setUnit("");
      setProtocol("");
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className={uiClasses.heading}>Avaliações físicas</h1>
        <Link href={`/treinador/atletas/${athleteId}`} className={uiClasses.link}>
          ← Atleta
        </Link>
      </header>

      {error && <p className={uiClasses.error}>{error}</p>}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className={uiClasses.subheading}>Registrar teste</h2>
        <input
          className={uiClasses.input}
          list="common-tests"
          placeholder="Tipo de teste"
          value={testType}
          onChange={(e) => setTestType(e.target.value)}
        />
        <datalist id="common-tests">
          {COMMON_TESTS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <div className="flex gap-3">
          <input
            className={uiClasses.input}
            inputMode="decimal"
            placeholder="Resultado"
            value={resultValue}
            onChange={(e) => setResultValue(e.target.value)}
          />
          <input
            className={uiClasses.input}
            placeholder="Unidade (bpm, W, min/km...)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
        <input
          className={uiClasses.input}
          placeholder="Protocolo (opcional)"
          value={protocol}
          onChange={(e) => setProtocol(e.target.value)}
        />
        <button type="button" disabled={busy || !valid} onClick={record} className={uiClasses.button}>
          Registrar
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={uiClasses.subheading}>Histórico</h2>
        {items && items.length === 0 && <p className="text-muted">Nenhuma avaliação registrada.</p>}
        {items && items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-ink">{a.testType}</span>
                    <span className="text-xs text-muted">
                      {new Date(a.performedAt).toLocaleDateString("pt-BR")}
                      {a.protocol && ` · ${a.protocol}`}
                    </span>
                  </div>
                  <span className="font-semibold text-ink">
                    {a.resultValue} {a.unit}
                  </span>
                </div>
                {a.zones && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-2 text-xs">
                    {a.zones.zones.map((z) => (
                      <div key={z.label} className="flex justify-between gap-2">
                        <span className="truncate text-muted">{z.label}</span>
                        <span className="shrink-0 font-medium text-ink">{zoneRange(z, a.zones!.unit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
