"use client";

import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { MessageThread } from "@/components/message-thread";

export default function AthleteMessagesPage() {
  const { checked } = useRequireRole("ATHLETE");
  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        {!checked ? (
          <p className="text-muted">Carregando...</p>
        ) : (
          <MessageThread base="/api/athlete/messages" viewerRole="ATHLETE" />
        )}
      </div>
    </main>
  );
}
