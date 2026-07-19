"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field, Info, Overlay } from "../_components";

// Clientes da assessoria (Etapa 4 §8). Registro comercial — separado de atleta
// e pagador. Lista + criar/editar + drawer de detalhe. A conversão a partir de
// um lead (§7) e o vínculo com atleta/pagador (§10) entram em fatias seguintes.

const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  TRIAL: "Trial",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  INACTIVE: "Inativo",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado",
};
const STATUSES = Object.keys(STATUS_LABELS);
const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-turq/15 text-turq",
  TRIAL: "bg-electric/15 text-electric-hi",
  PAUSED: "bg-orange/15 text-orange-hi",
  CANCELLED: "bg-danger/15 text-danger",
  INACTIVE: "bg-surface text-faint",
  ARCHIVED: "bg-surface text-faint",
};

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  status: string;
}
interface ClientDetail extends ClientRow {
  birthDate: string | null;
  notes: string | null;
  sourceLead: { id: string; name: string } | null;
}

function badge(status: string) {
  return `${uiClasses.badge} ${STATUS_BADGE[status] ?? "bg-surface text-muted"}`;
}
function isoToDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function ClientsPage() {
  const { checked } = useRequireRole("TRAINER");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("ACTIVE");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setPicked(new Set());
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (q.trim()) params.set("q", q.trim());
    apiFetch<{ clients: ClientRow[] }>(`/api/trainer/clients?${params.toString()}`)
      .then((d) => setClients(d.clients))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, [filterStatus, q]);

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulk() {
    if (picked.size === 0) return;
    if (bulkStatus === "ARCHIVED" && !confirm(`Arquivar ${picked.size} cliente(s)?`)) return;
    setBulkBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/clients/bulk", {
        method: "POST",
        body: JSON.stringify({ clientIds: [...picked], status: bulkStatus }),
      });
      load();
    } catch (e) {
      setError(e);
    } finally {
      setBulkBusy(false);
    }
  }

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
            <p className={uiClasses.eyebrow}>Gestão · Clientes</p>
            <h1 className={uiClasses.heading}>Clientes</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" className={uiClasses.buttonSecondary} onClick={() => setImporting(true)}>
              Importar CSV
            </button>
            <button type="button" className={uiClasses.buttonSecondary} onClick={() => window.open("/api/trainer/export/clients", "_blank")}>
              Exportar CSV
            </button>
            <button type="button" className={uiClasses.button} onClick={() => setCreating(true)}>
              Novo cliente
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${uiClasses.input} max-w-xs`}
            placeholder="Buscar por nome, e-mail, telefone ou documento"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={uiClasses.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {picked.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-petrol/60 px-3 py-2">
            <span className="text-sm text-muted">{picked.size} selecionado(s)</span>
            <select className={uiClasses.select} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button type="button" className={uiClasses.button} disabled={bulkBusy} onClick={applyBulk}>
              Alterar status
            </button>
            <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setPicked(new Set())}>
              Limpar
            </button>
          </div>
        ) : null}

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : clients.length === 0 ? (
          <p className={uiClasses.hint}>Nenhum cliente ainda. Cadastre o primeiro.</p>
        ) : (
          <div className={`${uiClasses.panel} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-faint">
                  <th className="w-8 px-4 py-2"></th>
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Contato</th>
                  <th className="px-4 py-2 font-medium">Documento</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line/50 hover:bg-surface/40"
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-electric"
                        checked={picked.has(c.id)}
                        onChange={() => togglePick(c.id)}
                      />
                    </td>
                    <td className="cursor-pointer px-4 py-2 font-medium text-ink" onClick={() => setSelectedId(c.id)}>{c.name}</td>
                    <td className="px-4 py-2">
                      <span className={badge(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</span>
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-muted">{c.document ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating ? (
        <ClientForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}

      {importing ? (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            load();
          }}
        />
      ) : null}

      {selectedId ? (
        <ClientDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      ) : null}
    </main>
  );
}

interface ClientFormValues {
  id?: string;
  name: string;
  email: string;
  phone: string;
  document: string;
  birthDate: string;
  status: string;
  notes: string;
}

function ClientForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: ClientDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState<ClientFormValues>({
    id: initial?.id,
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    document: initial?.document ?? "",
    birthDate: isoToDateInput(initial?.birthDate ?? null),
    status: initial?.status ?? "PROSPECT",
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ClientFormValues>) => setV((prev) => ({ ...prev, ...patch }));

  async function submit() {
    setBusy(true);
    setError(null);
    const body = JSON.stringify({
      name: v.name,
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
      document: v.document.trim() || null,
      birthDate: v.birthDate || null,
      status: v.status,
      notes: v.notes.trim() || null,
    });
    try {
      if (v.id) {
        await apiFetch(`/api/trainer/clients/${v.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/api/trainer/clients", { method: "POST", body });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao salvar cliente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>{v.id ? "Editar cliente" : "Novo cliente"}</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Nome *">
          <input className={uiClasses.input} value={v.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail">
            <input className={uiClasses.input} value={v.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <input className={uiClasses.input} value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Documento (CPF/CNPJ)">
            <input className={uiClasses.input} value={v.document} onChange={(e) => set({ document: e.target.value })} />
          </Field>
          <Field label="Nascimento">
            <input
              className={uiClasses.input}
              type="date"
              value={v.birthDate}
              onChange={(e) => set({ birthDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Status">
          <select className={uiClasses.select} value={v.status} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Observações">
          <textarea className={uiClasses.textarea} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
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

function ClientDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ client: ClientDetail }>(`/api/trainer/clients/${id}`)
      .then((d) => setClient(d.client))
      .catch((e: ApiClientError) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (editing && client) {
    return (
      <ClientForm
        initial={client}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          load();
          onChanged();
        }}
      />
    );
  }

  return (
    <Overlay onClose={onClose} side>
      {!client ? (
        <p className={uiClasses.hint}>Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className={uiClasses.subheading}>{client.name}</h2>
              <p className="text-sm text-muted">
                {[client.email, client.phone].filter(Boolean).join(" · ") || "Sem contato"}
              </p>
            </div>
            <span className={badge(client.status)}>{STATUS_LABELS[client.status] ?? client.status}</span>
          </div>

          {error ? <p className={uiClasses.error}>{error}</p> : null}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Info label="Documento" value={client.document ?? "—"} />
            <Info label="Nascimento" value={client.birthDate ? isoToDateInput(client.birthDate) : "—"} />
            <Info label="Origem" value={client.sourceLead ? `Lead: ${client.sourceLead.name}` : "Cadastro direto"} />
          </dl>
          {client.notes ? <p className="text-sm text-muted">{client.notes}</p> : null}

          <button type="button" className={uiClasses.button} onClick={() => setEditing(true)}>
            Editar
          </button>
        </div>
      )}
    </Overlay>
  );
}

interface PreviewRow {
  line: number;
  data: { name: string; email: string | null; phone: string | null; document: string | null };
  error: string | null;
}
interface Preview {
  headerError: string | null;
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number };
}

// Importação CSV de clientes (§26). Preview (valida, não escreve) → confirmar →
// importa só as linhas válidas. Nunca sobrescreve.
function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function doPreview() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const p = await apiFetch<Preview>("/api/trainer/clients/import", {
        method: "POST",
        body: JSON.stringify({ csv, preview: true }),
      });
      setPreview(p);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao pré-visualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ imported: number; skipped: number }>("/api/trainer/clients/import", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      setResult(`${r.imported} importado(s), ${r.skipped} ignorado(s).`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao importar.");
    } finally {
      setBusy(false);
    }
  }

  const errorRows = preview?.rows.filter((r) => r.error) ?? [];

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Importar clientes (CSV)</h2>
      <p className={uiClasses.hint}>
        Cabeçalho esperado: <code>nome, email, telefone, documento</code> (só <code>nome</code> é obrigatório).
      </p>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      {result ? <p className={uiClasses.success}>{result}</p> : null}

      {result ? (
        <div className="flex justify-end">
          <button type="button" className={uiClasses.button} onClick={onDone}>
            Fechar
          </button>
        </div>
      ) : (
        <>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm text-muted" />
          <textarea
            className={`${uiClasses.textarea} font-mono text-xs`}
            rows={6}
            placeholder="nome,email,telefone,documento&#10;Maria,maria@x.com,11999,..."
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
            }}
          />

          {preview ? (
            preview.headerError ? (
              <p className={uiClasses.error}>{preview.headerError}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className={uiClasses.hint}>
                  {preview.summary.valid} válido(s), {preview.summary.invalid} com erro de {preview.summary.total}.
                </p>
                {errorRows.length > 0 ? (
                  <ul className="max-h-40 overflow-y-auto text-xs text-danger">
                    {errorRows.map((r) => (
                      <li key={r.line}>
                        Linha {r.line}: {r.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          ) : null}

          <div className="flex justify-end gap-2">
            <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
              Cancelar
            </button>
            {preview && !preview.headerError ? (
              <button type="button" className={uiClasses.button} disabled={busy || preview.summary.valid === 0} onClick={doImport}>
                {busy ? "Importando…" : `Importar ${preview.summary.valid}`}
              </button>
            ) : (
              <button type="button" className={uiClasses.button} disabled={busy || !csv.trim()} onClick={doPreview}>
                {busy ? "Validando…" : "Pré-visualizar"}
              </button>
            )}
          </div>
        </>
      )}
    </Overlay>
  );
}
