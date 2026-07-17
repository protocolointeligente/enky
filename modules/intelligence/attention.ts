import { prisma } from "@/infrastructure/database/prisma";
import type { Insight, InsightConfidence, InsightRisk } from "./insight";
import { computeLoadState, type LoadState } from "./load-state";
import { classifyReadiness, type ReadinessResult } from "./readiness";

// ENKY Intelligence — Fase I/II, motor de ATENÇÃO.
//
// A decision engine (docs/ENKY_DECISION_ENGINE.md) encarnada em regras
// determinísticas sobre os dados que já existem (workouts + feedback). Sem
// migration, sem LLM: a verbalização é por template prudente. Cada Insight
// explica a própria origem (sinais usados E ausentes, janela, limitação) e
// NUNCA diagnostica nem estima lesão (ENKY 11, Regras de Saúde).
// Inclui o estado de carga (CTL/ATL/ACWR/ramp) derivado do sRPE.

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
const RECENCY_WINDOW = `Últimos ${RECENCY_DAYS} dias`;
const LOAD_WINDOW = `Carga dos últimos ${LOAD_DAYS} dias — aguda (7d) vs. crônica (42d)`;
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
  readinessCount: number; // check-ins de prontidão na janela recente
  readiness: ReadinessResult | null; // classificação do check-in mais recente
}

// Limitação estrutural, não lacuna deste atleta: vale para todo insight.
const NO_WEARABLE = "Sono e HRV objetivos (o sistema não recebe dados de wearable)";

// O que o motor NÃO tinha ao concluir. Explicitar a lacuna é parte do insight:
// o treinador precisa saber o tamanho do ponto cego, não só o sinal que
// disparou. Puro (só lê o bucket).
//
// Dor ausente NÃO entra: o bucket não distingue "sem dor" de "não perguntado"
// (maxPain colapsa os dois em 0), e afirmar a lacuna errada é pior que omitir.
export function absentSignals(b: AthleteBucket): string[] {
  const out: string[] = [];
  if (b.feedbackCount === 0) out.push(`Nenhum retorno do atleta nos últimos ${RECENCY_DAYS} dias`);
  else if (b.maxRpe === 0) out.push("Esforço percebido (RPE) não informado nos retornos");
  if (!b.state || b.state.dataDays < MIN_LOAD_DAYS) {
    out.push(`Histórico de carga insuficiente (menos de ${MIN_LOAD_DAYS} dias com treino)`);
  }
  if (b.readinessCount === 0) out.push("Prontidão diária não respondida pelo atleta");
  out.push(NO_WEARABLE);
  return out;
}

