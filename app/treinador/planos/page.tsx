"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";

interface PlanLimits {
  maxAthletes: number | null;
  features: string[];
}

interface Plan {
  slug: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: string;
  trialDays: number;
  limits: PlanLimits;
  isCurrent: boolean;
}

// Rótulos dos recursos. O banco guarda a chave técnica; a tela nunca mostra
// `exercise_library` cru para o treinador.
const FEATURE_LABELS: Record<string, string> = {
  templates: "Modelos de treino",
  exercise_library: "Biblioteca de exercícios",
  reports: "Relatórios",
  periodization: "Periodização",
  intelligence: "Inteligência ENKY",
  premium_reports: "Relatórios premium",
};

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(price);
}

function athleteLimitLabel(max: number | null): string {
  return max === null ? "Atletas ilimitados" : `Até ${max} atleta${max === 1 ? "" : "s"}`;
}

export default function TrainerPlansPage() {
  const { checked } = useRequireRole("TRAINER");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ plans: Plan[] }>("/api/trainer/billing/plans")
      .then((data) => setPlans(data.plans))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  async function startCheckout(slug: string) {
    setBusy(true);
    setError(null);
    try {
      // O corpo leva apenas o slug e o CPF/CNPJ — nunca o preço exibido na
      // tela. Quem decide quanto cobrar é o servidor, lendo o catálogo.
      const result = await apiFetch<{ redirectUrl: string }>("/api/trainer/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planSlug: slug, taxId }),
      });
      window.location.href = result.redirectUrl;
    } catch (e) {
      setError(e instanceof ApiClientError ? e : "Erro ao iniciar o checkout.");
      setBusy(false);
    }
  }

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-col gap-1">
          <p className={uiClasses.eyebrow}>Planos</p>
          <h1 className={uiClasses.heading}>Escolha o plano da sua operação</h1>
          <p className={uiClasses.hint}>
            Você pode continuar no plano grátis pelo tempo que quiser.{" "}
            <Link href="/treinador/assinatura" className={uiClasses.link}>
              Ver assinatura atual
            </Link>
          </p>
        </header>

        <ErrorNotice error={error} />
        {loading ? <p className={uiClasses.hint}>Carregando planos…</p> : null}

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <section
              key={plan.slug}
              className={`${uiClasses.card} flex flex-col gap-4 ${
                plan.isCurrent ? "border-electric" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className={uiClasses.subheading}>{plan.name}</h2>
                  {plan.isCurrent ? (
                    <span className={`${uiClasses.badge} bg-electric/15 text-electric-hi`}>
                      Plano atual
                    </span>
                  ) : null}
                </div>
                <p className="font-display text-2xl font-bold text-ink">
                  {plan.price === 0 ? "Grátis" : formatPrice(plan.price, plan.currency)}
                  {plan.price > 0 ? (
                    <span className="text-sm font-medium text-muted">
                      {plan.billingCycle === "MENSAL" ? "/mês" : "/ano"}
                    </span>
                  ) : null}
                </p>
                {plan.trialDays > 0 ? (
                  <p className="text-xs font-semibold text-turq">
                    {plan.trialDays} dias grátis para testar
                  </p>
                ) : null}
                {plan.description ? <p className={uiClasses.hint}>{plan.description}</p> : null}
              </div>

              <ul className="flex flex-col gap-1.5 text-sm text-muted">
                <li>• {athleteLimitLabel(plan.limits.maxAthletes)}</li>
                {plan.limits.features.map((feature) => (
                  <li key={feature}>• {FEATURE_LABELS[feature] ?? feature}</li>
                ))}
              </ul>

              <div className="mt-auto">
                {plan.isCurrent ? (
                  <button type="button" className={uiClasses.buttonSecondary} disabled>
                    Seu plano
                  </button>
                ) : plan.price === 0 ? (
                  <p className={uiClasses.hint}>Plano padrão de toda conta.</p>
                ) : checkoutSlug === plan.slug ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void startCheckout(plan.slug);
                    }}
                  >
                    <label className={uiClasses.label} htmlFor={`taxId-${plan.slug}`}>
                      CPF ou CNPJ do responsável
                    </label>
                    <input
                      id={`taxId-${plan.slug}`}
                      className={uiClasses.input}
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      required
                    />
                    <p className="text-xs text-faint">
                      Exigido pelo processador de pagamento para emitir a cobrança. A ENKY não
                      armazena este dado nem dados do seu cartão.
                    </p>
                    <button type="submit" className={uiClasses.button} disabled={busy}>
                      {busy ? "Gerando cobrança…" : "Ir para o pagamento"}
                    </button>
                    <button
                      type="button"
                      className={uiClasses.buttonGhost}
                      onClick={() => setCheckoutSlug(null)}
                      disabled={busy}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    className={uiClasses.button}
                    onClick={() => {
                      setCheckoutSlug(plan.slug);
                      setError(null);
                    }}
                  >
                    Assinar {plan.name}
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
