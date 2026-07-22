"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { clearAppCaches } from "@/app/_lib/pwa";
import { uiClasses } from "@/app/_lib/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme-toggle";

// "Mais" (§7): destinos secundários + Sair. Rotas ainda não construídas ficam
// como "em breve" (desabilitadas) para o menu ser completo sem levar a 404.
const AVAILABLE = [
  { href: "/atleta/prontidao", label: "Prontidão", hint: "Check-in diário: sono, fadiga, dor" },
  { href: "/atleta/relatorios", label: "Relatórios", hint: "Resumos do seu treinador" },
];

const SOON = ["Avaliações", "Objetivos", "Mensagens", "Biblioteca", "Compras", "Perfil", "Configurações"];

export default function AthleteMaisPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Idempotente no servidor; mesmo se falhar, sai. Limpa dados locais (§33/§35/§52).
      await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      await clearAppCaches();
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className={uiClasses.heading}>Mais</h1>
          <ThemeToggle />
        </header>

        <section className="flex flex-col gap-2">
          {AVAILABLE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-xl border border-line bg-petrol/70 p-4 transition-colors hover:border-line-strong"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{item.label}</p>
                <p className="truncate text-xs text-muted">{item.hint}</p>
              </div>
              <ChevronRightIcon className="shrink-0 text-faint" />
            </Link>
          ))}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className={uiClasses.subheading}>Em breve</h2>
          <div className="grid grid-cols-2 gap-2">
            {SOON.map((label) => (
              <div
                key={label}
                aria-disabled="true"
                className="rounded-xl border border-dashed border-line bg-petrol/30 p-3 text-sm text-faint"
              >
                {label}
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </main>
  );
}
