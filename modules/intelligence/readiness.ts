// Índice de prontidão (composto) — ENKY_METRIC_REGISTRY `readiness`, Fase II.
// Função PURA e testável: recebe o auto-relato diário e devolve uma classe
// (boa/atenção/baixa/insuficiente) + escore. É HIPÓTESE de "pronto para treinar
// hoje", NUNCA diagnóstico. Experimental até validação (registry §readiness);
// entra como sinal, jamais como decisão isolada de carga.

export type ReadinessClass = "boa" | "atencao" | "baixa" | "insuficiente";

// Sinais coletados pelo questionário. Todos opcionais — preenchimento parcial
// é esperado e reduz a confiança (menos sinais → "insuficiente").
export interface ReadinessInputs {
  sleepHours?: number | null;
  sleepQuality?: number | null; // 0–10
  fatigue?: number | null; // 0–10 (alto = ruim)
  soreness?: number | null; // 0–10 (alto = ruim)
  stress?: number | null; // 0–10 (alto = ruim)
  motivation?: number | null; // 0–10 (alto = bom)
}

export interface ReadinessResult {
  class: ReadinessClass;
  score: number | null; // 0–100, ou null quando insuficiente
  signalsUsed: number;
}

const MIN_SIGNALS = 3; // abaixo disso a leitura é frágil demais → insuficiente
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ponytail: pesos iguais, heurística v1. Sem HRV/sono objetivo ainda; quando
// vier wearable (Fase III) reponderar. Marcado experimental no registry.
export function classifyReadiness(inputs: ReadinessInputs): ReadinessResult {
  const good: number[] = [];

  // 8h como referência de sono "cheio"; acima disso satura em 1.
  if (inputs.sleepHours != null) good.push(clamp01(inputs.sleepHours / 8));
  if (inputs.sleepQuality != null) good.push(clamp01(inputs.sleepQuality / 10));
  if (inputs.motivation != null) good.push(clamp01(inputs.motivation / 10));
  // Sinais "ruins" invertidos: quanto maior, pior.
  if (inputs.fatigue != null) good.push(clamp01((10 - inputs.fatigue) / 10));
  if (inputs.soreness != null) good.push(clamp01((10 - inputs.soreness) / 10));
  if (inputs.stress != null) good.push(clamp01((10 - inputs.stress) / 10));

  if (good.length < MIN_SIGNALS) {
    return { class: "insuficiente", score: null, signalsUsed: good.length };
  }

  const mean = good.reduce((a, b) => a + b, 0) / good.length;
  const score = Math.round(mean * 100);
  const klass: ReadinessClass = mean >= 0.7 ? "boa" : mean >= 0.5 ? "atencao" : "baixa";
  return { class: klass, score, signalsUsed: good.length };
}
