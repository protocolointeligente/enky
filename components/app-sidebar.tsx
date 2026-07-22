"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppNavLink } from "@/components/app-header";

// Shell com navegação persistente para a área do treinador: sidebar fixa no
// desktop (o menu deixa de viver só nos cards do painel) e topbar rolável no
// mobile. Atleta continua no AppHeader — este shell é só do treinador.
//
// A sidebar recolhe (expandida ~14rem / recolhida ~4rem) e a preferência
// persiste em localStorage. Recolher é conceito de DESKTOP; no mobile o menu
// segue como topbar rolável. Recolhida, os rótulos viram sr-only + tooltip
// nativo, mantendo o nome acessível de cada link.

const STORAGE_KEY = "enky:sidebar-collapsed";

// Ícones da navegação (20×20, stroke). Chave casa com AppNavLink.icon.
const NAV_ICONS: Record<string, React.ReactNode> = {
  painel: (
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 14h6v6H4z" />
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  atletas: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M15 8a3 3 0 1 0 0-.01M3 20a6 6 0 0 1 12 0M15 14a6 6 0 0 1 6 6" />
    </>
  ),
  periodizacao: (
    <path d="M12 3 3 8l9 5 9-5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" />
  ),
  exercicios: (
    <path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10" />
  ),
  templates: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  relatorios: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 12v4M12 9v7M16 13v3" />
    </>
  ),
  planos: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h9l6 6-9 9-8-8V7z" />
      <circle cx="7.5" cy="9.5" r="1" />
    </>
  ),
  marketplace: (
    <>
      <path d="M3 9l1-4h16l1 4M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
};

function NavIcon({ name }: { name?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {(name && NAV_ICONS[name]) ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
    </svg>
  );
}

export function AppSidebar({
  home,
  links,
  children,
}: {
  home: string;
  links: AppNavLink[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  // Render inicial determinístico (expandido) para casar com o SSR; a
  // preferência salva é aplicada após montar, evitando hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const isActive = (href: string) =>
    href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="lg:flex">
      {/* Desktop: sidebar fixa e recolhível */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-petrol/95 backdrop-blur transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[68px]" : "w-56"
        }`}
      >
        <div className={`flex items-center p-5 ${collapsed ? "justify-center px-0" : ""}`}>
          <Link href={home} aria-label="ENKY — início">
            <BrandLogo wordmark={!collapsed} />
          </Link>
        </div>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? link.label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center" : ""
                } ${active ? "bg-surface text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"}`}
              >
                <NavIcon name={link.icon} />
                <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div
          className={`flex gap-2 border-t border-line p-3 ${
            collapsed ? "flex-col items-center" : "items-center justify-between"
          }`}
        >
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            title={collapsed ? "Sair" : undefined}
            className={`flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50 ${
              collapsed ? "w-full" : ""
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={collapsed ? "" : "hidden"}
            >
              <path d="M16 17l5-5-5-5M21 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
            </svg>
            <span className={collapsed ? "sr-only" : ""}>{loggingOut ? "Saindo..." : "Sair"}</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={`flex items-center justify-center rounded-lg border border-line px-2 py-1.5 text-muted transition-colors hover:border-line-strong hover:text-ink ${
              collapsed ? "w-full" : ""
            }`}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </aside>

      {/* Conteúdo + topbar mobile (recolher é conceito de desktop) */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-petrol/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href={home} className="shrink-0" aria-label="ENKY — início">
            <BrandLogo />
          </Link>
          <nav
            aria-label="Navegação principal"
            className="flex items-center gap-1 overflow-x-auto whitespace-nowrap"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-surface text-ink"
                    : "text-muted hover:bg-surface/60 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
            >
              {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
