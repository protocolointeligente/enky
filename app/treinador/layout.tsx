import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/app/_lib/toast";

// Links da sidebar desktop/tablet derivados da mesma config que o bottom nav mobile.
// TRAINER_NAV_ALL é a lista completa (primários + secundários) para a sidebar.
// Não manter lista separada aqui — use nav-config.ts como fonte única.
const TRAINER_LINKS = [
  { href: "/treinador",            label: "Painel",        icon: "painel" },
  { href: "/treinador/atletas",    label: "Atletas",       icon: "atletas" },
  { href: "/treinador/calendario", label: "Calendário",    icon: "calendario" },
  { href: "/treinador/novidades",  label: "Intelligence",  icon: "novidades" },
  { href: "/treinador/treinos",    label: "Treinos",       icon: "treinos" },
  { href: "/treinador/periodizacao",label: "Periodização", icon: "periodizacao" },
  { href: "/treinador/templates",  label: "Templates",     icon: "templates" },
  { href: "/treinador/exercicios", label: "Exercícios",    icon: "exercicios" },
  { href: "/treinador/relatorios", label: "Relatórios",    icon: "relatorios" },
  { href: "/treinador/planos",     label: "Planos",        icon: "planos" },
  { href: "/treinador/marketplace",label: "Marketplace",   icon: "marketplace" },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSidebar home="/treinador" links={TRAINER_LINKS}>
      {children}
      <Toaster />
    </AppSidebar>
  );
}