function readinessEvidence(b: AthleteBucket) {
  if (!b.readiness || b.readiness.class === "insuficiente") return [];
  return [{ label: "Prontidão (auto-relato)", value: b.readiness.class }];
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
        readinessCount: 0,
        readiness: null,
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

  // Prontidão entra como SINAL (presente/ausente + classe do último check-in),
  // nunca como regra: a heurística v1 segue experimental e não decide carga
  // sozinha (ver readiness.ts). Serve para o treinador saber o que o motor viu.
  if (buckets.size > 0) {
    const checkIns = await prisma.readinessCheckIn.findMany({
      where: {
        organizationId: actor.organizationId,
        athleteId: { in: [...buckets.keys()] },
        checkInDate: { gte: recencySince },
      },
      orderBy: { checkInDate: "desc" },
      select: {
        athleteId: true,
        sleepHours: true,
        sleepQuality: true,
        fatigue: true,
        soreness: true,
        stress: true,
        motivation: true,
      },
    });
    for (const row of checkIns) {
      const bucket = buckets.get(row.athleteId);
      if (!bucket) continue;
      bucket.readinessCount += 1;
      // Ordenado desc: o primeiro de cada atleta é o mais recente.
      if (bucket.readiness == null) {
        bucket.readiness = classifyReadiness({
          sleepHours: row.sleepHours != null ? Number(row.sleepHours) : null,
          sleepQuality: row.sleepQuality,
          fatigue: row.fatigue,
          soreness: row.soreness,
          stress: row.stress,
          motivation: row.motivation,
        });
      }
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
// Segurança (dor) primeiro; depois carga aguda elevada; depois adesão/RPE.
// Exportada para teste unitário (é a "mente" do motor).
export function evaluate(b: AthleteBucket): Insight | null {
  const base = {
    athleteId: b.athleteId,
    athleteName: b.athleteName,
    engine: "atencao",
    confianca: confidenceFromData(b.feedbackCount),
    sinaisAusentes: absentSignals(b),
    janela: RECENCY_WINDOW,
  };

  if (b.maxPain >= PAIN_THRESHOLD) {
    return {
      ...base,
      risk: "urgente",
      observacao: `Dor relatada nível ${b.maxPain}${b.painRegion ? ` (${b.painRegion})` : ""} em feedback recente.`,
      interpretacao:
        "Dor é um sinal de segurança e se sobrepõe à progressão de carga. É um contexto de cautela, não uma avaliação clínica do atleta.",
      acoesSugeridas: [
        "Considere revisar a próxima sessão intensa deste atleta.",
        "Avalie conversar com o atleta e, se necessário, orientar avaliação profissional.",
      ],
      confianca: base.confianca === "BAIXA" && b.feedbackCount >= 1 ? "MEDIA" : base.confianca,
      limitacoes:
        "Não é um diagnóstico e não estima lesão. O sistema só sabe o que o atleta relatou; a leitura clínica é sua.",
      dadosUsados: [
        { label: "Dor (máx. recente)", value: String(b.maxPain) },
        ...(b.painRegion ? [{ label: "Região", value: b.painRegion }] : []),
        ...readinessEvidence(b),
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
        janela: LOAD_WINDOW,
        observacao: acwrHigh
          ? `Carga elevada: a carga aguda está ${Math.round((s.acwr! - 1) * 100)}% acima da carga crônica recente deste atleta (ACWR ${s.acwr!.toFixed(2)}).`
          : `Carga elevada: subiu +${Math.round(s.rampPct! * 100)}% em relação à semana anterior.`,
        interpretacao:
          "Sinal de contexto: a carga recente saltou em relação ao padrão deste atleta. É um contexto de cautela sobre a progressão, não uma leitura sobre a saúde do atleta.",
        acoesSugeridas: [
          "Revise o contexto (sono, recuperação, agenda) antes de manter a progressão planejada.",
        ],
        limitacoes:
          "ACWR, ramp, monotonia e strain são sinais de contexto sobre a carga — não diagnosticam nem estimam lesão. A leitura descreve o passado deste atleta, não o que vai acontecer.",
        dadosUsados: [
          ...(s.acwr != null ? [{ label: "ACWR", value: s.acwr.toFixed(2) }] : []),
          ...(s.rampPct != null
            ? [{ label: "Ramp", value: `${Math.round(s.rampPct * 100)}%` }]
            : []),
          ...(s.monotony != null ? [{ label: "Monotonia", value: s.monotony.toFixed(1) }] : []),
          { label: "Dias com carga", value: `${s.dataDays}/${LOAD_DAYS}` },
          ...readinessEvidence(b),
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
      interpretacao:
        "Esforço percebido muito alto pode sinalizar fadiga acumulada. É um sinal de atenção sobre a sessão, não uma conclusão sobre o atleta.",
      acoesSugeridas: [
        "Considere confirmar recuperação/sono e monitorar a próxima sessão intensa.",
      ],
      limitacoes: "Sinal isolado e subjetivo (percepção do atleta); não confirma fadiga.",
      dadosUsados: [{ label: "RPE máx.", value: `${b.maxRpe}/10` }, ...readinessEvidence(b)],
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
