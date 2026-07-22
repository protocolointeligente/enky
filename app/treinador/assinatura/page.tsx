"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";

interface SubscriptionView {
  entitlements: {
    planSlug: string;
    planName: string;
    limits: { maxAthletes: number | null; features: string[] };
    subscriptionStatus: string | null;
    isPaid: boolean;
    isDegraded: boolean;
  };
  athleteLimit: { used: number; max: number | null; canAddMore: boolean };
  subscription: {
    id: string;
    status: string;
    planName: string;
    price: number;
    currency: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    cancelledAt: string | null;
  } | null;
  lastPayments: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  INCOMPLETE: "Aguardando pagamento",
  TRIALING: "Período de teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento em atraso",
  UNPAID: "Não paga",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-turq/15 text-turq",
  TRIALING: "bg-electric/15 text-electric-hi",
  INCOMPLETE: "bg-orange/15 text-orange-hi",
  PAST_DUE: "bg-danger/15 text-danger",
  UNPAID: "bg-danger/15 text-danger",
  PAUSED: "bg-surface text-muted",
  CANCELLED: "bg-surface text-faint",
  EXPIRED: "bg-surface text-faint",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Falhou",
  REFUNDED: "Estornado",
  CANCELLED: "Cancelado",
  DISPUTED: "Contestado",
  EXPIRED: "Expirado",
};

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TrainerSubscriptionPage() {
  const { checked } = useRequireRole("TRAINER");
  const [view, setView] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<SubscriptionView>("/api/trainer/billing/subscription")
      .then(setView)
      .catch((e: ApiClientError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/billing/subscription/cancel", { method: "POST" });
      // A confirmação definitiva (status → Cancelada) chega pelo webhook do
      // gateway. A mensagem diz exatamente isso em vez de fingir que já
      // aconteceu — a tela recarregada pode ainda mostrar "Ativa".
      setNotice(
        "Cancelamento solicitado. Assim que o processador de pagamento confirmar, o status será atualizado. Seus dados e seus atletas permanecem intactos.",
      );
      setConfirming(false);
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  const limit = view?.athleteLimit;
  const ent = view?.entitlements;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <header className="flex flex-col gap-1">
          <p className={uiClasses.eyebrow}>Assinatura</p>
          <h1 className={uiClasses.heading}>Sua assinatura</h1>
          <p className={uiClasses.hint}>
            <Link href="/treinador/planos" className={uiClasses.link}>
              Ver todos os planos
            </Link>
          </p>
        </header>

        {error ? <p className={uiClasses.error}>{error}</p> : null}
        {notice ? <p className={uiClasses.success}>{notice}</p> : null}
        {loading ? <p className={uiClasses.hint}>Carregando…</p> : null}

        {view && ent ? (
          <>
            <section className={`${uiClasses.card} flex flex-col gap-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={uiClasses.eyebrow}>Plano em vigor</p>
                  <h2 className={uiClasses.subheading}>{ent.planName}</h2>
                </div>
                {view.subscription ? (
                  <span
                    className={`${uiClasses.badge} ${
                      STATUS_BADGE[view.subscription.status] ?? "bg-surface text-muted"
                    }`}
                  >
                    {STATUS_LABELS[view.subscription.status] ?? view.subscription.status}
                  </span>
                ) : (
                  <span className={`${uiClasses.badge} bg-surface text-muted`}>Plano grátis</span>
                )}
              </div>

              {/* Inadimplência/cancelamento NÃO apagam nada — a tela explica o
                  que mudou (o limite) e o que não mudou (os dados). */}
              {ent.isDegraded ? (
                <p className={uiClasses.error}>
                  Sua assinatura está como{" "}
                  <strong>
                    {STATUS_LABELS[ent.subscriptionStatus ?? ""] ?? ent.subscriptionStatus}
                  </strong>
                  , então sua conta está temporariamente nos limites do plano grátis. Nenhum atleta,
                  treino ou relatório foi removido — ao regularizar o pagamento, tudo volta na hora.
                </p>
              ) : null}

              {view.subscription?.cancelAtPeriodEnd && view.subscription.status !== "CANCELLED" ? (
                <p className={uiClasses.hint}>
                  Cancelamento solicitado — aguardando confirmação do processador de pagamento.
                </p>
              ) : null}

              {view.subscription && view.subscription.status === "ACTIVE" ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className={uiClasses.eyebrow}>Valor</dt>
                    <dd className="text-ink">
                      {money(view.subscription.price, view.subscription.currency)}
                    </dd>
                  </div>
                  {view.subscription.currentPeriodEnd ? (
                    <div>
                      <dt className={uiClasses.eyebrow}>Próxima cobrança</dt>
                      <dd className="text-ink">{day(view.subscription.currentPeriodEnd)}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </section>

            <section className={`${uiClasses.card} flex flex-col gap-2`}>
              <p className={uiClasses.eyebrow}>Uso do plano</p>
              <p className="text-ink">
                <strong>{limit?.used}</strong>{" "}
                {limit?.max === null ? "atletas (ilimitado)" : `de ${limit?.max} atletas`}
              </p>
              {limit && !limit.canAddMore ? (
                <p className={uiClasses.hint}>
                  Você atingiu o limite do plano.{" "}
                  <Link href="/treinador/planos" className={uiClasses.link}>
                    Faça upgrade
                  </Link>{" "}
                  para adicionar mais atletas.
                </p>
              ) : null}
            </section>

            {view.lastPayments.length > 0 ? (
              <section className={`${uiClasses.card} flex flex-col gap-3`}>
                <p className={uiClasses.eyebrow}>Histórico de cobranças</p>
                <ul className="flex flex-col divide-y divide-line">
                  {view.lastPayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-muted">{day(p.createdAt)}</span>
                      <span className="text-ink">{money(p.amount, p.currency)}</span>
                      <span className="text-muted">{PAYMENT_LABELS[p.status] ?? p.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {view.subscription && !["CANCELLED", "EXPIRED"].includes(view.subscription.status) ? (
              <section className={`${uiClasses.card} flex flex-col gap-3`}>
                <p className={uiClasses.eyebrow}>Cancelar assinatura</p>
                <p className={uiClasses.hint}>
                  Ao cancelar, sua conta volta ao plano grátis. Seus atletas, treinos e relatórios
                  continuam salvos — você apenas passa a operar dentro dos limites do plano grátis.
                </p>
                {confirming ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={uiClasses.buttonDanger}
                      onClick={() => void cancel()}
                      disabled={busy}
                    >
                      {busy ? "Cancelando…" : "Confirmar cancelamento"}
                    </button>
                    <button
                      type="button"
                      className={uiClasses.buttonGhost}
                      onClick={() => setConfirming(false)}
                      disabled={busy}
                    >
                      Manter assinatura
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={uiClasses.buttonDanger}
                    onClick={() => setConfirming(true)}
                  >
                    Cancelar assinatura
                  </button>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
