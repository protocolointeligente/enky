import type { Modality } from "@prisma/client";
import type { NormalizedActivity } from "./activity-provider";

// Tradução PURA do JSON do Strava para o vocabulário da ENKY. Sem rede, sem
// banco, sem relógio — é aqui que mora a regra de normalização da Fase 11
// (item 8), e é por isso que ela é testável sem mockar nada.
//
// Princípio: normalizar é DESCARTAR informação com critério. Tudo que a
// normalização decidiu não representar continua recuperável via `rawType` —
// nunca inventamos um valor para preencher campo.

// `sport_type` do Strava → Modality da ENKY.
//
// O Strava tem ~50 tipos e nós temos 6 modalidades. O mapa cobre o que um
// atleta orientado por treinador de fato registra; o resto vira `null`
// deliberadamente — a atividade É importada (é volume real do atleta e o
// treinador precisa vê-la), ela só não participa do vínculo automático por
// modalidade. Fingir que "Yoga" é FUNCTIONAL vincularia yoga a um treino de
// funcional prescrito, e o treinador leria como sessão cumprida.
//
// TRIATHLON não aparece no mapa de propósito: o Strava registra o triatlo como
// três atividades separadas (Swim, Ride, Run), não uma. Mapear qualquer uma
// delas para TRIATHLON quebraria o vínculo das três.
const MODALITY_BY_SPORT_TYPE: Record<string, Modality> = {
  Run: "RUNNING",
  TrailRun: "RUNNING",
  VirtualRun: "RUNNING",
  Treadmill: "RUNNING",

  Ride: "CYCLING",
  VirtualRide: "CYCLING",
  GravelRide: "CYCLING",
  MountainBikeRide: "CYCLING",
  EBikeRide: "CYCLING",
  EMountainBikeRide: "CYCLING",
  Handcycle: "CYCLING",

  Swim: "SWIMMING",

  WeightTraining: "STRENGTH",

  Crossfit: "FUNCTIONAL",
  HighIntensityIntervalTraining: "FUNCTIONAL",
  Workout: "FUNCTIONAL",
};

export function mapModality(sportType: string): Modality | null {
  return MODALITY_BY_SPORT_TYPE[sportType] ?? null;
}

// Corpo da atividade do Strava, só com o que consumimos. Todo campo é opcional
// porque o Strava os omite conforme o dispositivo e a privacidade da conta —
// tratar qualquer um como garantido é como esta integração quebraria em
// produção com dado real.
export interface StravaActivityPayload {
  id?: number | string;
  athlete?: { id?: number | string };
  name?: string;
  sport_type?: string;
  type?: string;
  start_date?: string;
  start_date_local?: string;
  timezone?: string;
  distance?: number; // metros, float
  moving_time?: number; // segundos
  elapsed_time?: number; // segundos
  total_elevation_gain?: number; // metros, float
}

// Um número do provedor só é aceito se for finito e não-negativo. `NaN`,
// `Infinity` e negativo viram null em vez de contaminar a comparação
// planejado × realizado (o banco tem CHECKs equivalentes como última linha de
// defesa — ver a migração).
function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function roundedOrNull(value: unknown): number | null {
  const parsed = positiveNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

// Ritmo médio em s/km, a partir do tempo EM MOVIMENTO (não do decorrido):
// pace é uma medida de deslocamento e o Strava já exclui as paradas do
// `moving_time`. Usar `elapsed_time` faria um semáforo virar perda de ritmo.
//
// Canônico em s/km para toda modalidade de distância, natação inclusive —
// mesma decisão da Fase 6 ("o volume é sempre km"). Converter para min/100m ou
// km/h é trabalho da UI, que sabe a modalidade.
//
// O piso de 1 metro evita divisão por ~0 gerando pace astronômico numa
// atividade de distância nula (comum em treino de força registrado no Strava).
export function computePaceSecondsPerKm(
  distanceMeters: number | null,
  movingSeconds: number | null,
): number | null {
  if (distanceMeters === null || movingSeconds === null) return null;
  if (distanceMeters < 1 || movingSeconds < 1) return null;
  return Math.round(movingSeconds / (distanceMeters / 1000));
}

// A data civil do treino. O Strava manda `start_date_local` como um ISO SEM
// offset ("2026-07-16T06:30:00Z") cujo "Z" é MENTIRA: o instante já foi
// deslocado para o fuso do atleta e o sufixo é um artefato do formato deles.
// Por isso fatiamos os 10 primeiros caracteres em vez de construir um `Date` —
// `new Date(...)` aplicaria o fuso do servidor por cima de um valor que já está
// no fuso certo, e um treino das 22h no Brasil viraria o dia seguinte no
// servidor em UTC. É exatamente o bug que a diretriz temporal do schema (§5)
// existe para prevenir, e o lado direito do vínculo com `Workout.plannedDate`.
export function extractLocalDate(startDateLocal: string): string {
  return startDateLocal.slice(0, 10);
}

export class ActivityNormalizationError extends Error {}

export function normalizeStravaActivity(payload: StravaActivityPayload): NormalizedActivity {
  const providerActivityId = payload.id !== undefined ? String(payload.id) : "";
  const providerAthleteId = payload.athlete?.id !== undefined ? String(payload.athlete.id) : "";
  // `sport_type` é o campo atual; `type` é o legado, mantido pelo Strava por
  // compatibilidade. Sem nenhum dos dois não há o que classificar.
  const rawType = payload.sport_type ?? payload.type ?? "";
  const startDateLocal = payload.start_date_local ?? payload.start_date;

  // Estes quatro são o mínimo para a atividade existir no nosso modelo — sem
  // eles não há linha a gravar. Falhar aqui é melhor que gravar uma atividade
  // sem dono, sem data ou sem id (que quebraria a deduplicação em silêncio).
  if (!providerActivityId || !providerAthleteId || !rawType || !startDateLocal) {
    throw new ActivityNormalizationError(
      "Atividade do Strava sem `id`, `athlete.id`, `sport_type` ou data de início.",
    );
  }

  const distanceMeters = roundedOrNull(payload.distance);
  const movingSeconds = roundedOrNull(payload.moving_time);

  return {
    providerActivityId,
    providerAthleteId,
    name: payload.name?.trim() || null,
    rawType,
    modality: mapModality(rawType),
    startedAt: new Date(payload.start_date ?? startDateLocal),
    localDate: extractLocalDate(startDateLocal),
    timezone: payload.timezone ?? null,
    distanceMeters,
    movingSeconds,
    elapsedSeconds: roundedOrNull(payload.elapsed_time),
    // "Elevação, SE disponível" (item 8): ausência é ausência. Um relógio sem
    // barômetro simplesmente não reporta, e 0 significaria "plano" — o que é
    // uma afirmação, não um dado faltante.
    elevationGainMeters: roundedOrNull(payload.total_elevation_gain),
    paceSecondsPerKm: computePaceSecondsPerKm(distanceMeters, movingSeconds),
  };
}
