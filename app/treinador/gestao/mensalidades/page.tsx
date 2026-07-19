"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field, Info, Overlay } from "../_components";

// Mensalidades / faturas (Etapa 4 §12–14). Lista + gerar + drawer (pagamentos,
// registrar baixa, editar venc./desconto/juros/multa, cancelar). Inadimplência
// com faixas de atraso e indicadores entram em §15–17.

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "A vencer",
  PAID: "Paga",
  OVERDUE: "Vencida",
  PARTIALLY_PAID: "Parcial",
  CANCELLED: "Cancelada",
  REFUNDED: "Estornada",
  FAILED: "Falhou",
};
const STATUSES = Object.keys(STATUS_LABELS);
const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-turq/15 text-turq",
  PARTIALLY_PAID: "bg-electric/15 text-electric-hi",
  OVERDUE: "bg-danger/15 text-danger",
  PENDING: "bg-surface text-muted",
  CANCELLED: "bg-surface text-faint",
};
const METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BANK_SLIP: "Boleto",
  TRANSFER: "Transferência",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

interface Named {
  id: string;
  name: string;
}
interface InvoiceRow {
  id: string;
  referencePeriod: string;
  dueDate: string;
  finalAmount: string;
  currency: string;
  status: string;
  client: Named;
}
interface Payment {
  id: string;
  amount: string;
  paidAt: string;
  method: string;
  notes: string | null;
}
interface InvoiceDetail extends InvoiceRow {
  amount: string;
  discount: string;
  interest: string;
  penalty: string;
  notes: string | null;
  payer: Named;
  contract: { id: string; servicePlan: { name: string } };
  payments: Payment[];
}

function money(v: string, currency = "BRL"): string {
  const n = Number(v);
  return Number.isNaN(n) ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}
function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function statusBadge(s: string) {
  return `${uiClasses.badge} ${STATUS_BADGE[s] ?? "bg-surface text-muted"}`;
}

