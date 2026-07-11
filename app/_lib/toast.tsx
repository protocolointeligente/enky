"use client";

import { useEffect, useState } from "react";

// Minimal dependency-free toast: a module-level pub/sub plus a single <Toaster/>
// mounted per authenticated layout. Any client handler calls toast.success(...)
// etc. — no context threading. Messages must be human-facing (never codes).
type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

function emit(kind: ToastKind, message: string): void {
  const item: ToastItem = { id: (counter += 1), kind, message };
  listeners.forEach((listener) => listener(item));
}

export const toast = {
  success: (message: string) => emit("success", message),
  error: (message: string) => emit("error", message),
  info: (message: string) => emit("info", message),
};

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-turq/40 bg-turq/15 text-turq",
  error: "border-danger/40 bg-danger/15 text-danger",
  info: "border-electric/40 bg-electric/15 text-electric-hi",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (item: ToastItem) => {
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((existing) => existing.id !== item.id));
      }, 4200);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-3 text-sm font-medium shadow-lg shadow-black/30 backdrop-blur ${KIND_STYLES[item.kind]}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
