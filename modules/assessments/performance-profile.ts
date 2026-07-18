import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import type { AssessmentActor } from "./assessment-service";

// Perfil fisiológico consolidado (fatia B). Deriva o valor ATUAL de cada
// indicador a partir das avaliações VÁLIDAS do atleta, com regras explícitas e
// versionadas de seleção. NÃO inventa valor, NÃO diagnostica, NÃO esconde que um
// dado é estimado ou expirou — apenas escolhe a melhor evidência disponível e a
// devolve com procedência. O CÁLCULO de zonas a partir daqui é a fatia C.

export const PROFILE_SELECTION_VERSION = "1.0.0";

export interface ProfileMetric {
  value: number;
  unit: string;
  source: string; // AssessmentSource
  estimated: boolean; // medido vs estimado — nunca escondido
  assessmentId: string;
  assessmentDate: string; // YYYY-MM-DD
  protocolCode: string;
  protocolVersion: string;
  confidence: string; // ConfidenceLevel
  validUntil: string | null;
  expired: boolean; // vencido em relação à data de referência (usado COM aviso)
}

export interface PerformanceProfile {
  athleteId: string;
  referenceDate: string;
  selectionVersion: string;
  metrics: Record<string, ProfileMetric>; // indicadores escalares (FC, VDOT, FTP, CSS…)
  // força: 1RM atual por exercício, com nome resolvido (para a UI escolher).
  oneRepMax: { exerciseId: string; exerciseName: string | null; metric: ProfileMetric }[];
  sourceAssessmentCount: number;
}

// Candidato a um indicador, antes da escolha.
export interface MetricCandidate {
  value: number;
  source: string;
  estimated: boolean;
  assessmentId: string;
  assessmentDate: string;
  protocolCode: string;
  protocolVersion: string;
  confidence: string;
  validUntil: string | null;
}

// Escolha PURA e determinística: prefere não-expirado a expirado, medido a
// estimado, e o mais recente por último critério. Se só houver expirado, devolve
// o melhor expirado com `expired: true` (com aviso, nunca silenciosamente). Sem
// candidatos → null (ausência explícita). Ver PROFILE_SELECTION_VERSION.
export function selectBestMetric(
  candidates: MetricCandidate[],
  referenceDate: string,
): (MetricCandidate & { expired: boolean }) | null {
  if (candidates.length === 0) return null;
  const scored = candidates.map((c) => ({
    ...c,
    expired: c.validUntil != null && c.validUntil < referenceDate,
  }));
  // Menor é melhor: não-expirado(0) < expirado(2); medido(0) < estimado(1).
  const rank = (c: { expired: boolean; estimated: boolean }) =>
    (c.expired ? 2 : 0) + (c.estimated ? 1 : 0);
  scored.sort((a, b) => rank(a) - rank(b) || b.assessmentDate.localeCompare(a.assessmentDate));
  return scored[0] ?? null;
}

// Indicadores escalares e de onde saem. `field` é a chave em measurements; um
// indicador pode vir de mais de um tipo (FC de limiar vem de FC ou ciclismo).
const SCALAR_METRICS: { key: string; unit: string; field: string; types: string[] }[] = [
  { key: "maximumHeartRate", unit: "bpm", field: "maximumHeartRate", types: ["HEART_RATE"] },
  { key: "restingHeartRate", unit: "bpm", field: "restingHeartRate", types: ["HEART_RATE"] },
  { key: "thresholdHeartRate", unit: "bpm", field: "thresholdHeartRate", types: ["HEART_RATE", "CYCLING"] },
  { key: "vdot", unit: "vdot", field: "vdot", types: ["RUNNING"] },
  { key: "vam", unit: "km/h", field: "vam", types: ["RUNNING"] },
  { key: "criticalSpeed", unit: "km/h", field: "criticalSpeed", types: ["RUNNING"] },
  { key: "thresholdPace", unit: "s/km", field: "thresholdPace", types: ["RUNNING"] },
  { key: "ftp", unit: "W", field: "ftp", types: ["CYCLING"] },
  { key: "criticalPower", unit: "W", field: "criticalPower", types: ["CYCLING"] },
  { key: "css", unit: "s/100m", field: "css", types: ["SWIMMING"] },
];

