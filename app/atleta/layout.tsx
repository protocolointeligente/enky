import { AppHeader } from "@/components/app-header";

const ATHLETE_LINKS = [{ href: "/atleta", label: "Meus treinos" }];

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader home="/atleta" links={ATHLETE_LINKS} />
      {children}
    </>
  );
}
