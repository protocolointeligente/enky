"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

interface Message {
  id: string;
  senderRole: "ATHLETE" | "TRAINER";
  body: string;
  readAt: string | null;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
}
interface Conversation {
  id: string;
  counterpartName: string;
}

// Fio de conversa reutilizável (atleta e treinador). Assíncrono: sem WebSocket,
// com poll leve (15s). Envio otimista com rollback confiável. `base` é a rota da
// conversa (GET lista+marca lido / POST envia / POST base/archive arquiva).
export function MessageThread({
  base,
  viewerRole,
}: {
  base: string;
  viewerRole: "ATHLETE" | "TRAINER";
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (opts?: { before?: string; silent?: boolean }) => {
      try {
        const qs = opts?.before ? `?before=${encodeURIComponent(opts.before)}` : "";
        const data = await apiFetch<{ conversation: Conversation; messages: Message[]; hasMore: boolean }>(
          `${base}${qs}`,
        );
        setConversation(data.conversation);
        setHasMore(data.hasMore);
        if (opts?.before) {
          setMessages((cur) => [...data.messages, ...cur]);
        } else {
          // Preserva mensagens otimistas ainda pendentes (não confirmadas no server).
          setMessages((cur) => {
            const pending = cur.filter((m) => m.pending);
            return [...data.messages, ...pending];
          });
        }
      } catch (e) {
        if (!opts?.silent) setError(e instanceof ApiClientError ? e.message : "Erro ao carregar.");
      } finally {
        setLoading(false);
      }
    },
    [base],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load({ silent: true }), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const tempId = `temp-${messages.length}-${body.length}`;
    const optimistic: Message = {
      id: tempId,
      senderRole: viewerRole,
      body,
      readAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((cur) => [...cur, optimistic]);
    setDraft("");
    try {
      const { message } = await apiFetch<{ message: Message }>(base, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      // Substitui a otimista pela confirmada.
      setMessages((cur) => cur.map((m) => (m.id === tempId ? message : m)));
    } catch (e) {
      // Rollback: remove a otimista, restaura o rascunho, sinaliza erro.
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      setDraft(body);
      setError(e instanceof ApiClientError ? e.message : "Falha ao enviar. Tente de novo.");
    } finally {
      setSending(false);
    }
  }

  async function archive() {
    if (!confirm("Arquivar esta conversa? Ela some da sua lista, mas nada é apagado.")) return;
    try {
      await apiFetch(`${base}/archive`, { method: "POST" });
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao arquivar.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h1 className={uiClasses.heading}>{conversation?.counterpartName ?? "Conversa"}</h1>
        <button type="button" className={uiClasses.buttonGhost} onClick={archive}>
          Arquivar
        </button>
      </header>

      {error && <p className={uiClasses.error}>{error}</p>}

      <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-petrol/50 p-3">
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            Nenhuma mensagem ainda. Diga olá para começar a conversa.
          </p>
        ) : (
          <>
            {hasMore && messages[0] && (
              <button
                type="button"
                className="mx-auto text-xs text-muted underline"
                onClick={() => load({ before: messages[0]!.createdAt })}
              >
                Carregar mais antigas
              </button>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} message={m} mine={m.senderRole === viewerRole} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          className={uiClasses.textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem..."
          rows={2}
          maxLength={4000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
        />
        <button type="button" className={uiClasses.button} onClick={send} disabled={sending || !draft.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          mine ? "bg-surface text-ink" : "border border-line bg-petrol/70 text-ink"
        } ${message.pending ? "opacity-60" : ""}`}
      >
        {/* Renderizado como TEXTO (React escapa) — nunca dangerouslySetInnerHTML. */}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className="mt-1 text-right text-[10px] text-faint">
          {message.pending ? "enviando..." : time}
          {mine && !message.pending ? (message.readAt ? " · lido" : " · enviado") : ""}
        </p>
      </div>
    </div>
  );
}
