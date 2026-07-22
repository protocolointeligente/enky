import type { MarketplaceProductType } from "@prisma/client";
import { ValidationError } from "@/domain/errors";

// Contrato do conteúdo vendido e plano de entrega (§22). Puro: decide O QUE
// entregar por tipo de produto; QUEM persiste (cópia de templates, entitlement,
// onboarding) é o serviço transacional, que roda contra banco. Pinar o formato
// aqui tira o `contentSnapshot`/`deliveryPayload` do limbo de Json solto.

// Ids do conteúdo que a versão publicada do produto congela (§6/§7).
export interface MarketplaceContentSnapshot {
  periodizationTemplateId?: string;
  workoutTemplateIds?: string[];
  exerciseIds?: string[];
  contentAssetIds?: string[];
  coachServicePlanId?: string;
}

export type DeliveryAction =
  | { kind: "COPY_PERIODIZATION"; periodizationTemplateId: string }
  | { kind: "COPY_WORKOUT_TEMPLATES"; workoutTemplateIds: string[] }
  | { kind: "GRANT_EXERCISES"; exerciseIds: string[] }
  | { kind: "GRANT_CONTENT"; contentAssetIds: string[] }
  | { kind: "CREATE_COACHING_ONBOARDING"; coachServicePlanId?: string };

export interface DeliveryPlan {
  productType: MarketplaceProductType;
  actions: DeliveryAction[];
  // Serviços humanos (coaching, consulta, avaliação, evento) não ativam acesso
  // automático — criam onboarding pendente e esperam aceite (§22/§25).
  requiresManualStep: boolean;
}

// Entitlement nasce ACTIVE quando a entrega é 100% automática; PENDING quando
// depende de aceite/agendamento humano (§23).
export function initialEntitlementStatus(productType: MarketplaceProductType): "ACTIVE" | "PENDING" {
  return buildDeliveryPlan(productType, snapshotFor(productType)).requiresManualStep ? "PENDING" : "ACTIVE";
}

// snapshot mínimo só para decidir status sem repetir o mapa — evita duplicar a
// classificação automático/manual em dois lugares.
function snapshotFor(productType: MarketplaceProductType): MarketplaceContentSnapshot {
  switch (productType) {
    case "TRAINING_PLAN":
    case "PERIODIZATION_TEMPLATE":
      return { periodizationTemplateId: "_" };
    case "WORKOUT_TEMPLATE_PACK":
      return { workoutTemplateIds: ["_"] };
    case "EXERCISE_LIBRARY_PACK":
      return { exerciseIds: ["_"] };
    case "EDUCATIONAL_CONTENT":
      return { contentAssetIds: ["_"] };
    default:
      return {};
  }
}

function nonEmpty(ids: string[] | undefined): string[] {
  return (ids ?? []).filter((id) => id && id.trim().length > 0);
}

// Um produto publicado não pode depender de conteúdo inexistente (§6): se o
// tipo exige conteúdo e o snapshot não tem, é erro — não uma entrega vazia.
export function buildDeliveryPlan(
  productType: MarketplaceProductType,
  snapshot: MarketplaceContentSnapshot,
): DeliveryPlan {
  const actions: DeliveryAction[] = [];

  switch (productType) {
    case "TRAINING_PLAN": {
      if (snapshot.periodizationTemplateId) {
        actions.push({ kind: "COPY_PERIODIZATION", periodizationTemplateId: snapshot.periodizationTemplateId });
      }
      const templates = nonEmpty(snapshot.workoutTemplateIds);
      if (templates.length > 0) actions.push({ kind: "COPY_WORKOUT_TEMPLATES", workoutTemplateIds: templates });
      if (actions.length === 0) {
        throw new ValidationError("Plano de treino sem periodização nem templates — nada a entregar.");
      }
      return { productType, actions, requiresManualStep: false };
    }
    case "PERIODIZATION_TEMPLATE": {
      if (!snapshot.periodizationTemplateId) {
        throw new ValidationError("Produto de periodização sem template.");
      }
      actions.push({ kind: "COPY_PERIODIZATION", periodizationTemplateId: snapshot.periodizationTemplateId });
      return { productType, actions, requiresManualStep: false };
    }
    case "WORKOUT_TEMPLATE_PACK": {
      const templates = nonEmpty(snapshot.workoutTemplateIds);
      if (templates.length === 0) throw new ValidationError("Pacote de templates vazio.");
      actions.push({ kind: "COPY_WORKOUT_TEMPLATES", workoutTemplateIds: templates });
      return { productType, actions, requiresManualStep: false };
    }
    case "EXERCISE_LIBRARY_PACK": {
      const exercises = nonEmpty(snapshot.exerciseIds);
      if (exercises.length === 0) throw new ValidationError("Pacote de exercícios vazio.");
      actions.push({ kind: "GRANT_EXERCISES", exerciseIds: exercises });
      return { productType, actions, requiresManualStep: false };
    }
    case "EDUCATIONAL_CONTENT": {
      const assets = nonEmpty(snapshot.contentAssetIds);
      if (assets.length === 0) throw new ValidationError("Conteúdo educacional sem arquivos.");
      actions.push({ kind: "GRANT_CONTENT", contentAssetIds: assets });
      return { productType, actions, requiresManualStep: false };
    }
    case "COACHING_SERVICE":
    case "CONSULTATION":
    case "ASSESSMENT_SERVICE":
    case "EVENT_PROGRAM": {
      actions.push({ kind: "CREATE_COACHING_ONBOARDING", coachServicePlanId: snapshot.coachServicePlanId });
      return { productType, actions, requiresManualStep: true };
    }
    default: {
      // Exaustividade: um novo MarketplaceProductType sem mapa de entrega falha aqui.
      const _exhaustive: never = productType;
      throw new ValidationError(`Tipo de produto sem regra de entrega: ${String(_exhaustive)}`);
    }
  }
}
