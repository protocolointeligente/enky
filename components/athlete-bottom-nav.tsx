"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, DumbbellIcon } from "@/components/ui/icons";

// Mobile-first bottom navigation for the athlete area — the athlete uses ENKY
// mostly on a phone, so the primary destinations sit within thumb reach.
// Hidden on >=sm, where the top AppHeader nav is enough.
const ITEMS = [
  { href: "/atleta", label: "Início", icon: DumbbellIcon },
  { href: "/atleta/calendario", label: "Calendário", icon: CalendarIcon },
];

export function AthleteBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-petrol/95 backdrop-blur sm:hidden">
      {ITEMS.map((item) => {
        const active =
          item.href === "/atleta" ? pathname === "/atleta" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
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
