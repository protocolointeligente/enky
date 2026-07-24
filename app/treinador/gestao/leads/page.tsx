"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field, Info, Overlay } from "../_components";

// CRM de leads (Etapa 4 §5–6 / §36). Lista + Kanban + filtros + busca + criar +
// drawer de detalhe (interações e mudança de etapa). Edição inline dos campos e
// drag-and-drop no Kanban ficam como refinamento — a mudança de etapa já é feita
// pelo drawer, que é o caminho auditável (gera STATUS_CHANGE no servidor).

const STATUS_LABELS: Record<string, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  TRIAL: "Trial",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  WON: "Ganho",
  LOST: "Perdido",
  ARCHIVED: "Arquivado",
};
// Colunas do funil (ordem). ARCHIVED fica fora do Kanban — só via filtro.
const PIPELINE: string[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "TRIAL",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
];
const ALL_STATUSES = [...PIPELINE, "ARCHIVED"];

const SOURCE_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Indicação",
  WEBSITE: "Site",
  EVENT: "Evento",
  ORGANIC: "Orgânico",
  PAID_MEDIA: "Mídia paga",
  OTHER: "Outro",
};
const MODALITY_LABELS: Record<string, string> = {
  RUNNING: "Corrida",
  STRENGTH: "Força",
  FUNCTIONAL: "Funcional",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
};
const INTERACTION_TYPE_LABELS: Record<string, string> = {
  NOTE: "Anotação",
  CALL: "Ligação",
  MESSAGE: "Mensagem",
  EMAIL: "E-mail",
  MEETING: "Reunião",
  TRIAL_STARTED: "Trial iniciado",
  PROPOSAL_SENT: "Proposta enviada",
  FOLLOW_UP: "Follow-up",
  STATUS_CHANGE: "Mudança de etapa",
};
const CHANNEL_LABELS: Record<string, string> = {
  PHONE: "Telefone",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  INSTAGRAM: "Instagram",
  IN_PERSON: "Presencial",
  SYSTEM: "Sistema",
  OTHER: "Outro",
};

const STATUS_BADGE: Record<string, string> = {
  WON: "bg-turq/15 text-turq",
  LOST: "bg-danger/15 text-danger",
  NEGOTIATION: "bg-electric/15 text-electric-hi",
  PROPOSAL: "bg-electric/15 text-electric-hi",
  ARCHIVED: "bg-surface text-faint",
};

interface Assignee {
  id: string;
  name: string;
}
interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  interestedModality: string | null;
  status: string;
  estimatedValue: string | null;
  nextActionAt: string | null;
  assignedTo: Assignee | null;
}
interface Interaction {
  id: string;
  type: string;
  channel: string;
  summary: string;
  occurredAt: string;
}
interface LeadDetail extends LeadRow {
  notes: string | null;
  convertedAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  interactions: Interaction[];
}

