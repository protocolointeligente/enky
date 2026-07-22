import { z } from "zod";

// `SubscriptionPlan.featuresLimits` é uma coluna Json — o banco não a valida.
// Este schema é a fronteira: nenhum consumidor lê o Json cru, todo mundo passa
// por `parsePlanLimits`. Um plano com limites malformados é um erro de
// operação, e falha fechado (cai no plano grátis), nunca aberto.

// null = ilimitado (plano profissional). Ausente vira o default (null =
// ilimitado) para dimensões novas, para não quebrar catálogos já semeados que
// não as traziam; `maxAthletes` continua obrigatório e nunca vira ilimitado por
// acidente (parse falha → chamador cai em FREE_LIMITS).
const limit = z.number().int().min(0).nullable();

export const planLimitsSchema = z.object({
  maxAthletes: limit,
  // Dimensões configuráveis por plano (Fase 05). Opcionais com default null
  // (ilimitado) — um plano antigo sem elas segue válido. Enforcement: atletas e
  // templates têm ponto de checagem no servidor; treinadores (multiusuário,
  // Fase 6) e armazenamento (uploads, ainda inexistentes) são declarados aqui e
  // ganharão enforcement quando a feature existir.
  maxTrainers: limit.default(null),
  maxTemplates: limit.default(null),
  maxStorageMb: limit.default(null),
  features: z.array(z.string()).default([]),
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;

// Recursos que um plano pode liberar. Strings livres no banco, união fechada
// aqui — um typo em `assertFeature("periodizacao")` vira erro de compilação.
export const PLAN_FEATURES = [
  "templates",
  "exercise_library",
  "reports",
  "periodization",
  "intelligence",
  "premium_reports",
  "integrations",
  "marketplace",
] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const FREE_PLAN_SLUG = "free";

// Fallback do plano grátis, em código.
//
// Precisa existir mesmo com a linha `free` no banco (migração 20260716140000):
// é o que responde quando a organização não tem assinatura ativa E a leitura
// do catálogo falha ou o plano foi desativado por engano. Sem ele, um catálogo
// quebrado deixaria o treinador sem NADA (o produto para) ou, se o código
// fosse permissivo, com TUDO liberado de graça. O grátis continua funcionando
// com limite — que é a regra da Fase 10.
//
// 1 atleta é decisão comercial firmada, não um palpite: o valor já existia no
// catálogo antes desta fase e foi reafirmado. Mantenha em sincronia com a
// linha `free` da migração 20260716140000.
export const FREE_LIMITS: PlanLimits = {
  maxAthletes: 1,
  maxTrainers: 1,
  maxTemplates: 3,
  maxStorageMb: 100,
  features: [],
};

export function parsePlanLimits(raw: unknown): PlanLimits {
  const parsed = planLimitsSchema.safeParse(raw);
  return parsed.success ? parsed.data : FREE_LIMITS;
}
