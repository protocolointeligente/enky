import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/server/observability/logger";
import type { ActivityProvider, NormalizedActivity } from "./activity-provider";
import { withFreshAccessToken } from "./external-connection";
import { decideMatch, MATCHABLE_WORKOUT_STATUSES, type MatchCandidate } from "./match-activity";

// Importação de atividades: deduplicar, persistir, vincular.
//
// Duas vias chegam aqui — o webhook (uma atividade) e a importação manual
// (as recentes). Ambas passam por `importActivity`, então a deduplicação e o
// vínculo têm um caminho só: não existe "o jeito do webhook" e "o jeito do
// manual" que possam divergir.

// Janela padrão da importação manual. 30 dias cobre o que interessa comparar
// com o planejado sem varrer o histórico inteiro do atleta a cada clique.
export const MANUAL_IMPORT_WINDOW_DAYS = 30;
export const MANUAL_IMPORT_MAX_ACTIVITIES = 100;

export type ImportOutcome = "imported" | "updated" | "skipped";

export interface ImportResult {
  outcome: ImportOutcome;
  activityId?: string;
  matched: boolean;
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  matched: number;
}

interface ImportScope {
  connectionId: string;
  organizationId: string;
  athleteProfileId: string;
  providerAthleteId: string;
}

// Data civil "YYYY-MM-DD" → o `DateTime @db.Date` que o Prisma espera. UTC
// meia-noite: uma coluna DATE não tem fuso, e usar o fuso do servidor aqui
// deslocaria a data em um dia dependendo de onde o processo roda. Mesma
// convenção que o resto do sistema usa para `Workout.plannedDate`.
function toDateColumn(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

// Busca os candidatos e decide o vínculo. Roda DENTRO da transação da
// atividade para que "decidir" e "gravar" não fiquem separados por uma janela
// em que outro import vincule o mesmo treino.
async function resolveMatch(
  tx: Prisma.TransactionClient,
  scope: ImportScope,
  activity: NormalizedActivity,
) {
  if (!activity.modality) return { status: "UNMATCHED" as const, workoutId: null };

  const candidates = await tx.workout.findMany({
    where: {
      organizationId: scope.organizationId,
      athleteId: scope.athleteProfileId,
      plannedDate: toDateColumn(activity.localDate),
      status: { in: [...MATCHABLE_WORKOUT_STATUSES] },
    },
    select: { id: true, modality: true, externalActivity: { select: { id: true } } },
  });

  const mapped: MatchCandidate[] = candidates.map((candidate) => ({
    id: candidate.id,
    modality: candidate.modality,
    hasLinkedActivity: candidate.externalActivity !== null,
  }));

  return decideMatch({ modality: activity.modality, candidates: mapped });
}

// Importa UMA atividade. Idempotente por construção.
//
// A posse é conferida antes de qualquer escrita: a atividade tem de pertencer
// ao dono da conexão. É o que torna inofensivo um POST de webhook forjado —
// mesmo que alguém nos mande "importe a atividade 999 do atleta X", o dado vem
// do Strava e, se ele disser que a 999 é de outra pessoa, nada é gravado.
export async function importActivity(
  scope: ImportScope,
  activity: NormalizedActivity,
): Promise<ImportResult> {
  if (activity.providerAthleteId && activity.providerAthleteId !== scope.providerAthleteId) {
    logger.warn(
      {
        connectionId: scope.connectionId,
        expected: scope.providerAthleteId,
        received: activity.providerAthleteId,
      },
      "atividade recusada — dono no provedor diverge da conexão",
    );
    return { outcome: "skipped", matched: false };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.externalActivity.findUnique({
        where: {
          provider_providerActivityId: {
            provider: "STRAVA",
            providerActivityId: activity.providerActivityId,
          },
        },
        select: { id: true, workoutId: true, organizationId: true, athleteId: true },
      });

      // JÁ EXISTE: atualiza os campos normalizados (o atleta pode ter corrigido
      // distância ou tipo no Strava, e um evento `update` chega justamente por
      // isso) mas NÃO cria uma segunda linha. É a regra "importação duplicada
      // não duplica atividade" — e a trava real é o índice único abaixo, não
      // este SELECT, que sozinho teria janela de corrida entre o webhook e a
      // importação manual acontecendo ao mesmo tempo.
      if (existing) {
        // A atividade pertence a outro tenant/atleta: alguém está tentando
        // reatribuir. Não é conflito a resolver — é escrita a recusar.
        if (existing.athleteId !== scope.athleteProfileId) {
          logger.warn(
            { activityId: existing.id, connectionId: scope.connectionId },
            "atividade já pertence a outro atleta — atualização recusada",
          );
          return { outcome: "skipped" as const, matched: false };
        }

        // O vínculo só é (re)decidido se ainda não houver um. Um treino já
        // vinculado não é reavaliado: o par existente pode ter sido feito com
        // um estado que já mudou, e refazê-lo a cada `update` faria o vínculo
        // oscilar sem que ninguém tivesse pedido.
        const match = existing.workoutId
          ? { status: "MATCHED" as const, workoutId: existing.workoutId }
          : await resolveMatch(tx, scope, activity);

        const updated = await tx.externalActivity.update({
          where: { id: existing.id },
          data: {
            ...normalizedColumns(activity),
            workoutId: match.workoutId,
            matchStatus: match.status,
            matchedAt: match.workoutId ? new Date() : null,
          },
        });

        return {
          outcome: "updated" as const,
          activityId: updated.id,
          matched: match.status === "MATCHED",
        };
      }

      const match = await resolveMatch(tx, scope, activity);

      const created = await tx.externalActivity.create({
        data: {
          organizationId: scope.organizationId,
          athleteId: scope.athleteProfileId,
          connectionId: scope.connectionId,
          provider: "STRAVA",
          providerActivityId: activity.providerActivityId,
          ...normalizedColumns(activity),
          workoutId: match.workoutId,
          matchStatus: match.status,
          matchedAt: match.workoutId ? new Date() : null,
        },
      });

      await recordAuditLog(tx, {
        action: "IMPORT_EXTERNAL_ACTIVITY",
        entityName: "ExternalActivity",
        entityId: created.id,
        organizationId: scope.organizationId,
        // Sem `userId`: a importação pode vir de um webhook, sem sessão. O
        // caminho manual também é gravado como SYSTEM para que a trilha não
        // dependa de qual via trouxe a atividade — o sujeito do registro é a
        // atividade, e o atleta já está em `entityId`.
        actorType: "SYSTEM",
        reason: `provedor=strava atividade=${activity.providerActivityId} vinculo=${match.status}`,
      });

      return {
        outcome: "imported" as const,
        activityId: created.id,
        matched: match.status === "MATCHED",
      };
    });
  } catch (error) {
    // Corrida real: duas vias importando a mesma atividade ao mesmo tempo. A
    // outra ganhou e já gravou — o resultado desejado (uma linha só) está
    // cumprido. Não é erro.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      logger.info(
        { providerActivityId: activity.providerActivityId },
        "atividade já importada por outra via — deduplicada",
      );
      return { outcome: "skipped", matched: false };
    }
    throw error;
  }
}

