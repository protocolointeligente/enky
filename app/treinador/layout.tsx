import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/app/_lib/toast";

// Every link here must point at a real route so the nav never offers a dead
// link. Periodização e Relatórios entram aqui para deixarem de existir só nos
// cards do painel.
const TRAINER_LINKS = [
  { href: "/treinador", label: "Painel" },
  { href: "/treinador/calendario", label: "Calendário" },
  { href: "/treinador/atletas", label: "Atletas" },
  { href: "/treinador/periodizacao", label: "Periodização" },
  { href: "/treinador/exercicios", label: "Exercícios" },
  { href: "/treinador/templates", label: "Templates" },
  { href: "/treinador/relatorios", label: "Relatórios" },
  { href: "/treinador/novidades", label: "Novidades" },
  { href: "/treinador/planos", label: "Planos" },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppSidebar home="/treinador" links={TRAINER_LINKS}>
      {children}
      <Toaster />
    </AppSidebar>
  );
}
