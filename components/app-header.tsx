"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { clearAppCaches } from "@/app/_lib/pwa";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export interface AppNavLink {
  href: string;
  label: string;
}

// Shared authenticated chrome for the trainer/athlete areas: brand, section
// nav, and logout. Rendered from the area layouts so every page in those
// areas gets consistent navigation and a visible way out.
export function AppHeader({ home, links }: { home: string; links: AppNavLink[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Idempotent server-side (revokes the session + clears the cookie);
      // even if it fails we still send the user to /login.
      await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      // Não deixar rastro de dados no aparelho após sair (§33/§52).
      await clearAppCaches();
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-petrol/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href={home} className="shrink-0" aria-label="ENKY — início">
            <BrandLogo />
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            {links.map((link) => {
              const active =
                link.href === home
                  ? pathname === home
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-surface text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
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
      </div>
    </header>
  );
}
