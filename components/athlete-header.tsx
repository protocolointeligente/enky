"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ATHLETE_NAV } from "@/components/athlete-bottom-nav";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Header do atleta — compacto no mobile (nav vive na bottom bar),
// barra de nav completa no desktop (≥sm).
// Fundo: deep/95 com backdrop-blur para profundidade.
export function AthleteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-deep/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/atleta" className="shrink-0" aria-label="ENKY — início">
          <BrandLogo />
        </Link>

        {/* Nav desktop — oculta no mobile (usa bottom nav) */}
        <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Navegação principal">
          {ATHLETE_NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-surface-2 text-ink"
                    : "text-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
