"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppNavLink } from "@/components/app-header";

// Shell com navegação persistente para a área do treinador: sidebar fixa no
// desktop (o menu deixa de viver só nos cards do painel) e topbar rolável no
// mobile. Atleta continua no AppHeader — este shell é só do treinador.
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
    href === home
      ? pathname === home
      : pathname === href || pathname.startsWith(`${href}/`);

  const logoutBtn = (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
    >
      {loggingOut ? "Saindo..." : "Sair"}
    </button>
  );

  return (
    <div className="lg:flex">
      {/* Desktop: sidebar fixa */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-petrol/95 backdrop-blur lg:flex">
        <div className="p-5">
          <Link href={home} aria-label="ENKY — início">
            <BrandLogo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-surface text-ink"
                  : "text-muted hover:bg-surface/60 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-line p-3">
          <ThemeToggle />
          {logoutBtn}
        </div>
      </aside>

      {/* Conteúdo + topbar mobile */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-petrol/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href={home} className="shrink-0" aria-label="ENKY — início">
            <BrandLogo />
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
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
            {logoutBtn}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
