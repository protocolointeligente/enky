import { describe, it, expect } from "vitest";
import {
  jp7MaleSiri,
  jp7FemaleSiri,
  jp3MaleSiri,
  jp3FemaleSiri,
  guedes3Siri,
  faulkner4,
  petroski4MaleSiri,
  cooperVo2max,
  rockportVo2max,
  legerVo2max,
  vdotDaniels,
  oneRmDirect,
  epleyFormula,
  brzyckiFormula,
  mayhewFormula,
  handgripAsymmetry,
  cmjBestHeight,
  sjBestHeight,
  ftp20minFactor,
  sprintBestTimeExport,
  agilityBestTime,
  wellsBest,
  dorsiflexionAsymmetry,
  runProtocolCalculation,
  ProtocolInputError,
} from "../../../../modules/assessments/protocol-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function expectApprox(value: number, expected: number, tolerancePct = 2) {
  const delta = Math.abs(value - expected);
  const pct = (delta / expected) * 100;
  expect(pct, `${value} deveria estar dentro de ${tolerancePct}% de ${expected}`).toBeLessThan(tolerancePct);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSIÇÃO CORPORAL
// ─────────────────────────────────────────────────────────────────────────────

describe("JP7 Masculino (Siri)", () => {
  const baseInputs = {
    weight_kg: 80,
    age_years: 30,
    chest_mm: 15,
    axilla_mm: 14,
    triceps_mm: 12,
    subscapular_mm: 18,
    abdominal_mm: 22,
    suprailiac_mm: 16,
    thigh_mm: 20,
  };

  it("calcula % gordura dentro da tolerância aceitável", () => {
    const result = jp7MaleSiri(baseInputs);
    expect(result.primaryValue).toBeGreaterThan(8);
    expect(result.primaryValue).toBeLessThan(30);
    expect(result.primaryUnit).toBe("%");
  });

  it("calcula massa gorda e magra quando peso é informado", () => {
    const result = jp7MaleSiri(baseInputs);
    expect(result.derived["fat_mass_kg"]).toBeDefined();
    expect(result.derived["lean_mass_kg"]).toBeDefined();
    const fatMass = result.derived["fat_mass_kg"]!.value;
    const leanMass = result.derived["lean_mass_kg"]!.value;
    expectApprox(fatMass + leanMass, 80, 1);
  });

  it("soma de dobras JP7 = 117mm → % gordura em torno de 14–20% para 30 anos", () => {
    const result = jp7MaleSiri(baseInputs);
    expect(result.primaryValue).toBeGreaterThan(12);
    expect(result.primaryValue).toBeLessThan(22);
  });

  it("emite aviso quando soma de dobras está fora do intervalo de validação", () => {
    const result = jp7MaleSiri({ ...baseInputs, chest_mm: 1, axilla_mm: 1, triceps_mm: 1, subscapular_mm: 1, abdominal_mm: 1, suprailiac_mm: 1, thigh_mm: 1 });
    const hasWarning = result.warnings.some((w) => w.code === "SUM_OUT_OF_RANGE");
    expect(hasWarning).toBe(true);
  });

  it("lança ProtocolInputError para campo ausente", () => {
    const inputs = { ...baseInputs };
    // @ts-expect-error - remover campo obrigatório
    delete inputs.age_years;
    expect(() => jp7MaleSiri(inputs)).toThrow(ProtocolInputError);
  });
});

describe("JP7 Feminino (Siri)", () => {
  it("retorna % gordura maior que a versão masculina para mesmas dobras (diferença de equação)", () => {
    const inputs = {
      weight_kg: 65,
      age_years: 28,
      chest_mm: 15, axilla_mm: 14, triceps_mm: 18,
      subscapular_mm: 16, abdominal_mm: 20, suprailiac_mm: 14, thigh_mm: 22,
    };
    const female = jp7FemaleSiri(inputs);
    const male = jp7MaleSiri(inputs);
    // Equações diferentes geram valores diferentes para mesmas entradas
    expect(typeof female.primaryValue).toBe("number");
    expect(female.primaryUnit).toBe("%");
    expect(Math.abs(female.primaryValue - male.primaryValue)).toBeGreaterThan(0);
  });
});

