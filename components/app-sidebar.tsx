"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrainerBottomNav } from "@/components/nav/trainer-bottom-nav";
import { isNavActive } from "@/components/nav/nav-config";
import type { AppNavLink } from "@/components/app-header";

// Shell de navegação da área do treinador.
//
// Desktop (≥md): sidebar fixa, recolhível (preferência em localStorage).
// Tablet (md–lg): sidebar recolhida por padrão (só ícones).
// Mobile (<md): topbar mínima (logo + ThemeToggle) + TrainerBottomNav.
//
// Link ativo: borda-left laranja + fundo surface-2 (identidade Command Center).
// Sidebar expandida = 220px | recolhida = 68px.

const STORAGE_KEY = "enky:sidebar-collapsed";

// ── Ícones inline ────────────────────────────────────────────────────────────
const NAV_ICONS: Record<string, React.ReactNode> = {
  painel: <path d="M3 3h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 13h8v8H3z" />,
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  atletas: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M15 7a3 3 0 1 0 0-.01M3 20a6 6 0 0 1 12 0M15 14a6 6 0 0 1 6 6" />
    </>
  ),
  novidades: <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H13L13 2Z" />,
  periodizacao: <path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  exercicios: <path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10" />,
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
  gestao: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
    </>
  ),
  mensagens: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  configuracoes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
    </>
  ),
  marketplace: (
    <>
      <path d="M3 9l1-4h16l1 4M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  treinos: <path d="M7 4.5v15l12-7.5-12-7.5Z" />,
};

function NavIcon({ name }: { name?: string }) {
  return (
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
      className="shrink-0"
    >
      {(name && NAV_ICONS[name]) ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
    </svg>
  );
}

function LogoutIconSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 17l5-5-5-5M21 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function AppSidebar({
  home,
  links,
  children,
  userName,
}: {
  home: string;
  links: AppNavLink[];
  children: React.ReactNode;
  userName?: string;
}) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  // Tablet (md–lg) começa recolhido; desktop (≥lg) respeita preferência
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === "1");
    } else {
      // Padrão: recolhido em tablet, expandido em desktop
      setCollapsed(window.innerWidth < 1280);
    }
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
      const { apiFetch } = await import("@/app/_lib/api-client");
      const { clearAppCaches } = await import("@/app/_lib/pwa");
      const { useRouter } = await import("next/navigation");
      await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      await clearAppCaches();
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  }

  const isActive = (href: string) => isNavActive(href, home, pathname);

  const initials = userName
    ? userName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "U";

  return (
    <div className="md:flex">
      {/* ── Desktop / Tablet: sidebar fixa e recolhível (≥md) ── */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-petrol transition-[width] duration-200 ease-in-out md:flex ${
          collapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center border-b border-line px-4 py-4 ${collapsed ? "justify-center px-0" : ""}`}>
          <Link href={home} aria-label="ENKY — início">
            <BrandLogo wordmark={!collapsed} />
          </Link>
        </div>

        {/* Nav links */}
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? link.label : undefined}
                className={`flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-2" : "px-3"
                } ${
                  active
                    ? "sidebar-link-active bg-surface-2 text-ink"
                    : "sidebar-link-idle text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                <NavIcon name={link.icon} />
                <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Rodapé: avatar + sair + toggle */}
        <div className={`flex flex-col gap-2 border-t border-line p-3 ${collapsed ? "items-center" : ""}`}>
          {!collapsed && userName && (
            <div className="flex items-center gap-2 px-1 py-1">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-orange-hi">
                {initials}
              </span>
              <span className="truncate text-xs font-medium text-muted">{userName.split(" ")[0]}</span>
            </div>
          )}
          {collapsed && userName && (
            <span
              title={userName}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-orange-hi"
            >
              {initials}
            </span>
          )}

          <div className={`flex gap-2 ${collapsed ? "flex-col items-center" : "items-center"}`}>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Sair"
              aria-label="Sair da conta"
              className={`flex items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50 ${
                collapsed ? "w-full" : ""
              }`}
            >
              <LogoutIconSvg />
              {!collapsed && <span>{loggingOut ? "Saindo..." : "Sair"}</span>}
              {collapsed && <span className="sr-only">Sair</span>}
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
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="min-w-0 flex-1">
        {/* Mobile topbar: apenas logo + ThemeToggle (nav fica na bottom bar) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-petrol/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href={home} className="shrink-0" aria-label="ENKY — início">
            <BrandLogo />
          </Link>
          <ThemeToggle />
        </header>

        {/* Espaço inferior para a bottom nav não cobrir o conteúdo */}
        <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>

      {/* Bottom nav mobile — fora do fluxo, fixed */}
      <TrainerBottomNav />
    </div>
  );
}
