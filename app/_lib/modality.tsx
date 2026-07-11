import type { ReactNode } from "react";
import { modalityLabel } from "./labels";

// Per-modality visual identity (color + icon) for calendar cards and the
// prescription picker — inspired by the reference training apps where each
// sport reads at a glance by color and icon. Colors sit on the ENKY brand
// tokens: electric blue = data/endurance, turquesa = water/recovery, orange =
// performance/strength. Each card uses `accent` for its left border/icon.
export interface ModalityMeta {
  label: string;
  accent: string; // hex for inline styles (border-left, icon color)
  chip: string; // tailwind classes for a soft badge
  icon: ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" {...stroke}>
      {children}
    </svg>
  );
}

export const MODALITY_META: Record<string, ModalityMeta> = {
  RUNNING: {
    label: "Corrida",
    accent: "#0066ff",
    chip: "bg-electric/15 text-electric-hi",
    icon: (
      <Icon>
        <path d="M13 4a1.5 1.5 0 1 0 0-.01M8 20l2-5 3-2 1 4 3 2M10 15l-2-3 1-4 4 1 2 3" />
      </Icon>
    ),
  },
  CYCLING: {
    label: "Ciclismo",
    accent: "#7c5cff",
    chip: "bg-[#7c5cff]/20 text-[#b3a4ff]",
    icon: (
      <Icon>
        <circle cx="5.5" cy="17" r="3.2" />
        <circle cx="18.5" cy="17" r="3.2" />
        <path d="M6 17l4-8h5l-3 8M9 9h4" />
      </Icon>
    ),
  },
  SWIMMING: {
    label: "Natação",
    accent: "#00d6c3",
    chip: "bg-turq/15 text-turq",
    icon: (
      <Icon>
        <path d="M2 17c2 1.5 3.5 1.5 5.5 0S11 15.5 13 17s3.5 1.5 5.5 0M2 21c2 1.5 3.5 1.5 5.5 0M13 21c2 1.5 3.5 1.5 5.5 0M7 12l4-3 3 2M17 6a1.4 1.4 0 1 0 0-.01" />
      </Icon>
    ),
  },
  STRENGTH: {
    label: "Musculação",
    accent: "#ff6500",
    chip: "bg-orange/15 text-orange-hi",
    icon: (
      <Icon>
        <path d="M6.5 6.5 17.5 17.5M3 8v8M6 5v14M18 5v14M21 8v8" />
      </Icon>
    ),
  },
  FUNCTIONAL: {
    label: "Funcional",
    accent: "#00d6c3",
    chip: "bg-turq/15 text-turq",
    icon: (
      <Icon>
        <path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" />
        <circle cx="12" cy="12" r="3" />
      </Icon>
    ),
  },
  TRIATHLON: {
    label: "Triatlo",
    accent: "#ff6500",
    chip: "bg-orange/15 text-orange-hi",
    icon: (
      <Icon>
        <circle cx="6" cy="17" r="2.6" />
        <circle cx="18" cy="17" r="2.6" />
        <path d="M6 17l3-6h4M13 6a1.3 1.3 0 1 0 0-.01" />
      </Icon>
    ),
  },
};

export function modalityMeta(value: string): ModalityMeta {
  return (
    MODALITY_META[value] ?? {
      label: modalityLabel(value),
      accent: "#a2b7c1",
      chip: "bg-surface text-muted",
      icon: <Icon>{<circle cx="12" cy="12" r="8" />}</Icon>,
    }
  );
}

export const MODALITY_ORDER = [
  "RUNNING",
  "STRENGTH",
  "FUNCTIONAL",
  "CYCLING",
  "SWIMMING",
  "TRIATHLON",
] as const;
