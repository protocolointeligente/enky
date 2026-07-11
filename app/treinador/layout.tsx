import { AppHeader } from "@/components/app-header";

// Nav grows as Fase 02D sections land (Atletas, Calendário, Biblioteca).
// Every link here must point at a real route so the header never offers a
// dead link.
const TRAINER_LINKS = [
  { href: "/treinador", label: "Painel" },
  { href: "/treinador/calendario", label: "Calendário" },
  { href: "/treinador/atletas", label: "Atletas" },
  { href: "/treinador/exercicios", label: "Exercícios" },
  { href: "/treinador/templates", label: "Templates" },
];

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader home="/treinador" links={TRAINER_LINKS} />
      {children}
    </>
  );
}
