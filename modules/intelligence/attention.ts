import { prisma } from "@/infrastructure/database/prisma";
import type { Insight, InsightConfidence, InsightRisk } from "./insight";

// ENKY Intelligence — Fase I, motor de ATENÇÃO.
//
// A decision engine (docs/ENKY_DECISION_ENGINE.md) encarnada em regras
// determinísticas sobre os dados que já existem (workouts + feedback). Sem
// migration, sem LLM: a verbalização é por template prudente. Cada Insight
// segue o formato de 6 partes (observação, interpretação, dados usados,
// confiança, limitações, ação) e NUNCA diagnostica (ENKY 11, Regras de Saúde).

export interface IntelligenceActor {
  organizationId: string;
  trainerProfileId: string;
}

const WINDOW_DAYS = 28;
const PAIN_THRESHOLD = 4; // dor moderada ou mais
const HIGH_RPE = 9; // percepção de esforço muito alta
const REVIEW_STATUSES = new Set(["COMPLETED", "PARTIAL", "MISSED"]);
const RISK_ORDER: Record<InsightRisk, number> = {
  urgente: 3,
  revisar: 2,
  atencao: 1,
  positivo: 0,
};

// Confiança escala com a quantidade de dados na janela — dados escassos nunca
// viram certeza (limite inviolável 2 do ENKY 11).
function confidenceFromData(feedbackCount: number): InsightConfidence {
  if (feedbackCount <= 1) return "BAIXA";
  if (feedbackCount <= 4) return "MEDIA";
  return "ALTA";
}

export interface AthleteBucket {
  athleteId: string;
  athleteName: string | null;
  feedbackCount: number;
  maxPain: number;
  painRegion: string | null;
  maxRpe: number;
  missed: number;
  publishedPast: number;
  awaitingReview: number;
}

/**
 * Varre a carteira do treinador e devolve, por atleta que precisa de atenção,
 * um único Insight (o sinal de maior prioridade), ordenado por risco. Escopo
 * sempre por organização + treinador (tenant isolation), como o resto do sistema.
 */
export async function analyzeRosterAttention(
  actor: IntelligenceActor,
  now: Date,
): Promise<Insight[]> {
  const since = new Date(now);
  since.setDate(since.getDate() - WINDOW_DAYS);
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const workouts = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      plannedDate: { gte: since },
    },
    select: {
      athleteId: true,
      status: true,
      plannedDate: true,
      athlete: { select: { user: { select: { name: true } } } },
      feedback: { select: { painLevel: true, painRegion: true, sessionRpe: true } },
    },
  });

  const buckets = new Map<string, AthleteBucket>();
  for (const workout of workouts) {
    let bucket = buckets.get(workout.athleteId);
    if (!bucket) {
      bucket = {
        athleteId: workout.athleteId,
        athleteName: workout.athlete.user?.name ?? null,
        feedbackCount: 0,
        maxPain: 0,
        painRegion: null,
        maxRpe: 0,
        missed: 0,
        publishedPast: 0,
        awaitingReview: 0,
      };
      buckets.set(workout.athleteId, bucket);
    }

    if (workout.status === "MISSED") bucket.missed += 1;
    if (workout.status === "PUBLISHED" && workout.plannedDate < todayMidnight) {
      bucket.publishedPast += 1;
    }
    if (workout.feedback) {
      bucket.feedbackCount += 1;
      if (REVIEW_STATUSES.has(workout.status)) bucket.awaitingReview += 1;
      const pain = workout.feedback.painLevel ?? 0;
      if (pain > bucket.maxPain) {
        bucket.maxPain = pain;
        bucket.painRegion = workout.feedback.painRegion;
      }
      const rpe = workout.feedback.sessionRpe ?? 0;
      if (rpe > bucket.maxRpe) bucket.maxRpe = rpe;
    }
  }

  const insights: Insight[] = [];
  for (const bucket of buckets.values()) {
    const insight = evaluate(bucket);
    if (insight) insights.push(insight);
  }

  insights.sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk]);
  return insights;
}

