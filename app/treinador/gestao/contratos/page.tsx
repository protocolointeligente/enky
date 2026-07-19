"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field, Info, Overlay } from "../_components";

// Contratos assessoria↔cliente (Etapa 4 §10–11). Lista + criar + drawer (mudar
// status, aceitar, ver documento). Mensalidades a partir do contrato entram em §12.

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_SIGNATURE: "Aguardando aceite",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  OVERDUE: "Em atraso",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  COMPLETED: "Concluído",
};
const STATUSES = Object.keys(STATUS_LABELS);
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-turq/15 text-turq",
  PENDING_SIGNATURE: "bg-electric/15 text-electric-hi",
  OVERDUE: "bg-orange/15 text-orange-hi",
  CANCELLED: "bg-danger/15 text-danger",
  EXPIRED: "bg-surface text-faint",
  COMPLETED: "bg-surface text-faint",
  PAUSED: "bg-surface text-muted",
};

interface Named {
  id: string;
  name: string;
}
interface ContractRow {
  id: string;
  status: string;
  finalPrice: string;
  currency: string;
  startDate: string;
  client: Named;
  servicePlan: Named;
}
interface ContractDetail extends ContractRow {
  athleteId: string | null;
  payer: Named;
  athlete: { id: string; user: { name: string } | null } | null;
  price: string;
  discount: string;
  endDate: string | null;
  billingDay: number;
  autoRenew: boolean;
  gracePeriodDays: number;
  cancellationNoticeDays: number;
  acceptedAt: string | null;
  acceptedBy: string | null;
}

function money(v: string, currency: string): string {
  const n = Number(v);
  return Number.isNaN(n) ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}
function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function statusBadge(s: string) {
  return `${uiClasses.badge} ${STATUS_BADGE[s] ?? "bg-surface text-muted"}`;
}

