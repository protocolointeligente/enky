import type { AthleteLevel, Modality } from "./generation-rules";

// Modo AUTOMATIC (Fase 6) — o motor deduz do histórico o que, no modo
// ASSISTED, o treinador informa no formulário.
//
// ATENÇÃO AO QUE "AUTOMATIC" **NÃO** É: não é publicar sozinho. `generationMode`
// descreve quem escolheu os parâmetros da prescrição, não quem decide o que o
// atleta vê. Todo treino continua nascendo DRAFT e só é publicado por ação
// explícita do treinador — nos dois modos, sem exceção e sem flag.
//
// Inferir é sempre um palpite sobre o passado: por isso cada campo deduzido
// entra em `inferred` e derruba a confiança do plano. Um palpite silencioso
// seria exatamente a "precisão falsa" que o motor se recusa a vender.

export interface HistoryWorkout {
  modality: string;
  plannedDate: Date;
}

export interface InferredInput {
  modality?: Modality;
  level?: AthleteLevel;
  availableWeekdays?: number[];
  /** Campos que vieram de dedução, não do treinador. */
  inferred: string[];
  /** Por que cada dedução foi possível (ou não). Vai para o rationale. */
  notes: string[];
}

// Quantos treinos passados bastam para a dedução deixar de ser adivinhação.
// Abaixo disso preferimos não deduzir a deduzir mal: 2 treinos não revelam
// uma rotina semanal.
const MIN_HISTORY = 4;

function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1; // 1=segunda … 7=domingo
}

// Dedução a partir do histórico recente do atleta. Pura: recebe as linhas,
// devolve o palpite — sem Prisma, testável direto.
export function inferFromHistory(history: HistoryWorkout[]): InferredInput {
  const inferred: string[] = [];
  const notes: string[] = [];

  if (history.length < MIN_HISTORY) {
    notes.push(
      `Histórico insuficiente para deduzir (${history.length} treino(s), mínimo ${MIN_HISTORY}). Informe modalidade e disponibilidade em vez de deixar o motor adivinhar.`,
    );
    return { inferred, notes };
  }

  // Modalidade: a mais frequente no histórico. Empate resolve pela ordem de
  // aparição — não inventamos desempate que o dado não sustenta.
  const byModality = new Map<string, number>();
  for (const workout of history) {
    byModality.set(workout.modality, (byModality.get(workout.modality) ?? 0) + 1);
  }
  const [topModality, topCount] = [...byModality.entries()].reduce((best, entry) =>
    entry[1] > best[1] ? entry : best,
  );
  const modality = topModality as Modality;
  inferred.push("modality");
  notes.push(
    `Modalidade deduzida: ${topModality} (${topCount} de ${history.length} treinos recentes).`,
  );

  // Disponibilidade: dias da semana em que o atleta de fato treinou. Só entram
  // os dias que se repetem — um treino solto numa terça não vira rotina.
  const byWeekday = new Map<number, number>();
  for (const workout of history) {
    const day = isoWeekday(workout.plannedDate);
    byWeekday.set(day, (byWeekday.get(day) ?? 0) + 1);
  }
  const recurring = [...byWeekday.entries()]
    .filter(([, count]) => count >= 2)
    .map(([day]) => day)
    .sort((a, b) => a - b);

  const availableWeekdays = recurring.length > 0 ? recurring : undefined;
  if (availableWeekdays) {
    inferred.push("availableWeekdays");
    notes.push(
      `Disponibilidade deduzida dos dias em que o atleta treinou mais de uma vez: ${availableWeekdays.join(", ")} (1=segunda).`,
    );
  } else {
    notes.push(
      "Nenhum dia da semana se repetiu no histórico — disponibilidade não pôde ser deduzida.",
    );
  }

  // Nível NÃO é deduzido. Volume de treino não é nível: um iniciante
  // disciplinado treina 5x/semana e um avançado em recuperação treina 3x.
  // Inferir nível daí seria inventar um dado que o sistema não tem.
  notes.push(
    "Nível não é deduzido do histórico: frequência não é nível. Sem o nível informado, o motor assume intermediário e rebaixa a confiança.",
  );

  return { modality, availableWeekdays, inferred, notes };
}
