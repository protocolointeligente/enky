import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/app/_lib/toast";

// União do merge: shell redesenhado do marketplace + área comercial "Gestão"
// vinda do CRM (Etapa 4). Todo link aponta para rota real (sem dead link).
// TODO(§8 nav): racionalizar "Planos" (catálogo SaaS) vs. Configurações →
// Assinatura ENKY e consolidar com nav-config.ts como fonte única.
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
  { href: "/treinador/gestao",     label: "Gestão",        icon: "gestao" },
  { href: "/treinador/planos",     label: "Planos",        icon: "planos" },
  { href: "/treinador/marketplace",label: "Marketplace",   icon: "marketplace" },
  { href: "/treinador/configuracoes", label: "Configurações", icon: "configuracoes" },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSidebar home="/treinador" links={TRAINER_LINKS}>
      {children}
      <Toaster />
    </AppSidebar>
  );
}