export default function ContractsPage() {
  const { checked } = useRequireRole("TRAINER");
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    apiFetch<{ contracts: ContractRow[] }>(`/api/trainer/contracts?${params.toString()}`)
      .then((d) => setContracts(d.contracts))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão · Contratos</p>
            <h1 className={uiClasses.heading}>Contratos</h1>
          </div>
          <button type="button" className={uiClasses.button} onClick={() => setCreating(true)}>
            Novo contrato
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <select className={uiClasses.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : contracts.length === 0 ? (
          <p className={uiClasses.hint}>Nenhum contrato ainda.</p>
        ) : (
          <div className={`${uiClasses.panel} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-faint">
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Início</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="cursor-pointer border-b border-line/50 hover:bg-surface/40"
                  >
                    <td className="px-4 py-2 font-medium text-ink">{c.client.name}</td>
                    <td className="px-4 py-2 text-muted">{c.servicePlan.name}</td>
                    <td className="px-4 py-2">
                      <span className={statusBadge(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</span>
                    </td>
                    <td className="px-4 py-2 text-muted">{money(c.finalPrice, c.currency)}</td>
                    <td className="px-4 py-2 text-muted">{date(c.startDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating ? (
        <ContractForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}

      {selectedId ? (
        <ContractDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      ) : null}
    </main>
  );
}

interface PlanOption {
  id: string;
  name: string;
  price: string;
}
interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
}

function ContractForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [clients, setClients] = useState<Named[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [clientId, setClientId] = useState("");
  const [servicePlanId, setServicePlanId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [payerClientId, setPayerClientId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billingDay, setBillingDay] = useState("1");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [autoRenew, setAutoRenew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ clients: Named[] }>("/api/trainer/clients?take=100").then((d) => setClients(d.clients)).catch(() => {});
    apiFetch<{ plans: PlanOption[] }>("/api/trainer/service-plans?activeOnly=true").then((d) => setPlans(d.plans)).catch(() => {});
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster").then((d) => setRoster(d.athletes)).catch(() => {});
  }, []);

  // Prefill do preço a partir do plano escolhido (o preço fica congelado depois).
  function selectPlan(id: string) {
    setServicePlanId(id);
    const p = plans.find((x) => x.id === id);
    if (p && !price) setPrice(p.price);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/contracts", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          servicePlanId,
          athleteId: athleteId || null,
          payerClientId: payerClientId || null,
          startDate,
          billingDay: Number(billingDay) || 1,
          price: price.trim() ? Number(price) : null,
          discount: Number(discount) || 0,
          autoRenew,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao criar contrato.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = clientId && servicePlanId && startDate && !busy;

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Novo contrato</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Cliente *">
          <select className={uiClasses.select} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plano *">
          <select className={uiClasses.select} value={servicePlanId} onChange={(e) => selectPlan(e.target.value)}>
            <option value="">Selecione…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Atleta (opcional)">
            <select className={uiClasses.select} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
              <option value="">—</option>
              {roster.map((a) => (
                <option key={a.athleteProfileId} value={a.athleteProfileId}>
                  {a.name ?? "Atleta"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pagador (se diferente)">
            <select className={uiClasses.select} value={payerClientId} onChange={(e) => setPayerClientId(e.target.value)}>
              <option value="">Mesmo cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Início *">
            <input className={uiClasses.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Dia de venc.">
            <input className={uiClasses.input} type="number" min="1" max="31" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
          </Field>
          <Field label="Renov. auto">
            <label className="flex h-10 items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="accent-electric" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
              Sim
            </label>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço (R$)">
            <input className={uiClasses.input} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Desconto (R$)">
            <input className={uiClasses.input} type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={uiClasses.button} disabled={!canSubmit} onClick={submit}>
          {busy ? "Salvando…" : "Criar contrato"}
        </button>
      </div>
    </Overlay>
  );
}

function ContractDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState<ContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [acceptedBy, setAcceptedBy] = useState("");

  const load = useCallback(() => {
    apiFetch<{ contract: ContractDetail }>(`/api/trainer/contracts/${id}`)
      .then((d) => {
        setC(d.contract);
        setNewStatus(d.contract.status);
      })
      .catch((e: ApiClientError) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus() {
    if (!c || newStatus === c.status) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/contracts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao mudar status.");
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!acceptedBy.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/contracts/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ method: "CHECKBOX", acceptedBy: acceptedBy.trim() }),
      });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao registrar aceite.");
    } finally {
      setBusy(false);
    }
  }

  const canAccept = c && (c.status === "DRAFT" || c.status === "PENDING_SIGNATURE");

  return (
    <Overlay onClose={onClose} side>
      {!c ? (
        <p className={uiClasses.hint}>Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className={uiClasses.subheading}>{c.client.name}</h2>
              <p className="text-sm text-muted">{c.servicePlan.name}</p>
            </div>
            <span className={statusBadge(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</span>
          </div>

          {error ? <p className={uiClasses.error}>{error}</p> : null}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Valor final" value={money(c.finalPrice, c.currency)} />
            <Info label="Preço / desconto" value={`${money(c.price, c.currency)} / ${money(c.discount, c.currency)}`} />
            <Info label="Pagador" value={c.payer.name} />
            <Info label="Atleta" value={c.athlete?.user?.name ?? "—"} />
            <Info label="Início" value={date(c.startDate)} />
            <Info label="Dia de venc." value={String(c.billingDay)} />
            <Info label="Renov. automática" value={c.autoRenew ? "Sim" : "Não"} />
            <Info label="Aceite" value={c.acceptedAt ? `${c.acceptedBy} · ${date(c.acceptedAt)}` : "Pendente"} />
          </dl>

          <a
            href={`/api/trainer/contracts/${id}/document`}
            target="_blank"
            rel="noreferrer"
            className={`${uiClasses.buttonSecondary} text-center`}
          >
            Ver documento
          </a>

          {canAccept ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <span className={uiClasses.label}>Registrar aceite</span>
              <input
                className={uiClasses.input}
                placeholder="Nome de quem aceitou"
                value={acceptedBy}
                onChange={(e) => setAcceptedBy(e.target.value)}
              />
              <button type="button" className={uiClasses.button} disabled={busy || !acceptedBy.trim()} onClick={accept}>
                Aceitar e ativar
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Mudar status</span>
            <div className="flex gap-2">
              <select className={uiClasses.select} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button type="button" className={uiClasses.button} disabled={busy || newStatus === c.status} onClick={changeStatus}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}
