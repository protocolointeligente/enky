"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";

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
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="border-b border-slate-800 bg-[#0a0f1c]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link
            href={home}
            className="bg-gradient-to-r from-[#00e6c3] to-[#0066ff] bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
          >
            ENKY
          </Link>
          <nav className="flex items-center gap-4">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm ${active ? "text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
        >
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </header>
  );
}