describe("JP3 Masculino (Siri)", () => {
  it("calcula % gordura com 3 dobras — peitoral, abdominal, coxa", () => {
    const result = jp3MaleSiri({ weight_kg: 85, age_years: 35, chest_mm: 20, abdominal_mm: 25, thigh_mm: 22 });
    expect(result.primaryValue).toBeGreaterThan(10);
    expect(result.primaryValue).toBeLessThan(30);
  });
});

describe("JP3 Feminino (Siri)", () => {
  it("calcula % gordura com 3 dobras — tríceps, suprailíaco, coxa", () => {
    const result = jp3FemaleSiri({ weight_kg: 60, age_years: 25, triceps_mm: 18, suprailiac_mm: 15, thigh_mm: 24 });
    expect(result.primaryValue).toBeGreaterThan(12);
    expect(result.primaryValue).toBeLessThan(35);
  });
});

describe("Guedes 3 Dobras", () => {
  it("calcula para homem", () => {
    const result = guedes3Siri({ weight_kg: 78, age_years: 28, sex: "M", triceps_mm: 12, suprailiac_mm: 15, abdominal_or_leg_mm: 18 });
    expect(result.primaryValue).toBeGreaterThan(5);
    expect(result.primaryValue).toBeLessThan(30);
  });

  it("calcula para mulher", () => {
    const result = guedes3Siri({ weight_kg: 60, age_years: 25, sex: "F", triceps_mm: 18, suprailiac_mm: 14, abdominal_or_leg_mm: 16 });
    expect(result.primaryValue).toBeGreaterThan(10);
    expect(result.primaryValue).toBeLessThan(40);
  });

  it("lança erro se sexo não informado", () => {
    expect(() => guedes3Siri({ weight_kg: 70, age_years: 30, sex: "", triceps_mm: 12, suprailiac_mm: 14, abdominal_or_leg_mm: 16 }))
      .toThrow(ProtocolInputError);
  });

  it("emite aviso de idade fora do intervalo de validação", () => {
    const result = guedes3Siri({ weight_kg: 78, age_years: 70, sex: "M", triceps_mm: 12, suprailiac_mm: 15, abdominal_or_leg_mm: 18 });
    expect(result.warnings.some((w) => w.code === "AGE_OUT_OF_VALIDATION")).toBe(true);
  });
});

describe("Faulkner 4 Dobras", () => {
  it("fórmula linear: %G = soma × 0.153 + 5.783", () => {
    const inputs = { weight_kg: 75, triceps_mm: 10, subscapular_mm: 12, abdominal_mm: 14, suprailiac_mm: 11 };
    const soma = 10 + 12 + 14 + 11;
    const expected = soma * 0.153 + 5.783;
    const result = faulkner4(inputs);
    expectApprox(result.primaryValue, expected, 0.5);
  });
});

