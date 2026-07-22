"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ATHLETE_NAV } from "@/components/athlete-bottom-nav";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Header enxuto do atleta (§6/§7): NÃO reusa o chrome do treinador. No mobile é
// só marca + tema (a navegação vive na bottom nav). No desktop (≥sm), onde a
// bottom nav some, expõe os mesmos destinos como nav horizontal.
export function AthleteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-petrol/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/atleta" className="shrink-0" aria-label="ENKY — início">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Navegação principal">
          {ATHLETE_NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-surface text-ink" : "text-muted hover:bg-surface/60 hover:text-ink"
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
