"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { MODALITY_LABELS, modalityLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field, Overlay } from "../_components";

// Planos e serviços da assessoria (Etapa 4 §9). Cards + criar/editar + duplicar
// + ativar/desativar. "Clientes vinculados" e "receita" entram após contratos.

const BILLING_TYPE_LABELS: Record<string, string> = {
  RECURRING: "Recorrente",
  ONE_TIME: "Avulso",
  PACKAGE: "Pacote",
  FREE: "Grátis",
  CUSTOM: "Personalizado",
};
const INTERVAL_LABELS: Record<string, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizado",
};

interface Plan {
  id: string;
  name: string;
  description: string | null;
  modality: string | null;
  billingType: string;
  price: string;
  currency: string;
  billingInterval: string | null;
  durationMonths: number | null;
  trialDays: number;
  maxSessionsPerWeek: number | null;
  includedAssessments: number | null;
  includedReports: boolean;
  includedCommunication: boolean;
  includedFeatures: string[];
  isActive: boolean;
}

function formatPrice(price: string, currency: string): string {
  const n = Number(price);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}
function priceSuffix(p: Plan): string {
  if (p.billingType === "RECURRING" && p.billingInterval) {
    return ` / ${INTERVAL_LABELS[p.billingInterval]?.toLowerCase() ?? p.billingInterval}`;
  }
  return "";
}

