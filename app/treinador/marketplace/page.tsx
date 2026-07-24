"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { formatPriceCents, productTypeLabel } from "@/modules/marketplace-catalog/labels";
import type { SellerDashboard } from "@/modules/marketplace-seller/seller-service";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";

const PRODUCT_TYPES = Object.keys(productTypeLabel) as (keyof typeof productTypeLabel)[];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT:          { label: "Rascunho",     cls: "bg-surface text-muted" },
  PUBLISHED:      { label: "Publicado",    cls: "bg-turq-lo text-turq" },
  PENDING_REVIEW: { label: "Em revisão",   cls: "bg-warning-lo text-warning" },
  REJECTED:       { label: "Rejeitado",    cls: "bg-danger-lo text-danger" },
  SUSPENDED:      { label: "Suspenso",     cls: "bg-danger-lo text-danger" },
  ARCHIVED:       { label: "Arquivado",    cls: "bg-surface text-faint" },
  APPROVED:       { label: "Aprovado",     cls: "bg-electric-lo text-electric-hi" },
};

const TYPE_ICON: Record<string, string> = {
  TRAINING_PLAN: "🏃", COACHING_SERVICE: "🧠", ASSESSMENT_SERVICE: "📊",
  PERIODIZATION_TEMPLATE: "📅", WORKOUT_TEMPLATE_PACK: "💪",
  EXERCISE_LIBRARY_PACK: "🗂️", EDUCATIONAL_CONTENT: "📚",
  CONSULTATION: "🎯", EVENT_PROGRAM: "🏆",
};

