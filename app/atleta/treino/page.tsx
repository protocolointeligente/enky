"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarIcon } from "@/components/ui/icons";

// Item "Treino" da bottom nav (§7): resolve o treino relevante (hoje > próximo)
// e leva direto à execução. Sem treino, mostra estado vazio útil.
export default function AthleteTreinoPage() {
  const { checked } = useRequireRole("ATHLETE");
  const router = useRouter();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ home: { today: { id: string }[]; upcoming: { id: string }[] } }>("/api/athlete/home")
      .then(({ home }) => {
        const target = home.today[0] ?? home.upcoming[0];
        if (target) router.replace(`/atleta/treinos/${target.id}`);
        else setEmpty(true);
      })
      .catch(() => setEmpty(true));
  }, [checked, router]);

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto max-w-xl">
        {empty ? (
          <EmptyState
            title="Nenhum treino disponível"
            description="Quando seu treinador publicar um treino, ele aparecerá aqui."
            icon={<CalendarIcon width={28} height={28} />}
            action={{ label: "Ver calendário", href: "/atleta/calendario" }}
          />
        ) : (
          <p className="text-muted">Abrindo seu treino…</p>
        )}
      </div>
    </main>
  );
}