export default function ServicePlansPage() {
  const { checked } = useRequireRole("TRAINER");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ plans: Plan[] }>("/api/trainer/service-plans")
      .then((d) => setPlans(d.plans))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  async function toggleActive(p: Plan) {
    setBusyId(p.id);
    try {
      await apiFetch(`/api/trainer/service-plans/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      load();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(p: Plan) {
    setBusyId(p.id);
    try {
      await apiFetch(`/api/trainer/service-plans/${p.id}/duplicate`, { method: "POST" });
      load();
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  }

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão · Planos e serviços</p>
            <h1 className={uiClasses.heading}>Planos e serviços</h1>
          </div>
          <button type="button" className={uiClasses.button} onClick={() => setEditing("new")}>
            Novo plano
          </button>
        </header>

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : plans.length === 0 ? (
          <p className={uiClasses.hint}>Nenhum plano ainda. Crie o primeiro serviço da assessoria.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <section
                key={p.id}
                className={`${uiClasses.card} flex flex-col gap-3 ${p.isActive ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className={uiClasses.subheading}>{p.name}</h2>
                  <span className={`${uiClasses.badge} ${p.isActive ? "bg-turq/15 text-turq" : "bg-surface text-faint"}`}>
                    {p.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="font-display text-xl font-bold text-ink">
                  {formatPrice(p.price, p.currency)}
                  <span className="text-sm font-normal text-muted">{priceSuffix(p)}</span>
                </p>
                <div className="flex flex-wrap gap-1 text-xs text-muted">
                  <span className={`${uiClasses.badge} bg-surface`}>{BILLING_TYPE_LABELS[p.billingType] ?? p.billingType}</span>
                  {p.modality ? <span className={`${uiClasses.badge} bg-surface`}>{modalityLabel(p.modality)}</span> : null}
                  {p.trialDays > 0 ? <span className={`${uiClasses.badge} bg-surface`}>{p.trialDays}d trial</span> : null}
                </div>
                {p.description ? <p className={uiClasses.hint}>{p.description}</p> : null}
                <ul className="flex flex-col gap-0.5 text-xs text-muted">
                  {p.maxSessionsPerWeek ? <li>• Até {p.maxSessionsPerWeek} sessões/semana</li> : null}
                  {p.includedAssessments != null ? <li>• {p.includedAssessments} avaliações inclusas</li> : null}
                  {p.includedReports ? <li>• Relatórios inclusos</li> : null}
                  {p.includedCommunication ? <li>• Comunicação inclusa</li> : null}
                  {p.includedFeatures.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <button type="button" className={uiClasses.buttonSecondary} onClick={() => setEditing(p)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className={uiClasses.buttonGhost}
                    disabled={busyId === p.id}
                    onClick={() => duplicate(p)}
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    className={uiClasses.buttonGhost}
                    disabled={busyId === p.id}
                    onClick={() => toggleActive(p)}
                  >
                    {p.isActive ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <PlanForm
          plan={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </main>
  );
}

interface FormValues {
  name: string;
  description: string;
  modality: string;
  billingType: string;
  price: string;
  billingInterval: string;
  durationMonths: string;
  trialDays: string;
  maxSessionsPerWeek: string;
  includedAssessments: string;
  includedReports: boolean;
  includedCommunication: boolean;
  includedFeatures: string;
}

function PlanForm({ plan, onClose, onSaved }: { plan?: Plan; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<FormValues>({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    modality: plan?.modality ?? "",
    billingType: plan?.billingType ?? "RECURRING",
    price: plan?.price ?? "0",
    billingInterval: plan?.billingInterval ?? "MONTHLY",
    durationMonths: plan?.durationMonths?.toString() ?? "",
    trialDays: plan?.trialDays?.toString() ?? "0",
    maxSessionsPerWeek: plan?.maxSessionsPerWeek?.toString() ?? "",
    includedAssessments: plan?.includedAssessments?.toString() ?? "",
    includedReports: plan?.includedReports ?? false,
    includedCommunication: plan?.includedCommunication ?? false,
    includedFeatures: (plan?.includedFeatures ?? []).join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<FormValues>) => setV((prev) => ({ ...prev, ...patch }));
  const isRecurring = v.billingType === "RECURRING";

  async function submit() {
    setBusy(true);
    setError(null);
    const body = JSON.stringify({
      name: v.name,
      description: v.description.trim() || null,
      modality: v.modality || null,
      billingType: v.billingType,
      price: Number(v.price) || 0,
      billingInterval: isRecurring ? v.billingInterval : null,
      durationMonths: v.durationMonths.trim() ? Number(v.durationMonths) : null,
      trialDays: Number(v.trialDays) || 0,
      maxSessionsPerWeek: v.maxSessionsPerWeek.trim() ? Number(v.maxSessionsPerWeek) : null,
      includedAssessments: v.includedAssessments.trim() ? Number(v.includedAssessments) : null,
      includedReports: v.includedReports,
      includedCommunication: v.includedCommunication,
      includedFeatures: v.includedFeatures
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    try {
      if (plan) {
        await apiFetch(`/api/trainer/service-plans/${plan.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/api/trainer/service-plans", { method: "POST", body });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao salvar plano.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>{plan ? "Editar plano" : "Novo plano"}</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Nome *">
          <input className={uiClasses.input} value={v.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <textarea className={uiClasses.textarea} value={v.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de cobrança">
            <select className={uiClasses.select} value={v.billingType} onChange={(e) => set({ billingType: e.target.value })}>
              {Object.entries(BILLING_TYPE_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {isRecurring ? (
            <Field label="Periodicidade">
              <select className={uiClasses.select} value={v.billingInterval} onChange={(e) => set({ billingInterval: e.target.value })}>
                {Object.entries(INTERVAL_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Modalidade">
              <select className={uiClasses.select} value={v.modality} onChange={(e) => set({ modality: e.target.value })}>
                <option value="">—</option>
                {Object.entries(MODALITY_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Preço (R$)">
            <input className={uiClasses.input} type="number" min="0" value={v.price} onChange={(e) => set({ price: e.target.value })} />
          </Field>
          <Field label="Duração (meses)">
            <input className={uiClasses.input} type="number" min="1" value={v.durationMonths} onChange={(e) => set({ durationMonths: e.target.value })} />
          </Field>
          <Field label="Trial (dias)">
            <input className={uiClasses.input} type="number" min="0" value={v.trialDays} onChange={(e) => set({ trialDays: e.target.value })} />
          </Field>
        </div>
        {isRecurring ? (
          <Field label="Modalidade">
            <select className={uiClasses.select} value={v.modality} onChange={(e) => set({ modality: e.target.value })}>
              <option value="">—</option>
              {Object.entries(MODALITY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sessões/semana">
            <input className={uiClasses.input} type="number" min="1" value={v.maxSessionsPerWeek} onChange={(e) => set({ maxSessionsPerWeek: e.target.value })} />
          </Field>
          <Field label="Avaliações inclusas">
            <input className={uiClasses.input} type="number" min="0" value={v.includedAssessments} onChange={(e) => set({ includedAssessments: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-electric" checked={v.includedReports} onChange={(e) => set({ includedReports: e.target.checked })} />
            Relatórios inclusos
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="accent-electric" checked={v.includedCommunication} onChange={(e) => set({ includedCommunication: e.target.checked })} />
            Comunicação inclusa
          </label>
        </div>
        <Field label="Outros benefícios (separados por vírgula)">
          <input className={uiClasses.input} value={v.includedFeatures} onChange={(e) => set({ includedFeatures: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={uiClasses.button} disabled={busy || !v.name.trim()} onClick={submit}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Overlay>
  );
}
