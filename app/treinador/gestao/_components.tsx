"use client";

import { uiClasses } from "@/app/_lib/ui";

// Primitivos de UI compartilhados pelas telas de Gestão (leads, clientes e as
// próximas). Extraídos para não divergirem entre páginas.

export function Overlay({
  children,
  onClose,
  side,
}: {
  children: React.ReactNode;
  onClose: () => void;
  side?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/50"
      onClick={onClose}
      style={{ justifyContent: side ? "flex-end" : "center", alignItems: side ? "stretch" : "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${uiClasses.panel} m-4 flex max-h-[90vh] w-full flex-col gap-4 overflow-y-auto bg-petrol p-5 ${
          side ? "max-w-md" : "max-w-lg"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={uiClasses.label}>{label}</span>
      {children}
    </label>
  );
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
