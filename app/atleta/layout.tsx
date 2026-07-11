import { AppHeader } from "@/components/app-header";
import { AthleteBottomNav } from "@/components/athlete-bottom-nav";
import { Toaster } from "@/app/_lib/toast";

const ATHLETE_LINKS = [
  { href: "/atleta", label: "Meus treinos" },
  { href: "/atleta/calendario", label: "Calendário" },
];

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader home="/atleta" links={ATHLETE_LINKS} />
      {/* Bottom nav overlaps content on mobile — reserve space for it. */}
      <div className="pb-20 sm:pb-0">{children}</div>
      <AthleteBottomNav />
      <Toaster />
    </>
  );
}
