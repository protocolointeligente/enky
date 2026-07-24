import { AthleteBottomNav } from "@/components/athlete-bottom-nav";
import { AthleteHeader } from "@/components/athlete-header";
import { Toaster } from "@/app/_lib/toast";

// AthleteLayout: header sticky no topo + bottom nav fixa no mobile.
// md+ usa header com nav completa — bottom nav fica oculta (md:hidden).
// padding-bottom no wrapper garante que o conteúdo não fique coberto.
export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AthleteHeader />
      {/* Reserva espaço para a bottom nav no mobile; some no md+ */}
      <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <AthleteBottomNav />
      <Toaster />
    </>
  );
}