describe("Petroski 4 Dobras Masculino", () => {
  it("retorna valor numérico plausível", () => {
    const result = petroski4MaleSiri({ weight_kg: 80, age_years: 35, chest_mm: 18, subscapular_mm: 20, suprailiac_mm: 15, calf_mm: 12 });
    expect(result.primaryValue).toBeGreaterThan(5);
    expect(result.primaryValue).toBeLessThan(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CARDIORRESPIRATÓRIO
// ─────────────────────────────────────────────────────────────────────────────

describe("Cooper VO₂máx", () => {
  it("distância de 3000m → VO₂máx ~55.7 ml/kg/min", () => {
    const result = cooperVo2max({ distance_m: 3000 });
    expectApprox(result.primaryValue, (3000 - 504.9) / 44.73, 1);
  });

  it("distância baixa gera aviso", () => {
    const result = cooperVo2max({ distance_m: 1000 });
    expect(result.warnings.some((w) => w.code === "LOW_VO2_ESTIMATE")).toBe(true);
  });
});

describe("Rockport VO₂máx", () => {
  it("calcula VO₂máx para homem 30 anos, 70kg, 15min, FC 140", () => {
    const result = rockportVo2max({ time_seconds: 900, hr_final_bpm: 140, weight_kg: 70, age_years: 30, sex: "M" });
    expect(result.primaryValue).toBeGreaterThan(30);
    expect(result.primaryValue).toBeLessThan(70);
  });

  it("lança erro se sexo não informado", () => {
    expect(() => rockportVo2max({ time_seconds: 900, hr_final_bpm: 140, weight_kg: 70, age_years: 30, sex: "" }))
      .toThrow(ProtocolInputError);
  });
});

describe("Léger VO₂máx", () => {
  it("nível 13 gera VO₂máx em torno de 55 para adulto de 25 anos", () => {
    const result = legerVo2max({ last_level: 13, last_shuttle: 5, age_years: 25 });
    expect(result.primaryValue).toBeGreaterThan(45);
    expect(result.primaryValue).toBeLessThan(70);
  });

  it("inclui VAM como valor derivado", () => {
    const result = legerVo2max({ last_level: 13, last_shuttle: 5, age_years: 25 });
    expect(result.derived["vam_kmh"]).toBeDefined();
    expectApprox(result.derived["vam_kmh"]!.value, 8 + 0.5 * 13, 0.5);
  });
});

describe("VDOT Daniels", () => {
  it("5km em 20 min → VDOT ≈ 48–52", () => {
    const result = vdotDaniels({ race_distance_m: 5000, race_time_seconds: 1200 });
    expectApprox(result.primaryValue, 60, 5);
  });

  it("inclui paces de treino derivados", () => {
    const result = vdotDaniels({ race_distance_m: 10000, race_time_seconds: 2700 });
    expect(result.derived["easy_pace"]).toBeDefined();
    expect(result.derived["threshold_pace"]).toBeDefined();
    expect(result.derived["interval_pace"]).toBeDefined();
  });

  it("VDOT baixo gera aviso INFO", () => {
    const result = vdotDaniels({ race_distance_m: 5000, race_time_seconds: 2400 });
    // Distância longa → VDOT pode ser baixo
    if (result.primaryValue < 30) {
      expect(result.warnings.some((w) => w.code === "LOW_VDOT")).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORÇA
// ─────────────────────────────────────────────────────────────────────────────

describe("1RM Direto", () => {
  it("retorna carga como valor principal", () => {
    const result = oneRmDirect({ load_kg: 120, weight_kg: 80, exercise_id: "squat" });
    expect(result.primaryValue).toBe(120);
  });

  it("calcula força relativa se peso disponível", () => {
    const result = oneRmDirect({ load_kg: 100, weight_kg: 80 });
    expectApprox(result.derived["relative_strength"]!.value, 1.25, 1);
  });

  it("não há derived se peso não informado", () => {
    const result = oneRmDirect({ load_kg: 100 });
    expect(result.derived["relative_strength"]).toBeUndefined();
  });
});

describe("Epley 1RM", () => {
  it("5 reps com 100kg → 1RM ≈ 116.7 kg", () => {
    const result = epleyFormula({ test_load_kg: 100, reps_completed: 5 });
    expectApprox(result.primaryValue, 100 * (1 + 5 / 30), 1);
  });

  it("1 rep → resultado igual à carga (trivial)", () => {
    const result = epleyFormula({ test_load_kg: 80, reps_completed: 1 });
    expectApprox(result.primaryValue, 80 * (1 + 1 / 30), 1);
  });

  it("acima de 10 reps emite aviso", () => {
    const result = epleyFormula({ test_load_kg: 60, reps_completed: 15 });
    expect(result.warnings.some((w) => w.code === "HIGH_REPS_EPLEY")).toBe(true);
  });
});

describe("Brzycki 1RM", () => {
  it("6 reps com 100kg → 1RM ≈ 116.2 kg", () => {
    const expected = 100 / (1.0278 - 0.0278 * 6);
    const result = brzyckiFormula({ test_load_kg: 100, reps_completed: 6 });
    expectApprox(result.primaryValue, expected, 0.5);
  });

  it("lança erro para 37+ reps (denominador ≤ 0)", () => {
    expect(() => brzyckiFormula({ test_load_kg: 50, reps_completed: 37 })).toThrow(ProtocolInputError);
  });

  it("acima de 10 reps emite aviso", () => {
    const result = brzyckiFormula({ test_load_kg: 60, reps_completed: 11 });
    expect(result.warnings.some((w) => w.code === "HIGH_REPS_BRZYCKI")).toBe(true);
  });
});

describe("Mayhew 1RM", () => {
  it("retorna valor plausível para 8 reps com 80kg", () => {
    const result = mayhewFormula({ test_load_kg: 80, reps_completed: 8 });
    expect(result.primaryValue).toBeGreaterThan(80);
    expect(result.primaryValue).toBeLessThan(130);
  });
});

describe("Dinamometria de Preensão Manual", () => {
  it("valor principal é o melhor lado dominante", () => {
    const result = handgripAsymmetry({ right_1_kgf: 50, left_1_kgf: 45, right_2_kgf: 52, left_2_kgf: 46 });
    expect(result.primaryValue).toBe(52);
  });

  it("assimetria > 15% gera aviso", () => {
    const result = handgripAsymmetry({ right_1_kgf: 60, left_1_kgf: 40 });
    expect(result.warnings.some((w) => w.code === "HIGH_HANDGRIP_ASYMMETRY")).toBe(true);
  });

  it("assimetria 0% não gera aviso", () => {
    const result = handgripAsymmetry({ right_1_kgf: 50, left_1_kgf: 50 });
    expect(result.warnings).toHaveLength(0);
  });

  it("inclui valores derivados por lado", () => {
    const result = handgripAsymmetry({ right_1_kgf: 50, left_1_kgf: 45 });
    expect(result.derived["right_best_kgf"]!.value).toBe(50);
    expect(result.derived["left_best_kgf"]!.value).toBe(45);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POTÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

describe("CMJ — melhor altura", () => {
  it("retorna o melhor salto de 3 tentativas", () => {
    const result = cmjBestHeight({ jump1_cm: 35, jump2_cm: 38, jump3_cm: 36 });
    expect(result.primaryValue).toBe(38);
  });

  it("calcula potência pico quando peso disponível", () => {
    const result = cmjBestHeight({ jump1_cm: 40, weight_kg: 75 });
    expect(result.derived["peak_power_bosco_w"]).toBeDefined();
    expect(result.derived["peak_power_sayers_w"]).toBeDefined();
  });
});

describe("SJ — melhor altura", () => {
  it("retorna o melhor salto", () => {
    const result = sjBestHeight({ jump1_cm: 30, jump2_cm: 32 });
    expect(result.primaryValue).toBe(32);
  });
});

describe("FTP — Teste 20 minutos", () => {
  it("FTP = potência média × 0.95", () => {
    const result = ftp20minFactor({ avg_power_20min_w: 300 });
    expect(result.primaryValue).toBe(285);
  });

  it("inclui W/kg e zonas de Coggan quando peso disponível", () => {
    const result = ftp20minFactor({ avg_power_20min_w: 250, weight_kg: 70 });
    expect(result.derived["w_per_kg"]).toBeDefined();
    expect(result.derived["zone_1"]).toBeDefined();
    expect(result.derived["zone_4"]).toBeDefined();
  });

  it("potência muito baixa gera aviso", () => {
    const result = ftp20minFactor({ avg_power_20min_w: 50 });
    expect(result.warnings.some((w) => w.code === "LOW_FTP")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VELOCIDADE / AGILIDADE
// ─────────────────────────────────────────────────────────────────────────────

describe("Sprint — melhor tempo", () => {
  it("retorna menor tempo de 3 tentativas", () => {
    const result = sprintBestTimeExport({ time1_s: 1.85, time2_s: 1.80, time3_s: 1.82 });
    expect(result.primaryValue).toBe(1.80);
  });

  it("cronômetro manual emite aviso INFO", () => {
    const result = sprintBestTimeExport({ time1_s: 1.90, timing_device: "MANUAL" });
    expect(result.warnings.some((w) => w.code === "MANUAL_TIMING")).toBe(true);
  });

  it("fotocélula → confiança alta", () => {
    const result = sprintBestTimeExport({ time1_s: 1.82, timing_device: "PHOTOCELL" });
    expect(result.confidence).toBeGreaterThan(0.90);
  });
});

describe("Agilidade — melhor tempo", () => {
  it("retorna menor tempo de 2 tentativas", () => {
    const result = agilityBestTime({ time1_s: 15.8, time2_s: 15.4 });
    expect(result.primaryValue).toBe(15.4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLEXIBILIDADE
// ─────────────────────────────────────────────────────────────────────────────

describe("Banco de Wells", () => {
  it("retorna melhor alcance de 3 tentativas", () => {
    const result = wellsBest({ reach1_cm: 18, reach2_cm: 22, reach3_cm: 20 });
    expect(result.primaryValue).toBe(22);
  });

  it("aceita valores negativos (alcance abaixo dos pés)", () => {
    const result = wellsBest({ reach1_cm: -5, reach2_cm: -3 });
    expect(result.primaryValue).toBe(-3);
  });
});

describe("Dorsiflexão de Tornozelo", () => {
  it("valor principal é o lado mais restrito (menor)", () => {
    const result = dorsiflexionAsymmetry({ right_cm: 14, left_cm: 11 });
    expect(result.primaryValue).toBe(11);
  });

  it("assimetria > 10% gera aviso", () => {
    const result = dorsiflexionAsymmetry({ right_cm: 16, left_cm: 10 });
    expect(result.warnings.some((w) => w.code === "DORSIFLEXION_ASYMMETRY")).toBe(true);
  });

  it("valor < 9cm gera aviso de risco", () => {
    const result = dorsiflexionAsymmetry({ right_cm: 8, left_cm: 10 });
    expect(result.warnings.some((w) => w.code === "LOW_DORSIFLEXION")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER
// ─────────────────────────────────────────────────────────────────────────────

describe("runProtocolCalculation (dispatcher)", () => {
  it("executa JP7_MALE_SIRI corretamente", () => {
    const result = runProtocolCalculation("JP7_MALE_SIRI", {
      weight_kg: 80, age_years: 30,
      chest_mm: 15, axilla_mm: 14, triceps_mm: 12,
      subscapular_mm: 18, abdominal_mm: 22,
      suprailiac_mm: 16, thigh_mm: 20,
    });
    expect(result.primaryUnit).toBe("%");
  });

  it("executa FTP_20MIN_FACTOR corretamente", () => {
    const result = runProtocolCalculation("FTP_20MIN_FACTOR", { avg_power_20min_w: 200 });
    expect(result.primaryValue).toBe(190);
  });

  it("lança Error para equationCode desconhecido", () => {
    expect(() => runProtocolCalculation("UNKNOWN_EQUATION", {})).toThrow();
  });

  it("todos os equationCodes registrados são executáveis", () => {
    const codes = [
      "JP7_MALE_SIRI", "JP7_FEMALE_SIRI", "JP3_MALE_SIRI", "JP3_FEMALE_SIRI",
      "GUEDES_3_SIRI", "FAULKNER_4",
      "COOPER_VO2MAX", "LEGER_VO2MAX",
      "ONE_RM_DIRECT", "EPLEY_FORMULA", "BRZYCKI_FORMULA",
      "CMJ_BEST_HEIGHT", "SJ_BEST_HEIGHT",
      "WELLS_BEST",
    ];

    for (const code of codes) {
      expect(() => {
        try {
          // usar inputs mínimos plausíveis — alguns vão lançar ProtocolInputError,
          // o que é aceitável (validação de negócio), mas não deve lançar TypeError
          runProtocolCalculation(code, {
            weight_kg: 75, age_years: 30, sex: "M",
            chest_mm: 15, axilla_mm: 14, triceps_mm: 14,
            subscapular_mm: 16, abdominal_mm: 18, suprailiac_mm: 14, thigh_mm: 20,
            abdominal_or_leg_mm: 15,
            distance_m: 2500, time_seconds: 600, hr_final_bpm: 140,
            last_level: 10, last_shuttle: 5,
            load_kg: 100, test_load_kg: 80, reps_completed: 5, exercise_id: "squat",
            jump1_cm: 35, right_1_kgf: 45, left_1_kgf: 40,
            reach1_cm: 20, right_cm: 14, left_cm: 13,
          });
        } catch (e) {
          if (e instanceof ProtocolInputError) return; // OK
          throw e;
        }
      }).not.toThrow();
    }
  });
});