function formatValue(v: string | null): string {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function LeadsPage() {
  const { checked } = useRequireRole("TRAINER");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterSource) params.set("source", filterSource);
    if (q.trim()) params.set("q", q.trim());
    apiFetch<{ leads: LeadRow[] }>(`/api/trainer/leads?${params.toString()}`)
      .then((d) => setLeads(d.leads))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, [filterStatus, filterSource, q]);

  // Debounce leve na busca; filtros aplicam na hora.
  useEffect(() => {
    if (!checked) return;
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [checked, load, q]);

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão · Leads</p>
            <h1 className={uiClasses.heading}>Funil de leads</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" className={uiClasses.buttonSecondary} onClick={() => window.open("/api/trainer/export/leads", "_blank")}>
              Exportar CSV
            </button>
            <button type="button" className={uiClasses.button} onClick={() => setCreating(true)}>
              Novo lead
            </button>
          </div>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${uiClasses.input} max-w-xs`}
            placeholder="Buscar por nome, e-mail ou telefone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={uiClasses.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todas as etapas</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className={uiClasses.select}
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            <option value="">Todas as origens</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="ml-auto flex overflow-hidden rounded-lg border border-line">
            {(["list", "kanban"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  view === v ? "bg-surface text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {v === "list" ? "Lista" : "Kanban"}
              </button>
            ))}
          </div>
        </div>

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : leads.length === 0 ? (
          <p className={uiClasses.hint}>Nenhum lead ainda. Comece cadastrando o primeiro.</p>
        ) : view === "list" ? (
          <LeadTable leads={leads} onOpen={setSelectedId} />
        ) : (
          <LeadKanban leads={leads} onOpen={setSelectedId} />
        )}
      </div>

      {creating ? (
        <LeadCreateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}

      {selectedId ? (
        <LeadDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      ) : null}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${uiClasses.badge} ${STATUS_BADGE[status] ?? "bg-surface text-muted"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function LeadTable({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  return (
    <div className={`${uiClasses.panel} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-faint">
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">Etapa</th>
            <th className="px-4 py-2 font-medium">Origem</th>
            <th className="px-4 py-2 font-medium">Responsável</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Próx. ação</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onOpen(l.id)}
              className="cursor-pointer border-b border-line/50 hover:bg-surface/40"
            >
              <td className="px-4 py-2">
                <span className="font-medium text-ink">{l.name}</span>
                {l.email ? <span className="block text-xs text-faint">{l.email}</span> : null}
              </td>
              <td className="px-4 py-2">
                <StatusBadge status={l.status} />
              </td>
              <td className="px-4 py-2 text-muted">{SOURCE_LABELS[l.source] ?? l.source}</td>
              <td className="px-4 py-2 text-muted">{l.assignedTo?.name ?? "—"}</td>
              <td className="px-4 py-2 text-muted">{formatValue(l.estimatedValue)}</td>
              <td className="px-4 py-2 text-muted">{formatDate(l.nextActionAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadKanban({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PIPELINE.map((status) => {
        const cards = leads.filter((l) => l.status === status);
        return (
          <div key={status} className="flex w-64 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-faint">
                {STATUS_LABELS[status]}
              </span>
              <span className="text-xs text-faint">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onOpen(l.id)}
                  className={`${uiClasses.card} flex flex-col gap-1 p-3 text-left transition-colors hover:border-line-strong`}
                >
                  <span className="font-medium text-ink">{l.name}</span>
                  <span className="text-xs text-faint">{SOURCE_LABELS[l.source] ?? l.source}</span>
                  {l.estimatedValue ? (
                    <span className="text-xs text-muted">{formatValue(l.estimatedValue)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("OTHER");
  const [modality, setModality] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/leads", {
        method: "POST",
        body: JSON.stringify({
          name,
          email: email.trim() || null,
          phone: phone.trim() || null,
          source,
          interestedModality: modality || null,
          estimatedValue: value.trim() ? Number(value) : null,
          notes: notes.trim() || null,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao criar lead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Novo lead</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Nome *">
          <input className={uiClasses.input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail">
            <input className={uiClasses.input} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input className={uiClasses.input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Origem">
            <select className={uiClasses.select} value={source} onChange={(e) => setSource(e.target.value)}>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modalidade de interesse">
            <select className={uiClasses.select} value={modality} onChange={(e) => setModality(e.target.value)}>
              <option value="">—</option>
              {Object.entries(MODALITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Valor estimado (R$)">
          <input
            className={uiClasses.input}
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
        <Field label="Observações">
          <textarea className={uiClasses.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={uiClasses.button} disabled={busy || !name.trim()} onClick={submit}>
          {busy ? "Salvando…" : "Criar lead"}
        </button>
      </div>
    </Overlay>
  );
}

function LeadDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Formulário de interação.
  const [itype, setItype] = useState("NOTE");
  const [ichannel, setIchannel] = useState("SYSTEM");
  const [isummary, setIsummary] = useState("");
  // Mudança de etapa.
  const [newStatus, setNewStatus] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [converting, setConverting] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ lead: LeadDetail }>(`/api/trainer/leads/${id}`)
      .then((d) => {
        setLead(d.lead);
        setNewStatus(d.lead.status);
      })
      .catch((e: ApiClientError) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus() {
    if (!lead || newStatus === lead.status) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/leads/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, lostReason: lostReason.trim() || null }),
      });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao mudar etapa.");
    } finally {
      setBusy(false);
    }
  }

  async function addInteraction() {
    if (!isummary.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/leads/${id}/interactions`, {
        method: "POST",
        body: JSON.stringify({ type: itype, channel: ichannel, summary: isummary.trim() }),
      });
      setIsummary("");
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao registrar interação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} side>
      {!lead ? (
        <p className={uiClasses.hint}>Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className={uiClasses.subheading}>{lead.name}</h2>
              <p className="text-sm text-muted">
                {[lead.email, lead.phone].filter(Boolean).join(" · ") || "Sem contato"}
              </p>
            </div>
            <StatusBadge status={lead.status} />
          </div>

          {error ? <p className={uiClasses.error}>{error}</p> : null}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Origem" value={SOURCE_LABELS[lead.source] ?? lead.source} />
            <Info
              label="Modalidade"
              value={lead.interestedModality ? (MODALITY_LABELS[lead.interestedModality] ?? lead.interestedModality) : "—"}
            />
            <Info label="Responsável" value={lead.assignedTo?.name ?? "—"} />
            <Info label="Valor estimado" value={formatValue(lead.estimatedValue)} />
            <Info label="Próxima ação" value={formatDate(lead.nextActionAt)} />
          </dl>
          {lead.notes ? <p className="text-sm text-muted">{lead.notes}</p> : null}

          {lead.status !== "WON" && lead.status !== "ARCHIVED" ? (
            <button type="button" className={uiClasses.button} onClick={() => setConverting(true)}>
              Converter em cliente
            </button>
          ) : null}

          {converting ? (
            <ConvertLeadModal
              leadId={id}
              onClose={() => setConverting(false)}
              onConverted={() => {
                setConverting(false);
                load();
                onChanged();
              }}
            />
          ) : null}

          {/* Mudança de etapa */}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Mudar etapa</span>
            <div className="flex gap-2">
              <select className={uiClasses.select} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={uiClasses.button}
                disabled={busy || newStatus === lead.status}
                onClick={changeStatus}
              >
                Aplicar
              </button>
            </div>
            {newStatus === "LOST" ? (
              <input
                className={uiClasses.input}
                placeholder="Motivo da perda"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
            ) : null}
          </div>

          {/* Nova interação */}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Registrar interação</span>
            <div className="grid grid-cols-2 gap-2">
              <select className={uiClasses.select} value={itype} onChange={(e) => setItype(e.target.value)}>
                {Object.entries(INTERACTION_TYPE_LABELS)
                  .filter(([k]) => k !== "STATUS_CHANGE")
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
              <select className={uiClasses.select} value={ichannel} onChange={(e) => setIchannel(e.target.value)}>
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className={uiClasses.textarea}
              placeholder="Resumo da interação"
              value={isummary}
              onChange={(e) => setIsummary(e.target.value)}
            />
            <button type="button" className={uiClasses.buttonSecondary} disabled={busy || !isummary.trim()} onClick={addInteraction}>
              Adicionar
            </button>
          </div>

          {/* Histórico */}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Histórico</span>
            {lead.interactions.length === 0 ? (
              <p className={uiClasses.hint}>Sem interações registradas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lead.interactions.map((i) => (
                  <li key={i.id} className="rounded-lg border border-line/60 p-2 text-sm">
                    <div className="flex items-center justify-between gap-2 text-xs text-faint">
                      <span>
                        {INTERACTION_TYPE_LABELS[i.type] ?? i.type} · {CHANNEL_LABELS[i.channel] ?? i.channel}
                      </span>
                      <span>{formatDateTime(i.occurredAt)}</span>
                    </div>
                    <p className="text-muted">{i.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}


interface PlanOpt {
  id: string;
  name: string;
  price: string;
}

// Conversão lead → cliente (§7). Escolhe o plano, condições e (opcional) cria o
// atleta com convite ao portal + a 1ª mensalidade.
function ConvertLeadModal({
  leadId,
  onClose,
  onConverted,
}: {
  leadId: string;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [servicePlanId, setServicePlanId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [billingDay, setBillingDay] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [withAthlete, setWithAthlete] = useState(false);
  const [athleteEmail, setAthleteEmail] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [firstInvoice, setFirstInvoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ plans: PlanOpt[] }>("/api/trainer/service-plans?activeOnly=true")
      .then((d) => setPlans(d.plans))
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ alreadyConverted: boolean; invoiceCreated: boolean }>(
        `/api/trainer/leads/${leadId}/convert`,
        {
          method: "POST",
          body: JSON.stringify({
            servicePlanId,
            startDate,
            billingDay: Number(billingDay) || 1,
            discount: Number(discount) || 0,
            athleteEmail: withAthlete && athleteEmail.trim() ? athleteEmail.trim() : null,
            athleteName: withAthlete && athleteName.trim() ? athleteName.trim() : null,
            generateFirstInvoice: firstInvoice,
          }),
        },
      );
      setDone(r.alreadyConverted ? "Este lead já havia sido convertido." : "Lead convertido em cliente.");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao converter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Converter em cliente</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      {done ? <p className={uiClasses.success}>{done}</p> : null}
      {done ? (
        <div className="flex justify-end">
          <button type="button" className={uiClasses.button} onClick={onConverted}>
            Fechar
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <Field label="Plano *">
              <select className={uiClasses.select} value={servicePlanId} onChange={(e) => setServicePlanId(e.target.value)}>
                <option value="">Selecione…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Início">
                <input className={uiClasses.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Dia venc.">
                <input className={uiClasses.input} type="number" min="1" max="31" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
              </Field>
              <Field label="Desconto">
                <input className={uiClasses.input} type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="accent-electric" checked={firstInvoice} onChange={(e) => setFirstInvoice(e.target.checked)} />
              Gerar a primeira mensalidade
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" className="accent-electric" checked={withAthlete} onChange={(e) => setWithAthlete(e.target.checked)} />
              Criar atleta e enviar convite ao portal
            </label>
            {withAthlete ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="E-mail do atleta">
                  <input className={uiClasses.input} value={athleteEmail} onChange={(e) => setAthleteEmail(e.target.value)} />
                </Field>
                <Field label="Nome do atleta">
                  <input className={uiClasses.input} value={athleteName} onChange={(e) => setAthleteName(e.target.value)} />
                </Field>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className={uiClasses.button}
              disabled={busy || !servicePlanId || (withAthlete && !athleteEmail.trim())}
              onClick={submit}
            >
              {busy ? "Convertendo…" : "Converter"}
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}
