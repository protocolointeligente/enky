"use client";

import { uiClasses } from "@/app/_lib/ui";

// Snapshot que o report-service grava (metricsSnapshot). Só leitura na UI.
interface ReportSnapshot {
  period: { start: string; end: string };
  adherence: { due: number; completed: number; partial: number; missed: number; pct: number | null };
  load: { ctl: number; acwr: number | null; dataDays: number };
  readiness: { count: number; latestClass: string | null };
}

export interface ReportItem {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  metricsSnapshot: ReportSnapshot;
  insights: string | null;
  recommendations: string | null;
  limitations: string | null;
  sharedAt: string | null;
}

const READINESS_LABEL: Record<string, string> = {
  boa: "boa",
  atencao: "atenção",
  baixa: "baixa",
  insuficiente: "insuficiente",
};

function fmtDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-faint">{label}</span>
      <span className="tabular font-display text-lg font-bold text-ink">{value}</span>
    </div>
  );
}

export function ReportView({ report, onShare }: { report: ReportItem; onShare?: () => void }) {
  const s = report.metricsSnapshot;
  const shared = report.status === "PUBLISHED";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-petrol/70 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-ink">
          {fmtDay(report.periodStart)} – {fmtDay(report.periodEnd)}
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            shared ? "bg-turq/15 text-turq" : "bg-surface text-faint"
          }`}
        >
          {shared ? "Compartilhado" : "Rascunho"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Aderência" value={s.adherence.pct != null ? `${s.adherence.pct}%` : "—"} />
        <Stat
          label="ACWR"
          value={s.load.dataDays >= 10 && s.load.acwr != null ? s.load.acwr.toFixed(2) : "—"}
        />
        <Stat
          label="Prontidão"
          value={s.readiness.latestClass ? READINESS_LABEL[s.readiness.latestClass] ?? "—" : "—"}
        />
      </div>

      {report.insights && <p className="text-sm text-ink">{report.insights}</p>}
      {report.recommendations && (
        <p className="text-sm text-muted">
          <span className="font-semibold text-faint">Recomendações: </span>
          {report.recommendations}
        </p>
      )}
      {report.limitations && <p className="text-xs text-faint">{report.limitations}</p>}

      {onShare && (
        <button type="button" className={`${uiClasses.button} self-start`} onClick={onShare}>
          Compartilhar com o atleta
        </button>
      )}
    </div>
  );
}
