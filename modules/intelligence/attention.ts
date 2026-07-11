import { prisma } from "@/infrastructure/database/prisma";
import type { Insight, InsightConfidence, InsightRisk } from "./insight";
import { computeLoadState, type LoadState } from "./load-state";

// ENKY Intelligence — Fase I/II, motor de ATENÇÃO.
//
// A decision engine (docs/ENKY_DECISION_ENGINE.md) encarnada em regras
// determinísticas sobre os dados que já existem (workouts + feedback). Sem
// migration, sem LLM: a verbalização é por template prudente. Cada Insight
// segue o formato de 6 partes e NUNCA diagnostica (ENKY 11, Regras de Saúde).
// Agora inclui o estado de carga (CTL/ATL/ACWR/ramp) derivado do sRPE.

export interface IntelligenceActor {
  organizationId: string;
  trainerProfileId: string;
}

const RECENCY_DAYS = 28; // janela dos sinais recentes (dor/RPE/perdidos)
const LOAD_DAYS = 90; // janela para a carga crônica (CTL 42d) fazer sentido
const PAIN_THRESHOLD = 4;
const HIGH_RPE = 9;
const ACWR_HIGH = 1.5;
const RAMP_HIGH = 0.3; // +30% de CTL na semana
const MIN_LOAD_DAYS = 10; // mínimo de dias com treino para ler a carga
const REVIEW_STATUSES = new Set(["COMPLETED", "PARTIAL", "MISSED"]);
const RISK_ORDER: Record<InsightRisk, number> = {
  urgente: 3,
  revisar: 2,
  atencao: 1,
  positivo: 0,
};

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
  state: LoadState | null;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Série diária contínua (zero nos dias sem treino), do início da janela até hoje.
function dailySeries(loadByDay: Map<string, number>, since: Date, now: Date): number[] {
  const out: number[] = [];
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    out.push(loadByDay.get(isoDay(cursor)) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function analyzeRosterAttention(
  actor: IntelligenceActor,
  now: Date,
): Promise<Insight[]> {
  const loadSince = new Date(now);
  loadSince.setDate(loadSince.getDate() - LOAD_DAYS);
  const recencySince = new Date(now);
  recencySince.setDate(recencySince.getDate() - RECENCY_DAYS);
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const workouts = await prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      plannedDate: { gte: loadSince },
    },
    select: {
      athleteId: true,
      status: true,
      plannedDate: true,
      athlete: { select: { user: { select: { name: true } } } },
      feedback: {
        select: { painLevel: true, painRegion: true, sessionRpe: true, sessionRpeLoad: true },
      },
    },
  });

  const buckets = new Map<string, AthleteBucket>();
  const loadByAthlete = new Map<string, Map<string, number>>();

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
        state: null,
      };
      buckets.set(workout.athleteId, bucket);
    }

    // Carga interna diária (para CTL/ATL) — janela completa de 90 dias.
    if (workout.feedback?.sessionRpeLoad != null) {
      const day = isoDay(workout.plannedDate);
      let map = loadByAthlete.get(workout.athleteId);
      if (!map) {
        map = new Map();
        loadByAthlete.set(workout.athleteId, map);
      }
      map.set(day, (map.get(day) ?? 0) + Number(workout.feedback.sessionRpeLoad));
    }

    // Sinais recentes — só nos últimos 28 dias.
    if (workout.plannedDate >= recencySince) {
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
  }

  for (const [athleteId, bucket] of buckets) {
    const map = loadByAthlete.get(athleteId) ?? new Map<string, number>();
    bucket.state = computeLoadState(dailySeries(map, loadSince, now));
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
// Segurança (dor) primeiro; depois carga aguda elevada; depois adesão/RPE.
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
      confianca: base.confianca === "BAIXA" && b.feedbackCount >= 1 ? "MEDIA" : base.confianca,
      limitacoes: "Não é um diagnóstico. Sem dados de sono/HRV para contextualizar.",
      dadosUsados: [
        { label: "Dor (máx. recente)", value: String(b.maxPain) },
        ...(b.painRegion ? [{ label: "Região", value: b.painRegion }] : []),
      ],
      regras: ["seguranca:dor-relatada"],
    };
  }

  // Carga aguda elevada (ACWR ou ramp) — exige histórico mínimo de carga.
  const s = b.state;
  if (s && s.dataDays >= MIN_LOAD_DAYS) {
    const acwrHigh = s.acwr != null && s.acwr >= ACWR_HIGH;
    const rampHigh = s.rampPct != null && s.rampPct >= RAMP_HIGH;
    if (acwrHigh || rampHigh) {
      return {
        ...base,
        risk: "revisar",
        observacao: acwrHigh
          ? `Carga aguda ${Math.round((s.acwr! - 1) * 100)}% acima da crônica (ACWR ${s.acwr!.toFixed(2)}).`
          : `Aumento rápido de carga: +${Math.round(s.rampPct! * 100)}% na semana.`,
        interpretacao:
          "Um salto agudo de carga em relação à base pode elevar o risco de má adaptação e fadiga.",
        acoesSugeridas: [
          "Considere reduzir volume/intensidade da próxima sessão intensa e confirmar recuperação.",
        ],
        limitacoes: "ACWR é correlação, não causalidade; sem HRV/sono para confirmar fadiga.",
        dadosUsados: [
          ...(s.acwr != null ? [{ label: "ACWR", value: s.acwr.toFixed(2) }] : []),
          ...(s.rampPct != null
            ? [{ label: "Ramp", value: `${Math.round(s.rampPct * 100)}%` }]
            : []),
          ...(s.monotony != null ? [{ label: "Monotonia", value: s.monotony.toFixed(1) }] : []),
        ],
        regras: [acwrHigh ? "carga:acwr-alto" : "carga:ramp-alto"],
      };
    }
  }

  if (b.missed >= 2) {
    return {
      ...base,
      risk: "revisar",
      observacao: `${b.missed} treinos não realizados nos últimos ${RECENCY_DAYS} dias.`,
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
