import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedProducts } from "@/modules/marketplace-catalog/catalog";
import { formatPriceCents, productTypeLabel } from "@/modules/marketplace-catalog/labels";
import { uiClasses } from "@/app/_lib/ui";

export const metadata: Metadata = {
  title: "Marketplace — ENKY",
  description:
    "Planos de treino, periodizações e consultorias dos melhores treinadores, prontos para comprar e começar hoje.",
};

export const dynamic = "force-dynamic";

// Ícones de tipo de produto (emoji leve — SSR, sem hydration issues)
const TYPE_ICON: Record<string, string> = {
  TRAINING_PLAN:          "🏃",
  COACHING_SERVICE:       "🧠",
  ASSESSMENT_SERVICE:     "📊",
  PERIODIZATION_TEMPLATE: "📅",
  WORKOUT_TEMPLATE_PACK:  "💪",
  EXERCISE_LIBRARY_PACK:  "🗂️",
  EDUCATIONAL_CONTENT:    "📚",
  CONSULTATION:           "🎯",
  EVENT_PROGRAM:          "🏆",
};

// Stars render (0–5 com meio-ponto como ★☆)
function Stars({ rating, count }: { rating: number; count: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="flex items-center gap-1 text-xs text-muted">
      <span className="text-warning" aria-label={`${rating} estrelas`}>
        {"★".repeat(full)}
        {half ? "½" : ""}
        {"☆".repeat(empty)}
      </span>
      {count > 0 && <span>({count})</span>}
    </span>
  );
}

export default async function MarketplacePage() {
  const products = await listPublishedProducts();

  return (
    <main className="min-h-screen bg-deep text-ink">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="border-b border-line bg-petrol px-5 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <span className={uiClasses.eyebrow}>Marketplace ENKY</span>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Treine com quem entende
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            Planos, periodizações e consultorias de treinadores verificados.
            Compre, acesse e já comece.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/marketplace/biblioteca"
              className={uiClasses.buttonSecondary + " text-sm"}
            >
              Minha biblioteca
            </Link>
          </div>
        </div>
      </section>

      {/* ── Catálogo ─────────────────────────────────────────── */}
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-6">
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line py-20 text-center">
            <span className="text-4xl" aria-hidden="true">🚀</span>
            <p className="font-semibold text-ink">Nenhum produto publicado ainda.</p>
            <p className="text-sm text-muted">
              Seja o primeiro a vender — abra seu painel de vendedor.
            </p>
            <Link href="/treinador/marketplace" className={uiClasses.link + " text-sm"}>
              Ir para o painel do vendedor →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">{products.length}</span>{" "}
                produto{products.length !== 1 ? "s" : ""} disponíve{products.length !== 1 ? "is" : "l"}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <li key={p.slug} className="animate-fade-up">
                  <Link
                    href={`/marketplace/produtos/${p.slug}`}
                    className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-petrol p-5 transition-all hover:border-line-strong hover:shadow-[0_0_0_1px_var(--color-line-strong)]"
                  >
                    {/* Thumbnail ou placeholder */}
                    {p.thumbnailUrl ? (
                      <img
                        src={p.thumbnailUrl}
                        alt={p.title}
                        className="h-36 w-full rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center rounded-xl bg-surface text-5xl">
                        {TYPE_ICON[p.productType] ?? "📦"}
                      </div>
                    )}

                    {/* Badge de tipo */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                        {TYPE_ICON[p.productType]} {productTypeLabel[p.productType]}
                      </span>
                    </div>

                    {/* Título + descrição */}
                    <div className="flex flex-1 flex-col gap-1.5">
                      <h2 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-orange-hi transition-colors">
                        {p.title}
                      </h2>
                      {p.shortDescription && (
                        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
                          {p.shortDescription}
                        </p>
                      )}
                    </div>

                    {/* Rodapé: seller + rating + preço */}
                    <div className="flex items-end justify-between gap-2 border-t border-line pt-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-muted">{p.sellerName}</span>
                        <Stars rating={p.averageRating} count={p.reviewCount} />
                      </div>
                      <span className="font-display text-lg font-bold text-ink">
                        {formatPriceCents(p.priceCents, p.currency)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
