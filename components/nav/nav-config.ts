// Fonte única de verdade para rotas de navegação da ENKY.
// Sidebar, bottom nav e drawer são TODOS derivados desta config.
// Nunca manter três listas separadas — inconsistência garantida.

import type { ComponentType, SVGProps } from "react";
import {
  GridIcon,
  UsersIcon,
  CalendarIcon,
  BrainIcon,
  PlayIcon,
  LayersIcon,
  DumbbellIcon,
  LayersIcon as TemplatesIcon,
  BarChartIcon,
  ShoppingBagIcon,
  HomeIcon,
  TrendingUpIcon,
  BookOpenIcon,
  AlertIcon,
  ZapIcon,
  MoreIcon,
} from "@/components/ui/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  id: string;
  label: string;
  /** Rótulo curto para bottom nav (max ~8 chars) */
  shortLabel: string;
  href: string;
  icon: IconComponent;
  /** Aparece na barra inferior mobile */
  mobilePrimary?: boolean;
  /** Agrupamento na sidebar desktop */
  group: "main" | "training" | "intelligence" | "management" | "settings";
}

// ── TREINADOR ────────────────────────────────────────────────────────────────
export const TRAINER_NAV: NavItem[] = [
  // Bottom nav primária
  {
    id: "trainer-home",
    label: "Painel",
    shortLabel: "Início",
    href: "/treinador",
    icon: GridIcon,
    mobilePrimary: true,
    group: "main",
  },
  {
    id: "trainer-atletas",
    label: "Atletas",
    shortLabel: "Atletas",
    href: "/treinador/atletas",
    icon: UsersIcon,
    mobilePrimary: true,
    group: "main",
  },
  {
    id: "trainer-calendario",
    label: "Calendário",
    shortLabel: "Calendário",
    href: "/treinador/calendario",
    icon: CalendarIcon,
    mobilePrimary: true,
    group: "main",
  },
  // Drawer "Mais" (mobile) / sidebar (desktop)
  {
    id: "trainer-periodizacao",
    label: "Periodização",
    shortLabel: "Periodiz.",
    href: "/treinador/periodizacao",
    icon: LayersIcon,
    group: "training",
  },
  {
    id: "trainer-templates",
    label: "Templates",
    shortLabel: "Templates",
    href: "/treinador/templates",
    icon: TemplatesIcon,
    group: "training",
  },
  {
    id: "trainer-exercicios",
    label: "Exercícios",
    shortLabel: "Exercícios",
    href: "/treinador/exercicios",
    icon: DumbbellIcon,
    group: "training",
  },
  {
    id: "trainer-relatorios",
    label: "Relatórios",
    shortLabel: "Relatórios",
    href: "/treinador/relatorios",
    icon: BarChartIcon,
    group: "management",
  },
  {
    id: "trainer-planos",
    label: "Planos",
    shortLabel: "Planos",
    href: "/treinador/planos",
    icon: ZapIcon,
    group: "management",
  },
  {
    id: "trainer-marketplace",
    label: "Marketplace",
    shortLabel: "Market",
    href: "/treinador/marketplace",
    icon: ShoppingBagIcon,
    group: "management",
  },
];

export const TRAINER_NAV_PRIMARY = TRAINER_NAV.filter((i) => i.mobilePrimary);
export const TRAINER_NAV_SECONDARY = TRAINER_NAV.filter((i) => !i.mobilePrimary);

// ── ATLETA ───────────────────────────────────────────────────────────────────
export const ATHLETE_NAV: NavItem[] = [
  {
    id: "athlete-home",
    label: "Início",
    shortLabel: "Início",
    href: "/atleta",
    icon: HomeIcon,
    mobilePrimary: true,
    group: "main",
  },
  {
    id: "athlete-treinos",
    label: "Treinos",
    shortLabel: "Treinos",
    href: "/atleta/treino",
    icon: PlayIcon,
    mobilePrimary: true,
    group: "training",
  },
  {
    id: "athlete-calendario",
    label: "Calendário",
    shortLabel: "Calendário",
    href: "/atleta/calendario",
    icon: CalendarIcon,
    mobilePrimary: true,
    group: "main",
  },
  {
    id: "athlete-evolucao",
    label: "Evolução",
    shortLabel: "Evolução",
    href: "/atleta/evolucao",
    icon: TrendingUpIcon,
    mobilePrimary: true,
    group: "training",
  },
  // Drawer "Mais"
  {
    id: "athlete-prontidao",
    label: "Prontidão",
    shortLabel: "Prontidão",
    href: "/atleta/prontidao",
    icon: ZapIcon,
    group: "training",
  },
  {
    id: "athlete-relatorios",
    label: "Relatórios",
    shortLabel: "Relatórios",
    href: "/atleta/relatorios",
    icon: BarChartIcon,
    group: "management",
  },
  {
    id: "athlete-avaliacoes",
    label: "Avaliações",
    shortLabel: "Avaliações",
    href: "/atleta/avaliacoes",
    icon: AlertIcon,
    group: "management",
  },
  {
    id: "athlete-marketplace",
    label: "Marketplace",
    shortLabel: "Market",
    href: "/marketplace",
    icon: ShoppingBagIcon,
    group: "management",
  },
  {
    id: "athlete-biblioteca",
    label: "Minha Biblioteca",
    shortLabel: "Biblioteca",
    href: "/marketplace/biblioteca",
    icon: BookOpenIcon,
    group: "management",
  },
];

export const ATHLETE_NAV_PRIMARY = ATHLETE_NAV.filter((i) => i.mobilePrimary);
export const ATHLETE_NAV_SECONDARY = ATHLETE_NAV.filter((i) => !i.mobilePrimary);

// ── Helper: active matching ──────────────────────────────────────────────────
export function isNavActive(itemHref: string, homeHref: string, pathname: string): boolean {
  if (itemHref === homeHref) return pathname === homeHref;
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
