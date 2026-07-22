"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportView, type ReportEntry } from "@/components/report-view";

export default function AthleteReportsPage() {
  const { checked } = useRequireRole("ATHLETE");
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    // A API já devolve só os PUBLISHED: um relatório revogado simplesmente
    // deixa de vir nesta lista.
    apiFetch<{ reports: ReportEntry[] }>("/api/athlete/reports")
      .then((r) => setReports(r.reports))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Relatórios</span>
          <h1 className={uiClasses.heading}>Seus relatórios</h1>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {reports.length === 0 ? (
          <EmptyState
            title="Nenhum relatório ainda"
            description="Quando seu treinador compartilhar um relatório, ele aparece aqui."
          />
        ) : (
          reports.map((entry) => (
            <ReportView
              key={entry.report.id}
              entry={entry}
              pdfHref={`/api/athlete/reports/${entry.report.id}/pdf`}
            />
          ))
        )}

        <Link href="/atleta" className={uiClasses.link}>
          ← Voltar
        </Link>
      </div>
    </main>
  );
}