export default function SellerDashboardPage() {
  const { checked } = useRequireRole("TRAINER");
  const [data, setData]   = useState<SellerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ dashboard: SellerDashboard }>("/api/marketplace/seller")
      .then((r) => setData(r.dashboard))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro ao carregar."));
  }, []);

  useEffect(() => { if (checked) load(); }, [checked, load]);

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
        <div className={uiClasses.wide}>
          <div className="grid grid-cols-3 gap-3">
            {[0,1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-kpi-bg" />)}
          </div>
        </div>
      </main>
    );
  }

  const totalSales   = data?.products.reduce((s, p) => s + p.salesCount, 0) ?? 0;
  const publishedCnt = data?.products.filter((p) => p.isPublished).length ?? 0;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className={uiClasses.eyebrow}>Vendedor</span>
            <h1 className={uiClasses.heading}>Meu marketplace</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/marketplace" className={uiClasses.buttonSecondary + " text-sm"}>
              Ver vitrine →
            </Link>
          </div>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {/* ── ONBOARDING (sem perfil) ─────────────────────────── */}
        {data && !data.profile && (
          <SellerOnboarding busy={busy} onCreate={(body) => run(() => createProfile(body))} />
        )}

        {data && data.profile && (
          <>
            {/* ── WALLET BANNER ────────────────────────────────── */}
            {!data.profile.hasWallet && (
              <WalletBanner
                displayName={data.profile.displayName}
                busy={busy}
                onSave={(walletId) =>
                  run(() => createProfile({ displayName: data.profile!.displayName, asaasWalletId: walletId }))
                }
              />
            )}

            {/* ── KPI ROW ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Produtos publicados" value={publishedCnt} tone="turq" />
              <KpiCard label="Total de vendas"     value={totalSales}   tone="electric" />
              <KpiCard label="Total de produtos"   value={data.products.length} />
              <KpiCard
                label="Perfil"
                value={data.profile.displayName}
                tone="default"
                small
              />
            </div>

            {/* ── LISTA DE PRODUTOS ────────────────────────────── */}
            <section className="flex flex-col gap-4">
              <div className={uiClasses.sectionHeader}>
                <h2 className={uiClasses.subheading}>Meus produtos</h2>
                <button
                  type="button"
                  onClick={() => setShowForm((v) => !v)}
                  className={uiClasses.button + " text-sm"}
                >
                  <PlusIcon width={16} height={16} />
                  Novo produto
                </button>
              </div>

              {/* Form de novo produto — expansível */}
              {showForm && (
                <ProductForm
                  busy={busy}
                  onCreate={(body) => run(() => createProduct(body)).then(() => setShowForm(false))}
                  onCancel={() => setShowForm(false)}
                />
              )}

              <ProductList
                products={data.products}
                busy={busy}
                onPublish={(id) => run(() => publishProduct(id))}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// ── API helpers ──────────────────────────────────────────────────────────────
function createProfile(body: { displayName: string; headline?: string; asaasWalletId?: string }) {
  return apiFetch("/api/marketplace/seller", { method: "POST", body: JSON.stringify(body) });
}
function createProduct(body: unknown) {
  return apiFetch("/api/marketplace/seller/products", { method: "POST", body: JSON.stringify(body) });
}
function publishProduct(id: string) {
  return apiFetch(`/api/marketplace/seller/products/${id}/publish`, { method: "POST" });
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, tone = "default", small = false,
}: { label: string; value: string | number; tone?: "turq" | "electric" | "orange" | "default"; small?: boolean }) {
  const valCls = {
    turq:    "text-turq",
    electric:"text-electric-hi",
    orange:  "text-orange-hi",
    default: "text-ink",
  }[tone];
  return (
    <div className={`flex flex-col gap-1.5 rounded-2xl border border-line bg-kpi-bg p-4`}>
      <span className={uiClasses.eyebrow}>{label}</span>
      <span className={`tabular font-display font-bold leading-none ${small ? "text-xl" : "text-3xl"} ${valCls}`}>
        {value}
      </span>
    </div>
  );
}

function SellerOnboarding({
  busy, onCreate,
}: {
  busy: boolean;
  onCreate: (body: { displayName: string; headline?: string; asaasWalletId?: string }) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline]       = useState("");
  const [walletId, setWalletId]       = useState("");

  return (
    <section className={uiClasses.panel}>
      <div className="border-b border-line px-6 py-4">
        <h2 className={uiClasses.subheading}>Criar perfil de vendedor</h2>
        <p className="mt-0.5 text-sm text-muted">Configure seu perfil público para começar a vender.</p>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div>
          <label className={uiClasses.label}>Nome público *</label>
          <input
            className={uiClasses.input}
            placeholder="Ex.: Studio Corpo & Movimento"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className={uiClasses.label}>Chamada curta</label>
          <input
            className={uiClasses.input}
            placeholder="Ex.: Especialista em corrida e força"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </div>
        <div>
          <label className={uiClasses.label}>Carteira Asaas (walletId)</label>
          <input
            className={uiClasses.input}
            placeholder="Para receber os 90% das vendas"
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
          />
          <p className="mt-1 text-xs text-faint">Pode configurar depois. Sem carteira, vendas ficam retidas.</p>
        </div>
        <button
          type="button"
          disabled={busy || displayName.trim().length < 2}
          onClick={() => onCreate({
            displayName: displayName.trim(),
            headline: headline.trim() || undefined,
            asaasWalletId: walletId.trim() || undefined,
          })}
          className={uiClasses.button}
        >
          Criar perfil
        </button>
      </div>
    </section>
  );
}

function WalletBanner({
  displayName, busy, onSave,
}: { displayName: string; busy: boolean; onSave: (walletId: string) => void }) {
  const [walletId, setWalletId] = useState("");
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-lo p-5">
      <div className="flex items-start gap-3">
        <span className="text-warning text-xl shrink-0">⚠️</span>
        <div>
          <h2 className="font-semibold text-ink">Configure sua carteira de repasse</h2>
          <p className="mt-1 text-sm text-muted">
            {displayName}, informe seu <strong>walletId</strong> do Asaas para receber 90% de cada venda.
            Sem ele, os pagamentos não podem ser cobrados em produção.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
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
          className={uiClasses.button + " shrink-0"}
        >
          Salvar
        </button>
      </div>
    </section>
  );
}