export default function InvoicesPage() {
  const { checked } = useRequireRole("TRAINER");
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    apiFetch<{ invoices: InvoiceRow[] }>(`/api/trainer/invoices?${params.toString()}`)
      .then((d) => setInvoices(d.invoices))
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
            <p className={uiClasses.eyebrow}>Gestão · Mensalidades</p>
            <h1 className={uiClasses.heading}>Mensalidades</h1>
          </div>
          <button type="button" className={uiClasses.button} onClick={() => setGenerating(true)}>
            Gerar mensalidades
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
        ) : invoices.length === 0 ? (
          <p className={uiClasses.hint}>Nenhuma mensalidade. Gere a partir de um contrato ativo.</p>
        ) : (
          <div className={`${uiClasses.panel} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-faint">
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Competência</th>
                  <th className="px-4 py-2 font-medium">Vencimento</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedId(inv.id)}
                    className="cursor-pointer border-b border-line/50 hover:bg-surface/40"
                  >
                    <td className="px-4 py-2 font-medium text-ink">{inv.client.name}</td>
                    <td className="px-4 py-2 text-muted">{inv.referencePeriod}</td>
                    <td className="px-4 py-2 text-muted">{date(inv.dueDate)}</td>
                    <td className="px-4 py-2 text-muted">{money(inv.finalAmount, inv.currency)}</td>
                    <td className="px-4 py-2">
                      <span className={statusBadge(inv.status)}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {generating ? (
        <GenerateModal
          onClose={() => setGenerating(false)}
          onDone={() => {
            setGenerating(false);
            load();
          }}
        />
      ) : null}

      {selectedId ? (
        <InvoiceDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      ) : null}
    </main>
  );
}

interface ContractOption {
  id: string;
  client: Named;
  servicePlan: Named;
}

function GenerateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [contractId, setContractId] = useState("");
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ contracts: ContractOption[] }>("/api/trainer/contracts?status=ACTIVE&take=100")
      .then((d) => setContracts(d.contracts))
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiFetch<{ created: number; skipped?: string }>("/api/trainer/invoices/generate", {
        method: "POST",
        body: JSON.stringify({ contractId, fromDate, toDate }),
      });
      if (r.skipped) setError(r.skipped);
      else setResult(`${r.created} mensalidade(s) gerada(s).`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao gerar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Gerar mensalidades</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      {result ? <p className={uiClasses.success}>{result}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Contrato ativo *">
          <select className={uiClasses.select} value={contractId} onChange={(e) => setContractId(e.target.value)}>
            <option value="">Selecione…</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.client.name} · {c.servicePlan.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De">
            <input className={uiClasses.input} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="Até">
            <input className={uiClasses.input} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
        </div>
        <p className={uiClasses.hint}>Gerar de novo o mesmo período não duplica — só cria o que faltar.</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={result ? onDone : onClose}>
          {result ? "Fechar" : "Cancelar"}
        </button>
        <button type="button" className={uiClasses.button} disabled={busy || !contractId} onClick={submit}>
          {busy ? "Gerando…" : "Gerar"}
        </button>
      </div>
    </Overlay>
  );
}

function InvoiceDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("PIX");
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ invoice: InvoiceDetail }>(`/api/trainer/invoices/${id}`)
      .then((d) => setInv(d.invoice))
      .catch((e: ApiClientError) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const paid = inv ? inv.payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
  const remaining = inv ? Math.max(0, Number(inv.finalAmount) - paid) : 0;

  async function pay() {
    const amount = payAmount.trim() ? Number(payAmount) : remaining;
    if (!amount || amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/invoices/${id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount, method: payMethod }),
      });
      setPayAmount("");
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao registrar pagamento.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/invoices/${id}/cancel`, { method: "POST" });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  if (editing && inv) {
    return <InvoiceEditForm invoice={inv} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged(); }} />;
  }

  const canPay = inv && inv.status !== "PAID" && inv.status !== "CANCELLED";

  return (
    <Overlay onClose={onClose} side>
      {!inv ? (
        <p className={uiClasses.hint}>Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className={uiClasses.subheading}>{inv.client.name}</h2>
              <p className="text-sm text-muted">
                {inv.contract.servicePlan.name} · {inv.referencePeriod}
              </p>
            </div>
            <span className={statusBadge(inv.status)}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
          </div>

          {error ? <p className={uiClasses.error}>{error}</p> : null}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Valor final" value={money(inv.finalAmount, inv.currency)} />
            <Info label="Vencimento" value={date(inv.dueDate)} />
            <Info label="Base / desconto" value={`${money(inv.amount, inv.currency)} / ${money(inv.discount, inv.currency)}`} />
            <Info label="Juros / multa" value={`${money(inv.interest, inv.currency)} / ${money(inv.penalty, inv.currency)}`} />
            <Info label="Pago" value={money(String(paid), inv.currency)} />
            <Info label="Restante" value={money(String(remaining), inv.currency)} />
          </dl>

          {canPay ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <span className={uiClasses.label}>Registrar pagamento</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={uiClasses.input}
                  type="number"
                  min="0"
                  placeholder={`Restante: ${remaining.toFixed(2)}`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <select className={uiClasses.select} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  {Object.entries(METHOD_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className={uiClasses.button} disabled={busy} onClick={pay}>
                {payAmount.trim() ? "Registrar" : "Marcar como paga (restante)"}
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Pagamentos</span>
            {inv.payments.length === 0 ? (
              <p className={uiClasses.hint}>Nenhum pagamento.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex justify-between text-muted">
                    <span>
                      {money(p.amount, inv.currency)} · {METHOD_LABELS[p.method] ?? p.method}
                    </span>
                    <span className="text-faint">{date(p.paidAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2 border-t border-line pt-3">
            <button type="button" className={uiClasses.buttonSecondary} disabled={inv.status === "CANCELLED"} onClick={() => setEditing(true)}>
              Editar
            </button>
            <button type="button" className={uiClasses.buttonDanger} disabled={busy || inv.status === "CANCELLED"} onClick={cancel}>
              Cancelar fatura
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function InvoiceEditForm({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: InvoiceDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [dueDate, setDueDate] = useState(invoice.dueDate.slice(0, 10));
  const [discount, setDiscount] = useState(invoice.discount);
  const [interest, setInterest] = useState(invoice.interest);
  const [penalty, setPenalty] = useState(invoice.penalty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/invoices/${invoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          dueDate,
          discount: Number(discount) || 0,
          interest: Number(interest) || 0,
          penalty: Number(penalty) || 0,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Editar fatura</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Vencimento">
          <input className={uiClasses.input} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Desconto (R$)">
            <input className={uiClasses.input} type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Juros (R$)">
            <input className={uiClasses.input} type="number" min="0" value={interest} onChange={(e) => setInterest(e.target.value)} />
          </Field>
          <Field label="Multa (R$)">
            <input className={uiClasses.input} type="number" min="0" value={penalty} onChange={(e) => setPenalty(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={uiClasses.button} disabled={busy} onClick={submit}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Overlay>
  );
}