// Aplica as regras em ordem de prioridade e devolve o Insight de maior risco.
// Segurança (dor) primeiro — sobrepõe tudo (ENKY_DECISION_ENGINE §5.1).
// Exportada para teste unitário (é a "mente" do motor).
export function evaluate(b: AthleteBucket): Insight | null {
  const base = {
    athleteId: b.athleteId,
    athleteName: b.athleteName,
    engine: "atencao",
    confianca: confidenceFromData(b.feedbackCount),
  };

  if (b.maxPain >= PAIN_THRESHOLD) {
    return {
      ...base,
      risk: "urgente",
      observacao: `Dor relatada nível ${b.maxPain}${b.painRegion ? ` (${b.painRegion})` : ""} em feedback recente.`,
      interpretacao:
        "Dor é um sinal de segurança e se sobrepõe à progressão de carga. Pode indicar necessidade de cautela.",
      acoesSugeridas: [
        "Considere revisar a próxima sessão intensa deste atleta.",
        "Avalie conversar com o atleta e, se necessário, orientar avaliação profissional.",
      ],
      // Dor é um fato direto; a confiança na observação é alta, mas a
      // interpretação permanece prudente. Piso em MÉDIA se houver ao menos 1 dado.
      confianca: base.confianca === "BAIXA" && b.feedbackCount >= 1 ? "MEDIA" : base.confianca,
      limitacoes: "Não é um diagnóstico. Sem dados de sono/HRV para contextualizar.",
      dadosUsados: [
        { label: "Dor (máx. recente)", value: String(b.maxPain) },
        ...(b.painRegion ? [{ label: "Região", value: b.painRegion }] : []),
      ],
      regras: ["seguranca:dor-relatada"],
    };
  }

  if (b.missed >= 2) {
    return {
      ...base,
      risk: "revisar",
      observacao: `${b.missed} treinos não realizados nos últimos ${WINDOW_DAYS} dias.`,
      interpretacao:
        "Sequência de treinos perdidos pode indicar sobrecarga, desmotivação ou agenda.",
      acoesSugeridas: ["Considere verificar o motivo com o atleta e ajustar a próxima semana."],
      limitacoes: "O motivo da ausência não é conhecido pelo sistema.",
      dadosUsados: [{ label: "Treinos perdidos", value: String(b.missed) }],
      regras: ["adesao:treinos-perdidos"],
    };
  }

  if (b.maxRpe >= HIGH_RPE) {
    return {
      ...base,
      risk: "revisar",
      observacao: `RPE de sessão muito alto (${b.maxRpe}/10) em treino recente.`,
      interpretacao: "Esforço percebido muito alto pode sinalizar fadiga acumulada.",
      acoesSugeridas: [
        "Considere confirmar recuperação/sono e monitorar a próxima sessão intensa.",
      ],
      limitacoes: "Sinal isolado; sem HRV/sono para confirmar fadiga.",
      dadosUsados: [{ label: "RPE máx.", value: `${b.maxRpe}/10` }],
      regras: ["carga:rpe-alto"],
    };
  }

  if (b.publishedPast >= 2) {
    return {
      ...base,
      risk: "revisar",
      observacao: `${b.publishedPast} treinos publicados já passaram sem retorno do atleta.`,
      interpretacao: "Aderência baixa reduz a qualidade dos dados e da progressão planejada.",
      acoesSugeridas: ["Considere lembrar o atleta de registrar a execução ou ajustar o plano."],
      limitacoes: "Pode ser falta de registro, não necessariamente treino não feito.",
      dadosUsados: [{ label: "Publicados sem retorno", value: String(b.publishedPast) }],
      regras: ["adesao:sem-retorno"],
    };
  }

  if (b.awaitingReview >= 1) {
    return {
      ...base,
      risk: "atencao",
      observacao: `${b.awaitingReview} retorno(s) do atleta aguardando sua revisão.`,
      interpretacao: "Há feedback recente do atleta que ainda não foi revisado.",
      acoesSugeridas: ["Revise os retornos para calibrar a próxima sessão."],
      limitacoes: "Item operacional; não é uma avaliação de risco.",
      dadosUsados: [{ label: "Retornos", value: String(b.awaitingReview) }],
      regras: ["operacional:retorno-pendente"],
    };
  }

  return null;
}
