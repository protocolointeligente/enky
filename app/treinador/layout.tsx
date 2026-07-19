import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/app/_lib/toast";

// Every link here must point at a real route so the nav never offers a dead
// link. Periodização e Relatórios entram aqui para deixarem de existir só nos
// cards do painel.
//
// "Planos" (catálogo SaaS do ENKY) saiu da operação esportiva (Etapa 4 §2): a
// assinatura ENKY mora agora em Configurações → Assinatura ENKY. "Gestão" é a
// nova área comercial da assessoria (CRM, contratos, financeiro).
const TRAINER_LINKS = [
  { href: "/treinador", label: "Painel", icon: "painel" },
  { href: "/treinador/calendario", label: "Calendário", icon: "calendario" },
  { href: "/treinador/atletas", label: "Atletas", icon: "atletas" },
  { href: "/treinador/periodizacao", label: "Periodização", icon: "periodizacao" },
  { href: "/treinador/exercicios", label: "Exercícios", icon: "exercicios" },
  { href: "/treinador/templates", label: "Templates", icon: "templates" },
  { href: "/treinador/relatorios", label: "Relatórios", icon: "relatorios" },
  { href: "/treinador/gestao", label: "Gestão", icon: "gestao" },
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
