import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Shell PÚBLICO da vitrine de conteúdo. Sem sidebar operacional, sem guard de
// sessão: qualquer visitante acessa. Cabeçalho com CTAs de login e cadastro —
// o briefing pede que a página pública chame para entrar e para se cadastrar.
export default function NovidadesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep text-ink">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-deep/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <Link href="/" aria-label="ENKY — início">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              Entrar
            </Link>
            <Link
              href="/registrar"
              className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-onbrand transition-colors hover:bg-orange-hi"
            >
              Criar conta grátis
            </Link>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-line/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo wordmark={false} />
            <span className="text-sm text-muted">Inteligência para cada decisão.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted">
            <Link href="/novidades" className="transition-colors hover:text-ink">
              Novidades
            </Link>
            <Link href="/login" className="transition-colors hover:text-ink">
              Entrar
            </Link>
            <Link href="/registrar" className="transition-colors hover:text-ink">
              Criar conta
            </Link>
            <span className="text-faint">© {2026} ENKY</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
