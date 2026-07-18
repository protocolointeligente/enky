import type { Prisma } from "@prisma/client";
import { ValidationError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { PeriodizationActor } from "@/modules/periodization/periodization-service";
import { buildMacrocycle } from "./build-macrocycle";
import type { MacrocycleResult } from "./periodization-engine-types";
import {
  type StrategyInput,
  toEngineLevel,
  toEngineModality,
} from "./strategy-input-schema";

// ============================================================================
// SERVIÇO DO MOTOR ESTRATÉGICO — persistência + autorização (Fase 1, fatia 2).
// ============================================================================
// A ciência vive no motor puro (build-macrocycle.ts). Aqui só:
//  1. reforçamos o vínculo treinador↔atleta (invariante de negócio, não só de
//     sessão — idêntico a createPeriodization);
//  2. chamamos o motor;
//  3. gravamos a proposta como RASCUNHO (isDraft), com a racionalização
//     congelada em `strategyRationale`, e registramos auditoria.
//
// INVARIANTE DE PRODUTO: nada aqui publica treino nem ativa plano. A saída é uma
// periodização-rascunho que o treinador revisa, edita e só então usa para gerar
// sessões (que também nascem DRAFT). O motor propõe; o treinador dispõe.

const DAY_MS_ISO = "T00:00:00.000Z";
function day(iso: string): Date {
  return new Date(`${iso}${DAY_MS_ISO}`);
}

/** Converte a StrategyInput da API nas entradas do motor puro. */
function toEngineInputs(input: StrategyInput) {
  return {
    modality: toEngineModality(input.modality),
    goal: input.goal,
    startDate: input.startDate,
    eventDate: input.eventDate,
    level: toEngineLevel(input.level),
    availableWeekdays: input.availableWeekdays,
    baseWeeklyVolumeKm: input.baseWeeklyVolumeKm,
    includeStrength: input.includeStrength,
  };
}

/** Erro tipado do motor → erro de validação do domínio (400). */
function assertOk(result: MacrocycleResult): asserts result is Extract<MacrocycleResult, { ok: true }> {
  if (!result.ok) throw new ValidationError(result.error.message);
}

// ---------------------------------------------------------------------------
// PREVIEW — só calcula, NÃO grava. Alimenta o "simular antes de salvar" da UI:
// o treinador vê a estrutura + o porquê antes de decidir.
// ---------------------------------------------------------------------------
export async function proposeMacrocycle(
  athleteId: string,
  input: StrategyInput,
  actor: PeriodizationActor,
) {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);
  const result = buildMacrocycle(toEngineInputs(input));
  assertOk(result);
  return result;
}

// ---------------------------------------------------------------------------
// SAVE — grava a proposta como periodização-RASCUNHO + fases + semanas +
// racionalização, tudo numa transação, com auditoria.
// ---------------------------------------------------------------------------
export async function saveMacrocyclePlan(
  athleteId: string,
  input: StrategyInput,
  actor: PeriodizationActor,
) {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);

  const result = buildMacrocycle(toEngineInputs(input));
  assertOk(result);
  const { macrocycle, mesocycles, weeks, rationale, confidence } = result;

  // Racionalização congelada: o que o motor decidiu e por quê, no momento da
  // geração. Nunca relido cru — a UI o exibe; a escrita valida via Zod na API.
  // Cast idiomático do repo (ver insight-store/report-service): objetos de
  // interface não casam com InputJsonValue sem passar por `unknown`.
  const strategyRationale = {
    ...rationale,
    confidence,
    modality: macrocycle.modality,
    level: macrocycle.level,
    totalWeeks: macrocycle.totalWeeks,
  } as unknown as Prisma.InputJsonValue;

  return prisma.$transaction(async (tx) => {
    const periodization = await tx.periodization.create({
      data: {
        organizationId: actor.organizationId,
        athleteId,
        trainerId: actor.trainerProfileId,
        title: input.title,
        goal: input.goal,
        startDate: day(macrocycle.startDate),
        endDate: day(macrocycle.endDate),
        modality: input.modality,
        targetEvent: input.targetEvent ?? null,
        level: input.level ?? null,
        mesocycleCount: mesocycles.length,
        microcycleCount: weeks.length,
        autoGenerate: true,
        isDraft: true, // proposta do motor nasce rascunho — o treinador decide.
        notes: input.notes ?? null,
        strategyRationale,
      },
    });

    // Mesociclos → fases. Guarda o id de cada fase por sequência do mesociclo
    // para as semanas apontarem para a fase certa.
    const phaseIdByMeso = new Map<number, string>();
    for (const meso of mesocycles) {
      const phase = await tx.periodizationPhase.create({
        data: {
          periodizationId: periodization.id,
          name: meso.name,
          sequence: meso.sequence,
          startDate: day(meso.startDate),
          endDate: day(meso.endDate),
          targetIntensity: meso.intensityFocus,
        },
      });
      phaseIdByMeso.set(meso.sequence, phase.id);
    }

    // Microciclos → semanas (com fase, volume-alvo e flag de regenerativa).
    await tx.trainingWeek.createMany({
      data: weeks.map((w) => ({
        periodizationId: periodization.id,
        phaseId: phaseIdByMeso.get(w.mesocycleSequence) ?? null,
        sequence: w.sequence,
        startDate: day(w.startDate),
        endDate: day(w.endDate),
        focus: w.phaseName,
        targetVolume: w.targetVolumeKm ?? null,
        targetIntensity: w.intensityFocus,
        isRecoveryWeek: w.isRecoveryWeek,
      })),
    });

    await recordAuditLog(tx, {
      action: "GENERATE_PERIODIZATION_STRATEGY",
      entityName: "Periodization",
      entityId: periodization.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { periodization, confidence, rationale };
  });
}
