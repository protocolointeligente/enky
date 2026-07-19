"use client";

import Link from "next/link";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";

// Configurações do treinador. Nesta fatia (Etapa 4 §2) hospeda apenas a
// Assinatura ENKY — a relação comercial ENKY ↔ treinador que saiu da navegação
// operacional. "Configurações da assessoria" (dados da org, papéis, políticas)
// entra numa fatia posterior, sob Gestão.
export default function TrainerSettingsPage() {
  const { checked } = useRequireRole("TRAINER");
  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <header className="flex flex-col gap-1">
          <p className={uiClasses.eyebrow}>Configurações</p>
          <h1 className={uiClasses.heading}>Configurações</h1>
          <p className={uiClasses.hint}>Sua conta e sua assinatura no ENKY.</p>
        </header>

        <Link
          href="/treinador/assinatura"
          className={`${uiClasses.card} flex items-start justify-between gap-4 transition-colors hover:border-line-strong`}
        >
          <div className="flex flex-col gap-1">
            <h2 className={uiClasses.subheading}>Assinatura ENKY</h2>
            <p className={uiClasses.hint}>Seu plano, faturas e limites de uso na plataforma.</p>
          </div>
          <span aria-hidden="true" className="mt-1 text-muted">
            →
          </span>
        </Link>
      </div>
    </main>
  );
}
