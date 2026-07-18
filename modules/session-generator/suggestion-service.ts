import { planWeek, type WeekContext } from "@/modules/periodization/generation-rules";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { PeriodizationActor } from "@/modules/periodization/periodization-service";
import { enrichWeekPlan, type WeekSuggestion } from "./enrich-week";
import type { SuggestionInput } from "./suggestion-schema";

// Serviço do motor de sugestão (Fase 3) — PREVIEW. Reforça o vínculo
// treinador↔atleta, monta o contexto da semana, chama o gerador puro e o
// enriquece com o catálogo científico. NÃO grava nada: é a etapa "o treinador vê
// o porquê antes de gerar/publicar". A persistência segue no fluxo de geração
// assistida já existente (generate-week.ts), que nasce DRAFT.

export async function suggestSessionsForWeek(
  athleteId: string,
  input: SuggestionInput,
  actor: PeriodizationActor,
): Promise<WeekSuggestion> {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);

  const context: WeekContext = {
    goal: input.goal,
    modality: input.modality,
    level: input.level,
    availableWeekdays: input.availableWeekdays,
    phaseName: input.phaseName,
    isRecoveryWeek: input.isRecoveryWeek,
    targetVolumeKm: input.targetVolumeKm,
    targetIntensity: input.targetIntensity,
    weekStartDate: input.weekStartDate,
    weekEndDate: input.weekEndDate,
    includeStrength: input.includeStrength,
  };

  return enrichWeekPlan(planWeek(context), context);
}
