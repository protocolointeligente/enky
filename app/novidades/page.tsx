/* eslint-disable @next/next/no-img-element -- capas vêm de blogs externos variados */
import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "@/modules/content/articles";
import { loadContentFeeds } from "@/modules/content/feed";
import { modalityMeta } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";

// Vitrine PÚBLICA de conteúdo (Server Component). Renderiza no servidor —
// nenhuma chamada autenticada, nenhum guard. Agrega os blogs por modalidade e
// apresenta a ENKY para quem ainda não é cliente. Cache herda do fetch (1h).
export const metadata: Metadata = {
  title: "Novidades — ENKY",
  description:
    "Conteúdo dos melhores blogs de cada modalidade e a apresentação da ENKY, plataforma de performance humana para treinadores e atletas.",
};

// A landing já é dinâmica via fetch revalidate; aqui deixamos o Next decidir o
// cache do RSC. Sem force-dynamic: a página pode ser estática/ISR.
export const revalidate = 3600;

function fmtDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function NovidadesPage() {
  const items = await loadContentFeeds();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-14 sm:px-6">
      <header className="flex flex-col gap-3">
        <span className={uiClasses.eyebrow}>Vitrine de conteúdo</span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Novidades
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Conteúdo dos melhores blogs de cada modalidade, reunido para você acompanhar — e a
          apresentação da ENKY, a plataforma que transforma dados de treino em decisão.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            href="/registrar"
            className="rounded-lg bg-orange px-5 py-2.5 font-semibold text-onbrand transition-colors hover:bg-orange-hi"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-line-strong px-5 py-2.5 font-semibold text-ink transition-colors hover:border-electric hover:text-electric-hi"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Artigos institucionais (internos, /novidades/[slug]) */}
      <section className="flex flex-col gap-5">
        <h2 className={uiClasses.subheading}>Conheça a ENKY</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/novidades/${a.slug}`}
                className="flex h-full flex-col gap-2 rounded-xl border border-line bg-petrol/50 p-5 transition-colors hover:border-line-strong hover:bg-petrol"
              >
                <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                  {a.title}
                </h3>
                <p className="line-clamp-3 text-sm text-muted">{a.excerpt}</p>
                <span className="mt-auto pt-1 text-sm font-medium text-electric-hi">Ler →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Feed agregado dos blogs externos por modalidade */}
      <section className="flex flex-col gap-5">
        <h2 className={uiClasses.subheading}>Do mundo do esporte</h2>
        {items.length === 0 ? (
          <div className={`${uiClasses.card} text-sm text-muted`}>
            Nenhuma novidade no momento. Volte em breve.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const date = fmtDate(item.date);
              const meta = item.modality ? modalityMeta(item.modality) : null;
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-petrol/60 transition-colors hover:border-line-strong hover:bg-petrol"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-40 w-full bg-surface object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="h-40 w-full"
                        style={{
                          background: meta
                            ? `linear-gradient(135deg, ${meta.accent}33, ${meta.accent}0a)`
                            : "var(--color-surface)",
                        }}
                      />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-center gap-2 text-xs text-faint">
                        {meta && (
                          <span className={`${uiClasses.badge} ${meta.chip}`}>{meta.label}</span>
                        )}
                        {date && <span>{date}</span>}
                      </div>
                      <h3 className="font-display font-semibold leading-snug text-ink">
                        {item.title}
                      </h3>
                      {item.excerpt && (
                        <p className="line-clamp-3 text-sm text-muted">{item.excerpt}</p>
                      )}
                      <span className="mt-auto pt-1 text-sm font-medium text-electric-hi">
                        {item.source ? `Ler no ${item.source} →` : "Ler mais →"}
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
