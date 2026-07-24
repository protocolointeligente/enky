"use client";

import { useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { StatCard } from "@/components/ui/stat-card";
import { AlertIcon, CheckIcon, ClockIcon, LayersIcon } from "@/components/ui/icons";
import { useAdminList } from "../_lib/use-admin-list";

interface Dashboard {
  periodDays: number;
  gmv: number;
  commissions: number;
  takeRatePct: number;
  sales: number;
  averageTicket: number;
  refunds: number;
  refundedAmount: number;
  mrr: number;
  activeSellers: number;
  publishedProducts: number;
  pendingModeration: number;
  overdueSubscriptions: number;
}

interface QueueItem {
  id: string;
  title: string;
  slug: string;
  sellerName: string;
  productType: string;
  price: string;
  submittedAt: string;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MarketplacePanel() {
  return (
    <div className="flex flex-col gap-8">
      <CommercialDashboard />
      <ModerationQueue />
    </div>
  );
}

function CommercialDashboard() {
  const [days, setDays] = useState("30");
  const { data, loading, error } = useAdminList<{ dashboard: Dashboard }>(
    "/api/admin/marketplace/dashboard",
    { days },
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className={uiClasses.subheading}>Dashboard comercial</h2>
        <select
          className={uiClasses.select}
          style={{ width: "auto" }}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-label="Período"
        >
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="365">1 ano</option>
        </select>
      </div>

      {error && <p className={uiClasses.error}>{error}</p>}
      {loading || !data ? (
        <p className="text-sm text-muted">Carregando métricas...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="GMV (marketplace)" value={brl(data.dashboard.gmv)} tone="turq" icon={<LayersIcon />} hint={`${data.dashboard.sales} venda(s) no período`} />
          <StatCard label="Comissões ENKY" value={brl(data.dashboard.commissions)} tone="electric" icon={<LayersIcon />} hint={`take-rate ${data.dashboard.takeRatePct}%`} />
          <StatCard label="Ticket médio" value={brl(data.dashboard.averageTicket)} icon={<LayersIcon />} />
          <StatCard label="MRR (SaaS)" value={brl(data.dashboard.mrr)} tone="turq" icon={<LayersIcon />} />
          <StatCard label="Reembolsos" value={data.dashboard.refunds} tone={data.dashboard.refunds > 0 ? "orange" : "default"} icon={<AlertIcon />} hint={brl(data.dashboard.refundedAmount)} />
          <StatCard label="Vendedores ativos" value={data.dashboard.activeSellers} icon={<CheckIcon />} hint="com produto publicado" />
          <StatCard label="Produtos publicados" value={data.dashboard.publishedProducts} icon={<CheckIcon />} />
          <StatCard label="Na fila de moderação" value={data.dashboard.pendingModeration} tone={data.dashboard.pendingModeration > 0 ? "orange" : "default"} icon={<ClockIcon />} />
          <StatCard label="Inadimplência SaaS" value={data.dashboard.overdueSubscriptions} tone={data.dashboard.overdueSubscriptions > 0 ? "orange" : "default"} icon={<AlertIcon />} hint="assinaturas PAST_DUE/UNPAID" />
        </div>
      )}
    </section>
  );
}

function ModerationQueue() {
  const { data, loading, error, reload } = useAdminList<{ queue: QueueItem[] }>(
    "/api/admin/marketplace/moderation",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(id: string, action: "APPROVE" | "REJECT" | "SUSPEND") {
    let reason: string | undefined;
    if (action === "REJECT" || action === "SUSPEND") {
      const r = window.prompt(`Justificativa para ${action === "REJECT" ? "rejeitar" : "suspender"}:`);
      if (r == null) return; // cancelado
      reason = r;
    }
    setBusy(id);
    setActionError(null);
    try {
      await apiFetch(`/api/admin/marketplace/products/${id}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : "Erro na moderação.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className={uiClasses.subheading}>Fila de moderação</h2>
      {actionError && <p className={uiClasses.error}>{actionError}</p>}
      {error && <p className={uiClasses.error}>{error}</p>}

      {loading || !data ? (
        <p className="text-sm text-muted">Carregando fila...</p>
      ) : data.queue.length === 0 ? (
        <p className="rounded-xl border border-line bg-petrol/70 p-4 text-sm text-muted">
          Nenhum produto aguardando revisão.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.queue.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-petrol/70 p-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{p.title}</p>
                <p className="truncate text-xs text-muted">
                  {p.sellerName} · {p.productType} · {brl(Number(p.price))} · enviado{" "}
                  {new Date(p.submittedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={uiClasses.buttonSecondary} disabled={busy === p.id} onClick={() => act(p.id, "APPROVE")}>
                  Aprovar
                </button>
                <button type="button" className={uiClasses.buttonGhost} disabled={busy === p.id} onClick={() => act(p.id, "REJECT")}>
                  Rejeitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
