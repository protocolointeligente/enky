import { AppHeader } from "@/components/app-header";
import { Toaster } from "@/app/_lib/toast";

const ATHLETE_LINKS = [
  { href: "/atleta", label: "Meus treinos" },
  { href: "/atleta/calendario", label: "Calendário" },
];

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader home="/atleta" links={ATHLETE_LINKS} />
      {children}
      <Toaster />
    </>
  );
}
