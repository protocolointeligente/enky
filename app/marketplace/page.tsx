import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedProducts } from "@/modules/marketplace-catalog/catalog";
import { formatPriceCents, productTypeLabel } from "@/modules/marketplace-catalog/labels";
import { uiClasses } from "@/app/_lib/ui";

// Vitrine PÚBLICA do marketplace (Server Component, §8/§37). Sem guard: lê só
// produtos PUBLISHED + PUBLIC. Preço = priceSnapshot da versão publicada.
export const metadata: Metadata = {
  title: "Marketplace — ENKY",
  description:
    "Planos de treino, periodizações e consultorias dos melhores treinadores, prontos para comprar e começar hoje.",
};

// Catálogo muda com publicação/venda; ISR curto evita bater o banco a cada hit.
export const revalidate = 300;

export default async function MarketplacePage() {
  const products = await listPublishedProducts();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 sm:px-6">
      <header className="flex flex-col gap-3">
        <span className={uiClasses.eyebrow}>Marketplace</span>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Treine com quem entende
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Planos, periodizações e consultorias de treinadores verificados. Compre e comece agora.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="text-muted">Nenhum produto publicado ainda. Volte em breve.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/marketplace/produtos/${p.slug}`}
                className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-petrol/60 p-5 transition-colors hover:border-line-strong"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-faint">
                  {productTypeLabel[p.productType]}
                </span>
                <h2 className="font-display text-lg font-semibold text-ink">{p.title}</h2>
                {p.shortDescription && (
                  <p className="line-clamp-3 text-sm text-muted">{p.shortDescription}</p>
                )}
                <div className="mt-auto flex items-baseline justify-between pt-2">
                  <span className="text-sm text-muted">{p.sellerName}</span>
                  <span className="font-semibold text-ink">
                    {formatPriceCents(p.priceCents, p.currency)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
