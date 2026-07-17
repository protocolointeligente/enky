import { describe, expect, it } from "vitest";
import {
  ActivityNormalizationError,
  computePaceSecondsPerKm,
  extractLocalDate,
  mapModality,
  normalizeStravaActivity,
  type StravaActivityPayload,
} from "@/modules/integrations/strava-normalize";

// Payload realista do Strava — uma corrida de 10km em 50min.
function payload(overrides: Partial<StravaActivityPayload> = {}): StravaActivityPayload {
  return {
    id: 14204512345,
    athlete: { id: 98765 },
    name: "Rodagem matinal",
    sport_type: "Run",
    start_date: "2026-07-16T09:30:00Z",
    start_date_local: "2026-07-16T06:30:00Z",
    timezone: "(GMT-03:00) America/Sao_Paulo",
    distance: 10000.5,
    moving_time: 3000,
    elapsed_time: 3120,
    total_elevation_gain: 85.4,
    ...overrides,
  };
}

describe("mapModality", () => {
  it.each([
    ["Run", "RUNNING"],
    ["TrailRun", "RUNNING"],
    ["VirtualRun", "RUNNING"],
    ["Ride", "CYCLING"],
    ["VirtualRide", "CYCLING"],
    ["MountainBikeRide", "CYCLING"],
    ["Swim", "SWIMMING"],
    ["WeightTraining", "STRENGTH"],
    ["Crossfit", "FUNCTIONAL"],
  ])("mapeia %s → %s", (sportType, expected) => {
    expect(mapModality(sportType)).toBe(expected);
  });

  // A regra é "não inventar": tipo que não temos vira null e a atividade é
  // importada sem modalidade, em vez de ser forçada na modalidade mais parecida.
  it.each(["Yoga", "Walk", "Hike", "AlpineSki", "Kayaking", "Golf", ""])(
    "devolve null para o tipo não mapeado %s",
    (sportType) => {
      expect(mapModality(sportType)).toBeNull();
    },
  );

  // O Strava registra o triatlo como três atividades separadas — mapear
  // qualquer uma delas para TRIATHLON quebraria o vínculo das três.
  it("nunca mapeia para TRIATHLON", () => {
    for (const sportType of ["Run", "Ride", "Swim", "Triathlon"]) {
      expect(mapModality(sportType)).not.toBe("TRIATHLON");
    }
  });
});

describe("computePaceSecondsPerKm", () => {
  it("calcula o ritmo de 10km em 50min como 5:00/km", () => {
    expect(computePaceSecondsPerKm(10000, 3000)).toBe(300);
  });

  it("usa o tempo em movimento, não o decorrido", () => {
    // Mesma distância, tempos diferentes: quem manda é o argumento que
    // recebemos (moving_time no chamador) — a asserção existe para travar a
    // aritmética, e o uso de moving_time está travado em normalizeStravaActivity.
    expect(computePaceSecondsPerKm(10000, 3000)).toBeLessThan(
      computePaceSecondsPerKm(10000, 3120)!,
    );
  });

  it("calcula ritmo de natação em s/km (canônico), não por 100m", () => {
    // 1500m em 30min = 1200s/km (equivale a 2:00/100m — a conversão é da UI).
    expect(computePaceSecondsPerKm(1500, 1800)).toBe(1200);
  });

  // Musculação registrada no Strava tem distância 0 — sem o piso, a divisão
  // produziria Infinity e o CHECK do banco recusaria a linha inteira.
  it.each([
    ["distância nula", 0, 3000],
    ["distância abaixo de 1m", 0.4, 3000],
    ["duração nula", 10000, 0],
  ])("devolve null quando %s", (_label, distance, moving) => {
    expect(computePaceSecondsPerKm(distance, moving)).toBeNull();
  });

  it("devolve null quando falta distância ou duração", () => {
    expect(computePaceSecondsPerKm(null, 3000)).toBeNull();
    expect(computePaceSecondsPerKm(10000, null)).toBeNull();
  });
});

