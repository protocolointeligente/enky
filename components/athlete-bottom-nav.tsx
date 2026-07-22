"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, MoreIcon, PlayIcon, TrendingUpIcon } from "@/components/ui/icons";

// Navegação inferior mobile-first do atleta (§7): 5 destinos ao alcance do polegar.
// Área de toque ≥44px, rótulo sempre visível, estado ativo, safe-area no recorte.
// Visível só em telas pequenas; some no header desktop.
export const ATHLETE_NAV = [
  { href: "/atleta", label: "Início", icon: HomeIcon, exact: true },
  { href: "/atleta/calendario", label: "Calendário", icon: CalendarIcon, exact: false },
  { href: "/atleta/treino", label: "Treino", icon: PlayIcon, exact: false },
  { href: "/atleta/evolucao", label: "Evolução", icon: TrendingUpIcon, exact: false },
  { href: "/atleta/mais", label: "Mais", icon: MoreIcon, exact: false },
] as const;

export function AthleteBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-petrol/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      {ATHLETE_NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
              active ? "text-orange-hi" : "text-muted"
            }`}
          >
            <Icon width={22} height={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
