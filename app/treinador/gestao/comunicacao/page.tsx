"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field } from "../_components";

// Comunicação interna (Etapa 4 §22). Registrar uma comunicação + histórico
// recente. Disparo real de e-mail avulso é fatia futura (só registro por ora).

const TYPE_LABELS: Record<string, string> = { CLIENT: "Cliente", LEAD: "Lead", ATHLETE: "Atleta" };
const CHANNEL_LABELS: Record<string, string> = { EMAIL: "E-mail", IN_APP: "No app", MANUAL: "Manual" };

interface Named {
  id: string;
  name: string;
}
interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
}
interface CommRow {
  id: string;
  recipientType: string;
  channel: string;
  subject: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  createdBy: { name: string } | null;
}

export default function CommunicationPage() {
  const { checked } = useRequireRole("TRAINER");
  const [comms, setComms] = useState<CommRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ communications: CommRow[] }>("/api/trainer/communications")
      .then((d) => setComms(d.communications))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão · Comunicação</p>
            <h1 className={uiClasses.heading}>Comunicação</h1>
          </div>
          <button type="button" className={uiClasses.button} onClick={() => setComposing(true)}>
            Registrar comunicação
          </button>
        </header>
        <p className={uiClasses.hint}>
          Registro interno de contatos. O disparo automático de e-mail para mensagens avulsas entra
          em uma próxima etapa.
        </p>

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : comms.length === 0 ? (
          <p className={uiClasses.hint}>Nenhuma comunicação registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {comms.map((c) => (
              <li key={c.id} className={`${uiClasses.card} flex flex-col gap-1`}>
                <div className="flex items-center justify-between gap-2 text-xs text-faint">
                  <span>
                    {TYPE_LABELS[c.recipientType] ?? c.recipientType} · {CHANNEL_LABELS[c.channel] ?? c.channel}
                  </span>
                  <span>
                    {new Date(c.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {c.createdBy ? ` · ${c.createdBy.name}` : ""}
                  </span>
                </div>
                {c.subject ? <span className="font-medium text-ink">{c.subject}</span> : null}
                {c.body ? <p className="text-sm text-muted">{c.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {composing ? (
        <ComposeModal
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            load();
          }}
        />
      ) : null}
    </main>
  );
}

function ComposeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [recipientType, setRecipientType] = useState("CLIENT");
  const [recipientId, setRecipientId] = useState("");
  const [channel, setChannel] = useState("MANUAL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [clients, setClients] = useState<Named[]>([]);
  const [leads, setLeads] = useState<Named[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ clients: Named[] }>("/api/trainer/clients?take=100").then((d) => setClients(d.clients)).catch(() => {});
    apiFetch<{ leads: Named[] }>("/api/trainer/leads?take=100").then((d) => setLeads(d.leads)).catch(() => {});
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster").then((d) => setRoster(d.athletes)).catch(() => {});
  }, []);

  const options =
    recipientType === "CLIENT"
      ? clients.map((c) => ({ id: c.id, name: c.name }))
      : recipientType === "LEAD"
        ? leads.map((l) => ({ id: l.id, name: l.name }))
        : roster.map((a) => ({ id: a.athleteProfileId, name: a.name ?? "Atleta" }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/communications", {
        method: "POST",
        body: JSON.stringify({
          recipientType,
          recipientId,
          channel,
          subject: subject.trim() || null,
          body: body.trim() || null,
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${uiClasses.panel} flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto bg-petrol p-5`}
      >
        <h2 className={uiClasses.subheading}>Registrar comunicação</h2>
        {error ? <p className={uiClasses.error}>{error}</p> : null}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Destinatário">
              <select
                className={uiClasses.select}
                value={recipientType}
                onChange={(e) => {
                  setRecipientType(e.target.value);
                  setRecipientId("");
                }}
              >
                {Object.entries(TYPE_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Canal">
              <select className={uiClasses.select} value={channel} onChange={(e) => setChannel(e.target.value)}>
                {Object.entries(CHANNEL_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Quem">
            <select className={uiClasses.select} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="">Selecione…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assunto">
            <input className={uiClasses.input} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Mensagem / anotação">
            <textarea className={uiClasses.textarea} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={uiClasses.button} disabled={busy || !recipientId} onClick={submit}>
            {busy ? "Salvando…" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
