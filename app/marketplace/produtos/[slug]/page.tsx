import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "@/modules/marketplace-catalog/catalog";
import { formatPriceCents, productTypeLabel } from "@/modules/marketplace-catalog/labels";
import { buildProductSeo } from "@/modules/marketplace-catalog/seo";
import { uiClasses } from "@/app/_lib/ui";
import { BuyButton } from "./buy-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado — ENKY", robots: "noindex,nofollow" };

  const seo = buildProductSeo(product);
  return {
    title: `${seo.title} — ENKY`,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: seo.robots,
    openGraph: {
      title: seo.openGraph.title,
      description: seo.openGraph.description,
      url: seo.openGraph.url,
      type: "website",
      images: seo.openGraph.image ? [seo.openGraph.image] : undefined,
    },
  };
}

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

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="text-warning">
        {"★".repeat(full)}{half ? "½" : ""}{"☆".repeat(empty)}
      </span>
      <span className="text-muted">
        {rating > 0 ? rating.toFixed(1) : "Sem avaliações"}{count > 0 ? ` (${count})` : ""}
      </span>
    </span>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  const facts = [
    product.modality      && { label: "Modalidade",  value: product.modality },
    product.level         && { label: "Nível",        value: product.level },
    product.durationWeeks && { label: "Duração",      value: `${product.durationWeeks} semanas` },
    product.sessionsPerWeek && { label: "Frequência", value: `${product.sessionsPerWeek}×/semana` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className="min-h-screen bg-deep text-ink">
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <div className="border-b border-line bg-petrol px-5 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-2 text-xs text-muted">
          <Link href="/marketplace" className="hover:text-ink transition-colors">Marketplace</Link>
          <span>/</span>
          <span className="text-ink truncate max-w-xs">{product.title}</span>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-0 px-5 py-10 sm:px-6 lg:flex-row lg:gap-12">

        {/* ── COLUNA ESQUERDA: info do produto ─────────────────── */}
        <div className="flex flex-1 flex-col gap-8 min-w-0">

          {/* Cover ou placeholder */}
          {product.coverImageUrl ? (
            <img
              src={product.coverImageUrl}
              alt={product.title}
              className="h-64 w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-2xl bg-petrol border border-line text-6xl">
              {TYPE_ICON[product.productType] ?? "📦"}
            </div>
          )}

          {/* Header */}
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">
                {TYPE_ICON[product.productType]} {productTypeLabel[product.productType]}
              </span>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {product.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">
                por <span className="font-semibold text-ink">{product.sellerName}</span>
              </span>
              <StarRating rating={product.averageRating} count={product.reviewCount} />
            </div>
          </header>

          {/* Descrição curta */}
          {product.shortDescription && (
            <p className="text-lg leading-relaxed text-muted">{product.shortDescription}</p>
          )}

          {/* Facts grid */}
          {facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((f) => (
                <div key={f.label} className="flex flex-col gap-1 rounded-2xl border border-line bg-kpi-bg p-4">
                  <dt className={uiClasses.eyebrow}>{f.label}</dt>
                  <dd className="text-base font-semibold text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Descrição longa */}
          {product.fullDescription && (
            <article className="flex flex-col gap-3">
              <h2 className={uiClasses.subheading}>Sobre este produto</h2>
              <div className="flex flex-col gap-3 leading-relaxed text-muted">
                {product.fullDescription.split("\n").filter(Boolean).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </article>
          )}
        </div>

        {/* ── COLUNA DIREITA: compra (sticky no desktop) ──────── */}
        <aside className="w-full lg:w-80 lg:shrink-0">
          <div className="sticky top-6 flex flex-col gap-5 rounded-2xl border border-line bg-petrol p-6 shadow-lg">
            <div className="flex flex-col gap-1">
              <span className={uiClasses.eyebrow}>Preço</span>
              <span className="font-display text-3xl font-bold text-ink">
                {formatPriceCents(product.priceCents, product.currency)}
              </span>
              <span className="text-xs text-muted">Acesso vitalício após pagamento</span>
            </div>

            <BuyButton
              slug={product.slug}
              priceLabel={formatPriceCents(product.priceCents, product.currency)}
            />

            <ul className="flex flex-col gap-2 border-t border-line pt-4 text-xs text-muted">
              <li className="flex items-start gap-2">
                <span className="text-turq shrink-0">✓</span>
                Acesso liberado automaticamente após confirmação do PIX
              </li>
              <li className="flex items-start gap-2">
                <span className="text-turq shrink-0">✓</span>
                Conteúdo disponível na sua biblioteca ENKY
              </li>
              <li className="flex items-start gap-2">
                <span className="text-turq shrink-0">✓</span>
                Sem assinatura — compra única
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