describe("extractLocalDate", () => {
  // O "Z" do start_date_local é um artefato do formato do Strava: o instante
  // JÁ está no fuso do atleta. Construir um Date aplicaria o fuso do servidor
  // por cima e deslocaria o dia.
  it("usa a data civil do provedor, ignorando o Z mentiroso", () => {
    expect(extractLocalDate("2026-07-16T06:30:00Z")).toBe("2026-07-16");
  });

  // O caso que o bug produziria: treino às 22h no Brasil, servidor em UTC.
  it("não desloca o dia num treino noturno", () => {
    expect(extractLocalDate("2026-07-16T22:30:00Z")).toBe("2026-07-16");
  });

  it("não desloca o dia num treino de madrugada", () => {
    expect(extractLocalDate("2026-07-16T00:15:00Z")).toBe("2026-07-16");
  });
});

describe("normalizeStravaActivity", () => {
  it("normaliza uma corrida completa", () => {
    expect(normalizeStravaActivity(payload())).toEqual({
      providerActivityId: "14204512345",
      providerAthleteId: "98765",
      name: "Rodagem matinal",
      rawType: "Run",
      modality: "RUNNING",
      startedAt: new Date("2026-07-16T09:30:00Z"),
      localDate: "2026-07-16",
      timezone: "(GMT-03:00) America/Sao_Paulo",
      distanceMeters: 10001, // 10000.5 arredondado
      movingSeconds: 3000,
      elapsedSeconds: 3120,
      elevationGainMeters: 85, // 85.4 arredondado
      paceSecondsPerKm: 300,
    });
  });

  // Ids do Strava são numéricos e grandes; virar string preserva a precisão e
  // é o tipo da coluna de deduplicação.
  it("converte ids numéricos para string", () => {
    const result = normalizeStravaActivity(payload({ id: 14204512345, athlete: { id: 98765 } }));
    expect(result.providerActivityId).toBe("14204512345");
    expect(result.providerAthleteId).toBe("98765");
  });

  // "Elevação, SE disponível": relógio sem barômetro não reporta, e 0
  // significaria "plano" — uma afirmação, não um dado faltante.
  it("mantém elevação ausente como null, nunca como zero", () => {
    const result = normalizeStravaActivity(payload({ total_elevation_gain: undefined }));
    expect(result.elevationGainMeters).toBeNull();
  });

  it("distingue elevação ausente de elevação zero", () => {
    expect(normalizeStravaActivity(payload({ total_elevation_gain: 0 })).elevationGainMeters).toBe(0);
  });

  it("importa atividade de tipo não mapeado, sem modalidade", () => {
    const result = normalizeStravaActivity(payload({ sport_type: "Yoga" }));
    expect(result.modality).toBeNull();
    expect(result.rawType).toBe("Yoga"); // o cru é preservado sempre
  });

  it("aceita o campo legado `type` quando não há `sport_type`", () => {
    const result = normalizeStravaActivity(payload({ sport_type: undefined, type: "Ride" }));
    expect(result.modality).toBe("CYCLING");
  });

  // Dado hostil/quebrado do provedor não pode virar linha no banco.
  it.each([
    ["distância negativa", { distance: -5 }],
    ["distância NaN", { distance: Number.NaN }],
    ["distância infinita", { distance: Number.POSITIVE_INFINITY }],
    ["duração negativa", { moving_time: -10 }],
  ])("descarta %s em vez de gravar", (_label, override) => {
    const result = normalizeStravaActivity(payload(override));
    expect(result.distanceMeters === null || result.distanceMeters >= 0).toBe(true);
    expect(result.movingSeconds === null || result.movingSeconds >= 0).toBe(true);
  });

  it.each([
    ["sem id", { id: undefined }],
    ["sem athlete.id", { athlete: {} }],
    ["sem tipo", { sport_type: undefined, type: undefined }],
    ["sem data", { start_date: undefined, start_date_local: undefined }],
  ])("recusa payload %s", (_label, override) => {
    expect(() => normalizeStravaActivity(payload(override))).toThrow(ActivityNormalizationError);
  });

  it("trata nome vazio como ausente", () => {
    expect(normalizeStravaActivity(payload({ name: "   " })).name).toBeNull();
  });
});
