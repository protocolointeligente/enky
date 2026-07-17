import type { ActivityMatchStatus, Modality, WorkoutStatus } from "@prisma/client";

// Vínculo REALIZADO → PLANEJADO (item 9 da Fase 11): por data e modalidade.
//
// Regra pura e deliberadamente conservadora. O par é feito quando existe
// EXATAMENTE UM treino planejado candidato; havendo dois, nenhum é escolhido.
//
// Por que não "escolher o mais provável": os candidatos empatados são
// indistinguíveis com os dados que temos — `Workout.plannedDate` é uma data
// civil, sem hora obrigatória (`plannedStartAt` é opcional e raramente
// preenchido), então não há critério de desempate que não seja arbitrário.
// Um par errado é pior que par nenhum: o treinador veria "10km prescritos ×
// 5km realizados" num treino que o atleta cumpriu, e ajustaria a carga do
// atleta para baixo com base numa atribuição que a máquina inventou. Sem par,
// ele vê a atividade avulsa e decide — que é a única coisa honesta a fazer
// quando o dado não decide. Vincular manualmente é trabalho de v2.

// Só treino que o atleta podia executar entra como candidato. DRAFT está fora
// (o atleta nem o vê — ver workout-visibility.ts), assim como CANCELLED,
// ARCHIVED e MISSED — um treino que o sistema já deu como não realizado não
// deve ser ressuscitado por uma atividade que apareceu depois; se o atleta o
// fez, é o treinador quem reabre.
export const MATCHABLE_WORKOUT_STATUSES: readonly WorkoutStatus[] = [
  "PUBLISHED",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
] as const;

export interface MatchCandidate {
  id: string;
  modality: Modality;
  // Um treino que já tem realizado vinculado não é candidato — a relação é 1:1
  // (`ExternalActivity.workoutId` é UNIQUE).
  hasLinkedActivity: boolean;
}

export interface MatchInput {
  modality: Modality | null;
  candidates: readonly MatchCandidate[];
}

export interface MatchDecision {
  status: ActivityMatchStatus;
  workoutId: string | null;
}

export function decideMatch(input: MatchInput): MatchDecision {
  // Atividade cujo tipo não mapeia para nenhuma Modality nossa (`Yoga`,
  // `Walk`, ...) nunca vincula: sem modalidade não há como afirmar que ela
  // cumpre um treino prescrito. Ela é importada e fica avulsa.
  if (!input.modality) return { status: "UNMATCHED", workoutId: null };

  const eligible = input.candidates.filter(
    (candidate) => candidate.modality === input.modality && !candidate.hasLinkedActivity,
  );

  if (eligible.length === 1) {
    return { status: "MATCHED", workoutId: eligible[0]!.id };
  }
  // Dois treinos da mesma modalidade no mesmo dia (duplo período — comum em
  // natação e triatlo). Ver o comentário de topo.
  if (eligible.length > 1) {
    return { status: "AMBIGUOUS", workoutId: null };
  }
  return { status: "UNMATCHED", workoutId: null };
}
