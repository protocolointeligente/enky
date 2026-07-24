"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";

// Financeiro (Etapa 4 §15–17). Duas abas: Resumo (indicadores §17) e
// Inadimplência (§15). Sem métrica falsa: quando não há dados, diz isso.

interface Indicators {
  currency: string;
  hasData: boolean;
  clientesAtivos: number;
  novosClientes: number;
  trialsAtivos: number;
  contratosAtivos: number;
  leadsNovos: number;
  cancelamentos: number;
  receitaPrevista: number;
  receitaRecebida: number;
  receitaVencida: number;
  mrr: number;
  ticketMedio: number;
  churn: number;
  conversao: number;
  ltv: number;
}
interface DelinquencyItem {
  id: string;
  clientName: string;
  athleteName: string | null;
  planName: string;
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
  referencePeriod: string;
  dueDate: string;
  currency: string;
  remaining: number;
  daysLate: number;
  bucket: string;
}
interface DelinquencySummary {
  bucket: string;
  count: number;
  total: number;
}

function brl(n: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function date(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const BUCKET_LABELS: Record<string, string> = {
  "1-7": "1–7 dias",
  "8-15": "8–15 dias",
  "16-30": "16–30 dias",
  "31-60": "31–60 dias",
  "60+": "60+ dias",
};

export default function FinancePage() {
  const { checked } = useRequireRole("TRAINER");
  const [tab, setTab] = useState<"resumo" | "inadimplencia">("resumo");

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-col gap-1">
          <p className={uiClasses.eyebrow}>Gestão · Financeiro</p>
          <h1 className={uiClasses.heading}>Financeiro</h1>
        </header>

        <div className="flex gap-1 border-b border-line">
          {(["resumo", "inadimplencia"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === t ? "border-electric text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t === "resumo" ? "Resumo" : "Inadimplência"}
            </button>
          ))}
        </div>

        {tab === "resumo" ? <ResumoTab /> : <InadimplenciaTab />}
      </div>
    </main>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`${uiClasses.card} flex flex-col gap-1`}>
      <span className="text-xs text-faint">{label}</span>
      <span className={`font-display text-xl font-bold ${accent ? "text-electric-hi" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function ResumoTab() {
  const [ind, setInd] = useState<Indicators | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ indicators: Indicators }>("/api/trainer/finance/overview")
      .then((d) => setInd(d.indicators))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className={uiClasses.hint}>Carregando…</p>;
  if (error) return <ErrorNotice error={error} />;
  if (!ind || !ind.hasData) return <p className={uiClasses.hint}>Ainda não há dados suficientes.</p>;

  const c = ind.currency;
  return (
    <div className="flex flex-col gap-4">
      <p className={uiClasses.eyebrow}>Mês corrente</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita recebida" value={brl(ind.receitaRecebida, c)} accent />
        <Kpi label="Receita prevista" value={brl(ind.receitaPrevista, c)} />
        <Kpi label="Receita vencida" value={brl(ind.receitaVencida, c)} />
        <Kpi label="MRR" value={brl(ind.mrr, c)} />
        <Kpi label="Clientes ativos" value={String(ind.clientesAtivos)} />
        <Kpi label="Novos clientes" value={String(ind.novosClientes)} />
        <Kpi label="Trials ativos" value={String(ind.trialsAtivos)} />
        <Kpi label="Contratos ativos" value={String(ind.contratosAtivos)} />
        <Kpi label="Leads novos" value={String(ind.leadsNovos)} />
        <Kpi label="Cancelamentos" value={String(ind.cancelamentos)} />
        <Kpi label="Ticket médio" value={brl(ind.ticketMedio, c)} />
        <Kpi label="LTV simples" value={brl(ind.ltv, c)} />
        <Kpi label="Churn" value={pct(ind.churn)} />
        <Kpi label="Conversão de leads" value={pct(ind.conversao)} />
      </div>
    </div>
  );
}

function InadimplenciaTab() {
  const [items, setItems] = useState<DelinquencyItem[]>([]);
  const [summary, setSummary] = useState<DelinquencySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch<{ items: DelinquencyItem[]; summary: DelinquencySummary[]; totalOverdue: number }>(
      "/api/trainer/finance/delinquency",
    )
      .then((d) => {
        setItems(d.items);
        setSummary(d.summary);
        setTotal(d.totalOverdue);
      })
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className={uiClasses.hint}>Carregando…</p>;
  if (error) return <ErrorNotice error={error} />;
  if (items.length === 0) return <p className={uiClasses.hint}>Nenhuma fatura vencida em aberto. 🎉</p>;

  const currency = items[0]?.currency ?? "BRL";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((s) => (
          <div key={s.bucket} className={`${uiClasses.card} flex flex-col gap-1`}>
            <span className="text-xs text-faint">{BUCKET_LABELS[s.bucket] ?? s.bucket}</span>
            <span className="font-display text-lg font-bold text-ink">{brl(s.total, currency)}</span>
            <span className="text-xs text-muted">{s.count} fatura(s)</span>
          </div>
        ))}
      </div>
      <p className={uiClasses.hint}>
        Total em aberto vencido: <strong className="text-danger">{brl(total, currency)}</strong>
      </p>

      <div className={`${uiClasses.panel} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-faint">
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Plano</th>
              <th className="px-4 py-2 font-medium">Competência</th>
              <th className="px-4 py-2 font-medium">Vencimento</th>
              <th className="px-4 py-2 font-medium">Atraso</th>
              <th className="px-4 py-2 font-medium">Em aberto</th>
              <th className="px-4 py-2 font-medium">Contato</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-line/50">
                <td className="px-4 py-2">
                  <span className="font-medium text-ink">{i.clientName}</span>
                  {i.athleteName ? <span className="block text-xs text-faint">Atleta: {i.athleteName}</span> : null}
                </td>
                <td className="px-4 py-2 text-muted">{i.planName}</td>
                <td className="px-4 py-2 text-muted">{i.referencePeriod}</td>
                <td className="px-4 py-2 text-muted">{date(i.dueDate)}</td>
                <td className="px-4 py-2">
                  <span className={`${uiClasses.badge} bg-danger/15 text-danger`}>{i.daysLate}d</span>
                </td>
                <td className="px-4 py-2 font-medium text-ink">{brl(i.remaining, i.currency)}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {i.payerName}
                  {i.payerPhone ? <span className="block">{i.payerPhone}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
