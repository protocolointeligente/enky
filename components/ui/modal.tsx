"use client";

import { useEffect, useRef } from "react";
import { uiClasses } from "@/app/_lib/ui";
import { CloseIcon } from "./icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

// Accessible dialog: role=dialog + aria-modal, ESC + backdrop close, initial
// focus moved into the panel, background scroll locked while open.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full ${SIZE_CLASS[size]} flex-col rounded-2xl border border-line bg-petrol shadow-2xl shadow-black/50 outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={`${uiClasses.buttonGhost} -mr-2 -mt-2 shrink-0`}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