function ProductForm({
  busy, onCreate, onCancel,
}: { busy: boolean; onCreate: (body: unknown) => void; onCancel: () => void }) {
  const [title,            setTitle]            = useState("");
  const [productType,      setProductType]      = useState<string>("TRAINING_PLAN");
  const [price,            setPrice]            = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription,  setFullDescription]  = useState("");
  const [modality,         setModality]         = useState("");
  const [level,            setLevel]            = useState("");
  const [durationWeeks,    setDurationWeeks]    = useState("");
  const [sessionsPerWeek,  setSessionsPerWeek]  = useState("");

  const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
  const valid = title.trim().length >= 3 && Number.isInteger(priceCents) && priceCents > 0;

  return (
    <section className={uiClasses.panel + " animate-fade-up"}>
      <div className="border-b border-line px-6 py-4">
        <h2 className={uiClasses.subheading}>Novo produto</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        {/* Título */}
        <div className="sm:col-span-2">
          <label className={uiClasses.label}>Título *</label>
          <input className={uiClasses.input} placeholder="Nome do produto" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Tipo + Preço */}
        <div>
          <label className={uiClasses.label}>Tipo *</label>
          <select className={uiClasses.select} value={productType} onChange={(e) => setProductType(e.target.value)}>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_ICON[t]} {productTypeLabel[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={uiClasses.label}>Preço (R$) *</label>
          <input className={uiClasses.input} inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        {/* Descrição curta */}
        <div className="sm:col-span-2">
          <label className={uiClasses.label}>Descrição curta</label>
          <input className={uiClasses.input} placeholder="Uma linha que aparece no card do catálogo" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        </div>

        {/* Modalidade + Nível */}
        <div>
          <label className={uiClasses.label}>Modalidade</label>
          <input className={uiClasses.input} placeholder="Ex.: Corrida, Musculação…" value={modality} onChange={(e) => setModality(e.target.value)} />
        </div>
        <div>
          <label className={uiClasses.label}>Nível</label>
          <input className={uiClasses.input} placeholder="Iniciante / Intermediário / Avançado" value={level} onChange={(e) => setLevel(e.target.value)} />
        </div>

        {/* Duração + Frequência */}
        <div>
          <label className={uiClasses.label}>Duração (semanas)</label>
          <input className={uiClasses.input} inputMode="numeric" placeholder="Ex.: 12" value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} />
        </div>
        <div>
          <label className={uiClasses.label}>Frequência (treinos/semana)</label>
          <input className={uiClasses.input} inputMode="numeric" placeholder="Ex.: 5" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} />
        </div>

        {/* Descrição longa */}
        <div className="sm:col-span-2">
          <label className={uiClasses.label}>Descrição completa</label>
          <textarea className={uiClasses.textarea} rows={5} placeholder="Descreva em detalhes o que o comprador vai receber, objetivos, diferenciais…" value={fullDescription} onChange={(e) => setFullDescription(e.target.value)} />
        </div>

        {/* Ações */}
        <div className="flex gap-3 sm:col-span-2">
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => onCreate({
              title: title.trim(),
              productType,
              priceCents,
              shortDescription: shortDescription.trim() || undefined,
              fullDescription: fullDescription.trim() || undefined,
              modality: modality.trim() || undefined,
              level: level.trim() || undefined,
              durationWeeks: durationWeeks ? Number(durationWeeks) : undefined,
              sessionsPerWeek: sessionsPerWeek ? Number(sessionsPerWeek) : undefined,
            })}
            className={uiClasses.button}
          >
            Salvar rascunho
          </button>
          <button type="button" onClick={onCancel} className={uiClasses.buttonGhost}>
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}

function ProductList({
  products, busy, onPublish,
}: { products: SellerDashboard["products"]; busy: boolean; onPublish: (id: string) => void }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
        <span className="text-4xl" aria-hidden="true">📦</span>
        <p className="text-sm text-muted">Você ainda não tem produtos.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {products.map((p) => {
        const meta = STATUS_META[p.status] ?? { label: p.status, cls: "bg-surface text-muted" };
        return (
          <li
            key={p.id}
            className="flex items-center gap-4 rounded-2xl border border-line bg-petrol p-4 transition-colors hover:border-line-strong"
          >
            {/* Ícone */}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-xl" aria-hidden="true">
              {TYPE_ICON[p.productType] ?? "📦"}
            </span>

            {/* Info */}
            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <span className={uiClasses.eyebrow}>{productTypeLabel[p.productType]}</span>
              <span className="truncate font-semibold text-ink">{p.title}</span>
              <span className="text-xs text-muted">
                {formatPriceCents(p.priceCents)}
                {p.salesCount > 0 && ` · ${p.salesCount} venda${p.salesCount !== 1 ? "s" : ""}`}
              </span>
            </div>

            {/* Status badge */}
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>
              {meta.label}
            </span>

            {/* Ação */}
            {p.isPublished ? (
              <Link
                href={`/marketplace/produtos/${p.slug}`}
                className="shrink-0 text-xs text-electric-hi hover:underline flex items-center gap-0.5"
              >
                Ver <ChevronRightIcon width={14} height={14} />
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onPublish(p.id)}
                className="shrink-0 rounded-xl border border-turq/40 bg-turq-lo px-3 py-1.5 text-xs font-semibold text-turq transition-colors hover:bg-turq/20 disabled:opacity-50"
              >
                Publicar
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
