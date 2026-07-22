"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { formatPriceCents, productTypeLabel } from "@/modules/marketplace-catalog/labels";
import type { SellerDashboard } from "@/modules/marketplace-seller/seller-service";

const PRODUCT_TYPES = Object.keys(productTypeLabel) as (keyof typeof productTypeLabel)[];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  PENDING_REVIEW: "Em revisão",
  REJECTED: "Rejeitado",
  SUSPENDED: "Suspenso",
  ARCHIVED: "Arquivado",
  APPROVED: "Aprovado",
};

export default function SellerDashboardPage() {
  const { checked } = useRequireRole("TRAINER");
  const [data, setData] = useState<SellerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ dashboard: SellerDashboard }>("/api/marketplace/seller")
      .then((r) => setData(r.dashboard))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro ao carregar."));
  }, []);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked || (data === null && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-10 sm:px-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Marketplace</span>
          <h1 className="font-display text-2xl font-bold text-ink">Meus produtos</h1>
        </div>
        <Link href="/marketplace" className={uiClasses.link}>
          Ver vitrine →
        </Link>
      </header>

      {error && <p className={uiClasses.error}>{error}</p>}

      {data && !data.profile ? (
        <SellerOnboarding busy={busy} onCreate={(body) => run(() => createProfile(body))} />
      ) : (
        data &&
        data.profile && (
          <>
            {!data.profile.hasWallet && (
              <WalletBanner
                displayName={data.profile.displayName}
                busy={busy}
                onSave={(walletId) =>
                  run(() => createProfile({ displayName: data.profile!.displayName, asaasWalletId: walletId }))
                }
              />
            )}
            <ProductForm busy={busy} onCreate={(body) => run(() => createProduct(body))} />
            <ProductList
              products={data.products}
              busy={busy}
              onPublish={(id) => run(() => publishProduct(id))}
            />
          </>
        )
      )}
    </main>
  );
}

function createProfile(body: { displayName: string; headline?: string; asaasWalletId?: string }) {
  return apiFetch("/api/marketplace/seller", { method: "POST", body: JSON.stringify(body) });
}
function createProduct(body: unknown) {
  return apiFetch("/api/marketplace/seller/products", { method: "POST", body: JSON.stringify(body) });
}
function publishProduct(id: string) {
  return apiFetch(`/api/marketplace/seller/products/${id}/publish`, { method: "POST" });
}

function SellerOnboarding({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (body: { displayName: string; headline?: string; asaasWalletId?: string }) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [walletId, setWalletId] = useState("");
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-petrol/60 p-5">
      <h2 className={uiClasses.subheading}>Criar perfil de vendedor</h2>
      <p className="text-sm text-muted">Publique seu nome público antes de cadastrar produtos.</p>
      <input
        className={uiClasses.input}
        placeholder="Nome público (ex.: Studio Corpo & Movimento)"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />
      <input
        className={uiClasses.input}
        placeholder="Chamada curta (opcional)"
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
      />
      <input
        className={uiClasses.input}
        placeholder="Carteira Asaas / walletId (para receber os 90%)"
        value={walletId}
        onChange={(e) => setWalletId(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || displayName.trim().length < 2}
        onClick={() =>
          onCreate({
            displayName: displayName.trim(),
            headline: headline.trim() || undefined,
            asaasWalletId: walletId.trim() || undefined,
          })
        }
        className={uiClasses.button}
      >
        Criar perfil
      </button>
    </section>
  );
}

function WalletBanner({
  displayName,
  busy,
  onSave,
}: {
  displayName: string;
  busy: boolean;
  onSave: (walletId: string) => void;
}) {
  const [walletId, setWalletId] = useState("");
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-5">
      <h2 className={uiClasses.subheading}>Configure sua carteira de repasse</h2>
      <p className="text-sm text-muted">
        {displayName}, informe seu <strong>walletId</strong> do Asaas para receber 90% de cada venda.
        Sem ele, suas vendas não podem ser cobradas em produção.
      </p>
      <input
        className={uiClasses.input}
        placeholder="walletId do Asaas"
        value={walletId}
        onChange={(e) => setWalletId(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || walletId.trim().length < 4}
        onClick={() => onSave(walletId.trim())}
        className={uiClasses.button}
      >
        Salvar carteira
      </button>
    </section>
  );
}

function ProductForm({ busy, onCreate }: { busy: boolean; onCreate: (body: unknown) => void }) {
  const [title, setTitle] = useState("");
  const [productType, setProductType] = useState<string>("TRAINING_PLAN");
  const [price, setPrice] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
  const valid = title.trim().length >= 3 && Number.isInteger(priceCents) && priceCents > 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-petrol/60 p-5">
      <h2 className={uiClasses.subheading}>Novo produto</h2>
      <input
        className={uiClasses.input}
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex gap-3">
        <select
          className={uiClasses.select}
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
        >
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {productTypeLabel[t]}
            </option>
          ))}
        </select>
        <input
          className={uiClasses.input}
          inputMode="decimal"
          placeholder="Preço (R$)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <input
        className={uiClasses.input}
        placeholder="Descrição curta (opcional)"
        value={shortDescription}
        onChange={(e) => setShortDescription(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || !valid}
        onClick={() =>
          onCreate({
            title: title.trim(),
            productType,
            priceCents,
            shortDescription: shortDescription.trim() || undefined,
          })
        }
        className={uiClasses.button}
      >
        Criar rascunho
      </button>
    </section>
  );
}

function ProductList({
  products,
  busy,
  onPublish,
}: {
  products: SellerDashboard["products"];
  busy: boolean;
  onPublish: (id: string) => void;
}) {
  if (products.length === 0) {
    return <p className="text-muted">Você ainda não tem produtos.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {products.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-line bg-petrol/60 p-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-faint">
              {productTypeLabel[p.productType]}
            </span>
            <span className="truncate font-medium text-ink">{p.title}</span>
            <span className="text-xs text-muted">
              {formatPriceCents(p.priceCents)} · {STATUS_LABEL[p.status] ?? p.status}
              {p.salesCount > 0 && ` · ${p.salesCount} vendas`}
            </span>
          </div>
          {p.isPublished ? (
            <Link href={`/marketplace/produtos/${p.slug}`} className={uiClasses.link}>
              Ver
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPublish(p.id)}
              className={uiClasses.button}
            >
              Publicar
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