function normalizedColumns(activity: NormalizedActivity) {
  return {
    name: activity.name,
    rawType: activity.rawType,
    modality: activity.modality,
    startedAt: activity.startedAt,
    localDate: toDateColumn(activity.localDate),
    timezone: activity.timezone,
    distanceMeters: activity.distanceMeters,
    movingSeconds: activity.movingSeconds,
    elapsedSeconds: activity.elapsedSeconds,
    elevationGainMeters: activity.elevationGainMeters,
    paceSecondsPerKm: activity.paceSecondsPerKm,
  };
}

// Importação manual: as atividades recentes do atleta.
//
// Existe para não depender do webhook. O webhook pode não estar configurado
// (uma instalação sem inscrição criada), pode ter perdido eventos enquanto o
// app estava fora do ar, ou o atleta pode ter conectado hoje um Strava com
// treino da semana passada — que nunca gerará evento. Sem este botão, esses
// casos ficariam invisíveis para sempre.
export async function importRecentActivities(
  provider: ActivityProvider,
  scope: ImportScope,
  now: Date = new Date(),
): Promise<ImportSummary> {
  const after = new Date(now.getTime() - MANUAL_IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const activities = await withFreshAccessToken(provider, scope.connectionId, (accessToken) =>
    provider.listActivities(accessToken, after, MANUAL_IMPORT_MAX_ACTIVITIES),
  );

  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, matched: 0 };

  // Sequencial, não `Promise.all`: são escritas transacionais no mesmo atleta
  // disputando os mesmos treinos candidatos, e o paralelismo aqui só produziria
  // contenção e vínculos decididos com estado desatualizado. São ≤100 linhas.
  for (const activity of activities) {
    // Uma atividade que falha não derruba as outras — a importação é
    // best-effort por item, e o atleta pode reimportar. É a regra "falha de
    // integração não quebra" aplicada dentro do próprio lote.
    try {
      const result = await importActivity(scope, activity);
      summary[result.outcome] += 1;
      if (result.matched) summary.matched += 1;
    } catch (error) {
      summary.skipped += 1;
      logger.warn(
        { providerActivityId: activity.providerActivityId, err: error },
        "falha ao importar atividade — lote continua",
      );
    }
  }

  await prisma.externalConnection.update({
    where: { id: scope.connectionId },
    data: { lastSyncedAt: now },
  });

  return summary;
}
