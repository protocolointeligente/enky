"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { addDays, toISODate } from "@/app/_lib/calendar";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ReportView, type ReportItem } from "@/components/report-view";

interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
  status: string;
}

export default function TrainerReportsPage() {
  const { checked } = useRequireRole("TRAINER");
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [start, setStart] = useState(() => toISODate(addDays(new Date(), -30)));
  const [end, setEnd] = useState(() => toISODate(new Date()));
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster")
      .then((r) => {
        const active = r.athletes.filter((a) => a.status === "ACTIVE");
        setRoster(active);
        if (active[0]) setAthleteId(active[0].athleteProfileId);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  useEffect(() => {
    if (!athleteId) {
      setReports([]);
      return;
    }
    apiFetch<{ reports: ReportItem[] }>(`/api/trainer/athletes/${athleteId}/reports`)
      .then((r) => setReports(r.reports))
      .catch(() => setReports([]));
  }, [athleteId]);

  async function generate() {
    if (!athleteId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ report: ReportItem }>(
        `/api/trainer/athletes/${athleteId}/reports`,
        { method: "POST", body: JSON.stringify({ periodStart: start, periodEnd: end }) },
      );
      setReports((prev) => [result.report, ...prev]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível gerar.");
    } finally {
      setBusy(false);
    }
  }

  async function share(id: string) {
    try {
      const result = await apiFetch<{ report: ReportItem }>(
        `/api/trainer/reports/${id}/share`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setReports((prev) => prev.map((r) => (r.id === id ? result.report : r)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível compartilhar.");
    }
  }

  const selectedName = useMemo(
    () => roster.find((a) => a.athleteProfileId === athleteId)?.name ?? "atleta",
    [roster, athleteId],
  );

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
        <header className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Relatórios</span>
          <h1 className={uiClasses.heading}>Relatórios de período</h1>
          <p className={uiClasses.hint}>
            Um resumo de aderência, carga e prontidão do período. Revise e compartilhe com o atleta.
          </p>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {roster.length === 0 ? (
          <p className="text-muted">Nenhum atleta ativo para gerar relatório.</p>
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-2xl border border-line bg-petrol/70 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="athlete" className={uiClasses.label}>
                    Atleta
                  </label>
                  <select
                    id="athlete"
                    className={uiClasses.select}
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                  >
                    {roster.map((a) => (
                      <option key={a.athleteProfileId} value={a.athleteProfileId}>
                        {a.name ?? "Atleta"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="start" className={uiClasses.label}>
                    Início
                  </label>
                  <input
                    id="start"
                    type="date"
                    className={uiClasses.input}
                    value={start}
                    max={end}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="end" className={uiClasses.label}>
                    Fim
                  </label>
                  <input
                    id="end"
                    type="date"
                    className={uiClasses.input}
                    value={end}
                    min={start}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>
              <button type="button" className={uiClasses.button} onClick={generate} disabled={busy}>
                {busy ? "Gerando…" : `Gerar relatório de ${selectedName}`}
              </button>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className={uiClasses.subheading}>Relatórios gerados</h2>
              {reports.length === 0 ? (
                <p className="text-sm text-muted">Nenhum relatório para este atleta ainda.</p>
              ) : (
                reports.map((report) => (
                  <ReportView
                    key={report.id}
                    report={report}
                    onShare={report.status === "DRAFT" ? () => share(report.id) : undefined}
                  />
                ))
              )}
            </section>
          </>
        )}

        <Link href="/treinador" className={uiClasses.link}>
          ← Voltar ao painel
        </Link>
      </div>
    </main>
  );
}
