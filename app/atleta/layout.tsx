import { AthleteBottomNav } from "@/components/athlete-bottom-nav";
import { AthleteHeader } from "@/components/athlete-header";
import { Toaster } from "@/app/_lib/toast";

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AthleteHeader />
      {/* Bottom nav overlaps content on mobile — reserve space for it. */}
      <div className="pb-24 sm:pb-0">{children}</div>
      <AthleteBottomNav />
      <Toaster />
    </>
  );
}
