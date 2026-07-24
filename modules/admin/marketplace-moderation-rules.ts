// Regras PURAS de transição de moderação (§16.1), sem DB — testáveis. A máquina
// de estados do produto vive aqui; o serviço só aplica. `PUBLISHED` é estado do
// vendedor (publica um APPROVED) mas pode ser suspenso/arquivado pela moderação.

export type ProductStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "SUSPENDED"
  | "ARCHIVED";

export type ModerationAction = "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE" | "ARCHIVE";

interface Rule {
  from: readonly ProductStatus[];
  to: ProductStatus;
  reasonRequired: boolean;
}

export const MODERATION_RULES: Record<ModerationAction, Rule> = {
  APPROVE: { from: ["PENDING_REVIEW"], to: "APPROVED", reasonRequired: false },
  REJECT: { from: ["PENDING_REVIEW"], to: "REJECTED", reasonRequired: true },
  SUSPEND: { from: ["APPROVED", "PUBLISHED"], to: "SUSPENDED", reasonRequired: true },
  REINSTATE: { from: ["SUSPENDED"], to: "APPROVED", reasonRequired: false },
  ARCHIVE: {
    from: ["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "REJECTED", "SUSPENDED"],
    to: "ARCHIVED",
    reasonRequired: false,
  },
};

/** Destino da transição, ou null se a ação não é permitida a partir do status atual. */
export function transitionTarget(action: ModerationAction, current: ProductStatus): ProductStatus | null {
  const rule = MODERATION_RULES[action];
  return rule.from.includes(current) ? rule.to : null;
}

export function reasonRequired(action: ModerationAction): boolean {
  return MODERATION_RULES[action].reasonRequired;
}