interface AssessmentRow {
  id: string;
  assessmentType: string;
  source: string;
  assessmentDate: Date;
  validUntil: Date | null;
  protocolCode: string;
  protocolVersion: string;
  confidence: string;
  measurements: unknown;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function candidateFrom(
  row: AssessmentRow,
  value: number,
  estimated: boolean,
): MetricCandidate {
  return {
    value,
    source: row.source,
    estimated,
    assessmentId: row.id,
    assessmentDate: isoDay(row.assessmentDate),
    protocolCode: row.protocolCode,
    protocolVersion: row.protocolVersion,
    confidence: row.confidence,
    validUntil: row.validUntil ? isoDay(row.validUntil) : null,
  };
}

export async function getCurrentAthletePerformanceProfile(
  athleteId: string,
  actor: AssessmentActor,
  referenceDate: Date = new Date(),
): Promise<PerformanceProfile> {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);

  // Só VÁLIDAS entram no perfil (DRAFT/SUPERSEDED/INVALID ficam de fora).
  // A EXPIRAÇÃO é derivada de validUntil na hora da leitura, com aviso.
  const rows = (await prisma.assessment.findMany({
    where: { organizationId: actor.organizationId, athleteId, status: "VALID" },
    orderBy: { assessmentDate: "desc" },
    select: {
      id: true,
      assessmentType: true,
      source: true,
      assessmentDate: true,
      validUntil: true,
      protocolCode: true,
      protocolVersion: true,
      confidence: true,
      measurements: true,
    },
  })) as AssessmentRow[];

  const refIso = isoDay(referenceDate);
  const metrics: Record<string, ProfileMetric> = {};

  for (const metric of SCALAR_METRICS) {
    const candidates: MetricCandidate[] = [];
    for (const row of rows) {
      if (!metric.types.includes(row.assessmentType)) continue;
      const value = numOrNull(asRecord(row.measurements)[metric.field]);
      if (value == null) continue;
      // FC máxima estimada por idade conta como estimada, mesmo que o header
      // não diga — não substituir uma FC máx medida por uma estimada.
      const estimated =
        row.source === "ESTIMATED" ||
        (metric.field === "maximumHeartRate" &&
          asRecord(row.measurements).measurementMethod === "ESTIMADA_POR_IDADE");
      candidates.push(candidateFrom(row, value, estimated));
    }
    const best = selectBestMetric(candidates, refIso);
    if (best) {
      const { value, source, estimated, assessmentId, assessmentDate, protocolCode, protocolVersion, confidence, validUntil, expired } = best;
      metrics[metric.key] = {
        value,
        unit: metric.unit,
        source,
        estimated,
        assessmentId,
        assessmentDate,
        protocolCode,
        protocolVersion,
        confidence,
        validUntil,
        expired,
      };
    }
  }

  // Força: 1RM por exercício (measurements.exerciseId). Valor direto tem
  // prioridade; só estimativa marca estimated=true.
  const byExercise = new Map<string, MetricCandidate[]>();
  for (const row of rows) {
    if (row.assessmentType !== "STRENGTH") continue;
    const m = asRecord(row.measurements);
    const exerciseId = typeof m.exerciseId === "string" ? m.exerciseId : null;
    if (!exerciseId) continue;
    const direct = numOrNull(m.oneRepMax);
    const value = direct ?? numOrNull(m.estimatedOneRepMax);
    if (value == null) continue;
    const estimated = direct == null || row.source === "ESTIMATED";
    const list = byExercise.get(exerciseId) ?? [];
    list.push(candidateFrom(row, value, estimated));
    byExercise.set(exerciseId, list);
  }

  const exerciseNames = new Map<string, string>();
  if (byExercise.size > 0) {
    const names = await prisma.exercise.findMany({
      where: { id: { in: [...byExercise.keys()] } },
      select: { id: true, name: true },
    });
    for (const e of names) exerciseNames.set(e.id, e.name);
  }

  const oneRepMax: PerformanceProfile["oneRepMax"] = [];
  for (const [exerciseId, candidates] of byExercise) {
    const best = selectBestMetric(candidates, refIso);
    if (best) {
      oneRepMax.push({
        exerciseId,
        exerciseName: exerciseNames.get(exerciseId) ?? null,
        metric: { ...best, unit: "kg" },
      });
    }
  }

  return {
    athleteId,
    referenceDate: refIso,
    selectionVersion: PROFILE_SELECTION_VERSION,
    metrics,
    oneRepMax,
    sourceAssessmentCount: rows.length,
  };
}
