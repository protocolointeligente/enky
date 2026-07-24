"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { clearAppCaches } from "@/app/_lib/pwa";
import { uiClasses } from "@/app/_lib/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme-toggle";

// "Mais" (§7): destinos secundários + Sair.
const PRIMARY_LINKS = [
  {
    href: "/atleta/prontidao",
    label: "Prontidão",
    hint: "Check-in diário: sono, fadiga, motivação",
    icon: "🔋",
  },
  {
    href: "/atleta/relatorios",
    label: "Relatórios",
    hint: "Resumos do seu treinador",
    icon: "📊",
  },
  {
    href: "/atleta/avaliacoes",
    label: "Avaliações",
    hint: "Seus testes físicos e resultados",
    icon: "📋",
  },
  {
    href: "/atleta/objetivos",
    label: "Objetivos",
    hint: "Suas metas e provas-alvo",
    icon: "🎯",
  },
  {
    href: "/atleta/integracoes",
    label: "Integrações",
    hint: "Conecte Strava, Garmin e wearables",
    icon: "🔗",
  },
  {
    href: "/atleta/perfil",
    label: "Perfil",
    hint: "Dados, preferências, privacidade e segurança",
    icon: "⚙️",
  },
];

const MARKETPLACE_LINKS = [
  {
    href: "/marketplace",
    label: "Marketplace",
    hint: "Planos e consultorias de treinadores",
    icon: "🏪",
  },
  {
    href: "/marketplace/biblioteca",
    label: "Minha biblioteca",
    hint: "Conteúdos que você adquiriu",
    icon: "📚",
  },
];

const SOON = ["Mensagens"];

export default function AthleteMaisPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
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

        {/* Links principais */}
        <section className="flex flex-col gap-2">
          {PRIMARY_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-line bg-petrol p-4 transition-colors hover:border-line-strong"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-lg" aria-hidden="true">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{item.label}</p>
                <p className="truncate text-xs text-muted">{item.hint}</p>
              </div>
              <ChevronRightIcon className="shrink-0 text-faint" />
            </Link>
          ))}
        </section>

        {/* Marketplace */}
        <section className="flex flex-col gap-2">
          <h2 className={uiClasses.subheading}>Marketplace</h2>
          {MARKETPLACE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-line bg-petrol p-4 transition-colors hover:border-line-strong hover:border-orange/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-lo text-lg" aria-hidden="true">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{item.label}</p>
                <p className="truncate text-xs text-muted">{item.hint}</p>
              </div>
              <ChevronRightIcon className="shrink-0 text-faint" />
            </Link>
          ))}
        </section>

        {/* Em breve */}
        <section className="flex flex-col gap-2">
          <h2 className={uiClasses.subheading}>Em breve</h2>
          <div className="grid grid-cols-2 gap-2">
            {SOON.map((label) => (
              <div
                key={label}
                aria-disabled="true"
                className="rounded-2xl border border-dashed border-line bg-petrol/30 p-3 text-sm text-faint"
              >
                {label}
              </div>
            ))}
          </div>
        </section>

        {/* Sair */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-2xl border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-danger/40 hover:bg-danger-lo hover:text-danger disabled:opacity-50"
        >
          {loggingOut ? "Saindo..." : "Sair da conta"}
        </button>
      </div>
    </main>
  );
}
