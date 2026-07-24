"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageThread } from "@/components/message-thread";

interface Conversation {
  id: string;
  athleteProfileId?: string;
  counterpartName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unread: number;
}

export default function TrainerMessagesPage() {
  const { checked } = useRequireRole("TRAINER");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAthlete, setOpenAthlete] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ conversations: Conversation[] }>("/api/trainer/messages")
      .then((r) => setConversations(r.conversations))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  if (openAthlete) {
    return (
      <main className={uiClasses.page}>
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <button type="button" className={uiClasses.buttonGhost} onClick={() => setOpenAthlete(null)}>
            ← Conversas
          </button>
          <MessageThread base={`/api/trainer/athletes/${openAthlete}/messages`} viewerRole="TRAINER" />
        </div>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Comunicação</span>
          <h1 className={uiClasses.heading}>Mensagens</h1>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : conversations.length === 0 ? (
          <EmptyState
            title="Nenhuma conversa ainda"
            description="Abra o perfil de um atleta e envie uma mensagem para iniciar a conversa."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => c.athleteProfileId && setOpenAthlete(c.athleteProfileId)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-petrol/70 p-3 text-left transition-colors hover:border-line-strong"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{c.counterpartName}</p>
                    {c.lastMessagePreview && (
                      <p className="truncate text-xs text-muted">{c.lastMessagePreview}</p>
                    )}
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-orange px-2 py-0.5 text-[11px] font-semibold text-onbrand">
                      {c.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
