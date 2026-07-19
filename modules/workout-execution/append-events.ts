import { recordAuditLog } from "@/domain/audit";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { AthleteActor } from "./start-execution";
import type { AppendEventsInput } from "./execution-schema";
import { isTerminal, reduce, type ExecEvent } from "./execution-state";

/**
 * Anexa eventos a uma execução (append-only) e reconcilia o estado. Idempotente:
 * eventos com `idempotencyKey` já visto são ignorados (§17), e eventos que
 * chegam depois de um terminal não reabrem a execução (a redução pura ignora-os).
 * PAUSE/RESUME/COMPLETE/ABANDON são apenas tipos de evento — não há endpoints
 * separados; o status é derivado do fluxo pelo domínio.
 */
export async function appendExecutionEvents(
  executionId: string,
  input: AppendEventsInput,
  actor: AthleteActor,
  now: number,
) {
  const execution = await prisma.workoutExecution.findUnique({ where: { id: executionId } });
  if (
    !execution ||
    execution.organizationId !== actor.organizationId ||
    execution.athleteId !== actor.athleteProfileId
  ) {
    throw new NotFoundError("Execução não encontrada.");
  }

  const wasTerminal = isTerminal(execution.status);

  return prisma.$transaction(async (tx) => {
    // Insere o lote deduplicando por idempotencyKey/sequence (append-only).
    await tx.workoutExecutionEvent.createMany({
      data: input.events.map((e) => ({
        organizationId: actor.organizationId,
        executionId,
        type: e.type,
        sequence: e.sequence,
        // `partial` mora no payload — não vale uma coluna própria (§10: sem inchaço).
        payload: { ...(e.payload ?? {}), ...(e.partial !== undefined ? { partial: e.partial } : {}) },
        occurredAt: new Date(e.occurredAt),
        idempotencyKey: e.idempotencyKey,
      })),
      skipDuplicates: true,
    });

    const stored = await tx.workoutExecutionEvent.findMany({
      where: { executionId },
      orderBy: { sequence: "asc" },
    });

    const domainEvents: ExecEvent[] = stored.map((e) => {
      const payload = (e.payload ?? {}) as { partial?: boolean };
      return {
        type: e.type,
        at: e.occurredAt.getTime(),
        sequence: e.sequence,
        idempotencyKey: e.idempotencyKey,
        partial: payload.partial,
      };
    });

    const snap = reduce(domainEvents, now);

    // Posição atual = último evento que carregou blockIndex/stepIndex.
    const lastPos = [...stored]
      .reverse()
      .map((e) => (e.payload ?? {}) as { blockIndex?: number; stepIndex?: number })
      .find((p) => p.blockIndex !== undefined || p.stepIndex !== undefined);

    // Timestamps de marco derivados dos eventos (não do relógio do servidor).
    const lastOf = (type: string) =>
      [...stored].reverse().find((e) => e.type === type)?.occurredAt ?? null;
    const terminalAt =
      snap.status === "ABANDONED" ? lastOf("ABANDON") : isTerminal(snap.status) ? lastOf("COMPLETE") : null;

    const updated = await tx.workoutExecution.update({
      where: { id: executionId },
      data: {
        status: snap.status,
        elapsedSeconds: snap.elapsedSeconds,
        activeSeconds: snap.activeSeconds,
        currentBlockIndex: lastPos?.blockIndex ?? execution.currentBlockIndex,
        currentStepIndex: lastPos?.stepIndex ?? execution.currentStepIndex,
        pausedAt: snap.status === "PAUSED" ? lastOf("PAUSE") : execution.pausedAt,
        resumedAt: lastOf("RESUME") ?? execution.resumedAt,
        completedAt: snap.status === "COMPLETED" || snap.status === "PARTIALLY_COMPLETED" ? terminalAt : execution.completedAt,
        abandonedAt: snap.status === "ABANDONED" ? terminalAt : execution.abandonedAt,
        syncedAt: new Date(now),
      },
    });

    // Auditar só a transição para terminal, uma única vez (§10: sem volume excessivo).
    if (!wasTerminal && isTerminal(updated.status)) {
      await recordAuditLog(tx, {
        action: updated.status === "ABANDONED" ? "WORKOUT_EXECUTION_ABANDONED" : "WORKOUT_EXECUTION_COMPLETED",
        entityName: "WorkoutExecution",
        entityId: updated.id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
    }

    return updated;
    // ponytail: isolamento padrão (Read Committed). O log é append-only e a
    // redução é determinística sobre TODOS os eventos, então uma corrida de
    // lotes concorrentes no máximo grava um status momentaneamente defasado que
    // se autocorrige no próximo evento/sync. Serializable só traria P2034 no
    // meio do treino sem ganho real.
  });
}
