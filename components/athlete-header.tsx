"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ATHLETE_NAV_PRIMARY, isNavActive } from "@/components/nav/nav-config";

// Header do atleta.
// Mobile (<md):  apenas logo + ThemeToggle — nav fica na AthleteBottomNav.
// Desktop (≥md): logo + nav links dos itens primários + ThemeToggle.
// Fundo: deep/95 com backdrop-blur para profundidade e hierarquia.
export function AthleteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-deep/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/atleta" className="shrink-0" aria-label="ENKY — início">
          <BrandLogo />
        </Link>

        {/* Nav desktop (≥md) — oculta no mobile, usa bottom nav */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Navegação principal">
          {ATHLETE_NAV_PRIMARY.map((item) => {
            const active = isNavActive(item.href, "/atleta", pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-orange-lo text-orange-hi"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
