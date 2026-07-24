"use client";

import { useEffect, useRef } from "react";
import { ChevronUpIcon } from "@/components/ui/icons";

// Bottom sheet / drawer genérico reutilizado pelo treinador e pelo atleta.
// Acessibilidade: Esc fecha, foco fica preso dentro, foco retorna ao trigger,
// overlay fecha ao clicar, body scroll bloqueado enquanto aberto.
// Animação: slide-up 220ms, respeita prefers-reduced-motion.

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** ref do botão que abriu o drawer — foco retorna aqui ao fechar */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function BottomDrawer({ open, onClose, title, children, triggerRef }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Bloqueia scroll do body e devolve ao fechar
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      // Devolve foco ao trigger
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, triggerRef]);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap: Tab e Shift+Tab ficam presos no drawer
  useEffect(() => {
    if (!open || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();

    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="motion-safe:animate-slide-up fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-2xl border-t border-line bg-petrol shadow-2xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Handle bar */}
        <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
          <div className="flex w-full items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar menu"
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
            >
              <ChevronUpIcon width={18} height={18} />
            </button>
          </div>
        </div>

        {/* Content — scrollável */}
        <div className="overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}
