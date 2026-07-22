import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedProductBySlug } from "@/modules/marketplace-catalog/catalog";
import { formatPriceCents, productTypeLabel } from "@/modules/marketplace-catalog/labels";
import { buildProductSeo } from "@/modules/marketplace-catalog/seo";
import { uiClasses } from "@/app/_lib/ui";
import { BuyButton } from "./buy-button";

// Lê o banco (catálogo + generateMetadata) a cada request — sem DATABASE_URL no
// build da Vercel, não pode ser pré-renderizada.
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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);
  if (!product) notFound();

  const facts = [
    product.modality && { label: "Modalidade", value: product.modality },
    product.level && { label: "Nível", value: product.level },
    product.durationWeeks && { label: "Duração", value: `${product.durationWeeks} semanas` },
    product.sessionsPerWeek && { label: "Frequência", value: `${product.sessionsPerWeek}x/semana` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-14 sm:px-6">
      <Link href="/marketplace" className="text-sm font-medium text-electric-hi hover:underline">
        ← Marketplace
      </Link>

      <header className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          {productTypeLabel[product.productType]}
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {product.title}
        </h1>
        <p className={uiClasses.hint}>por {product.sellerName}</p>
      </header>

      {product.shortDescription && (
        <p className="text-lg leading-relaxed text-muted">{product.shortDescription}</p>
      )}

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-line bg-petrol/60 p-5 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <dt className="text-xs uppercase tracking-wide text-faint">{f.label}</dt>
              <dd className="text-sm font-medium text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {product.fullDescription && (
        <article className="flex flex-col gap-4 leading-relaxed text-muted">
          {product.fullDescription.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>
      )}

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-petrol/60 p-5">
        <span className="font-display text-2xl font-bold text-ink">
          {formatPriceCents(product.priceCents, product.currency)}
        </span>
        <BuyButton
          slug={product.slug}
          priceLabel={formatPriceCents(product.priceCents, product.currency)}
        />
      </div>
    </main>
  );
}
