"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { clearAppCaches } from "@/app/_lib/pwa";
import { MoreIcon, LogoutIcon, ChevronRightIcon } from "@/components/ui/icons";
import { BottomDrawer } from "@/components/nav/bottom-drawer";
import {
  TRAINER_NAV_PRIMARY,
  TRAINER_NAV_SECONDARY,
  isNavActive,
} from "@/components/nav/nav-config";

// Bottom nav do treinador — visível apenas em mobile (<md).
// 4 itens primários + "Mais" → abre BottomDrawer com itens secundários.
// Ativo: pill bg-orange-lo + texto orange-hi. Inativo: texto muted.

export function TrainerBottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // "Mais" está ativo se o pathname não bate com nenhum primário
  const primaryActive = TRAINER_NAV_PRIMARY.some((item) =>
    isNavActive(item.href, "/treinador", pathname)
  );
  const moreActive = !primaryActive;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      await clearAppCaches();
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-deep/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* 4 links primários */}
        {TRAINER_NAV_PRIMARY.map((item) => {
          const active = isNavActive(item.href, "/treinador", pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
                active ? "text-orange-hi" : "text-muted hover:text-ink"
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-xl px-2.5 py-1 transition-colors ${
                  active ? "bg-orange-lo" : ""
                }`}
              >
                <Icon width={20} height={20} />
              </span>
              <span>{item.shortLabel}</span>
            </Link>
          );
        })}

        {/* Botão "Mais" */}
        <button
          ref={moreButtonRef}
          type="button"
          aria-label="Abrir menu de navegação"
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          onClick={() => setDrawerOpen(true)}
          className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors ${
            moreActive ? "text-orange-hi" : "text-muted hover:text-ink"
          }`}
        >
          <span
            className={`flex items-center justify-center rounded-xl px-2.5 py-1 transition-colors ${
              moreActive ? "bg-orange-lo" : ""
            }`}
          >
            <MoreIcon width={20} height={20} />
          </span>
          <span>Mais</span>
        </button>
      </nav>

      {/* Drawer "Mais" */}
      <BottomDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Menu"
        triggerRef={moreButtonRef}
      >
        <ul className="flex flex-col gap-0.5 px-3 py-2">
          {TRAINER_NAV_SECONDARY.map((item) => {
            const active = isNavActive(item.href, "/treinador", pathname);
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-orange-lo text-orange-hi"
                      : "text-ink hover:bg-surface"
                  }`}
                >
                  <Icon width={20} height={20} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-hi shrink-0" aria-hidden="true" />
                  )}
                  {!active && <ChevronRightIcon width={16} height={16} className="shrink-0 text-faint" />}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Sair */}
        <div className="border-t border-line px-3 py-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-sm font-medium text-muted transition-colors hover:bg-danger-lo hover:text-danger disabled:opacity-50"
          >
            <LogoutIcon width={20} height={20} className="shrink-0" />
            {loggingOut ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      </BottomDrawer>
    </>
  );
}
