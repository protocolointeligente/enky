import type { Insight, InsightConfidence, InsightEvidence } from "./insight";

// ENKY Intelligence — motor de INTERPRETAÇÃO de feedback de uma sessão.
// Função pura (sem prisma): recebe o planejado + o retorno do atleta e devolve
// um Insight no formato de 6 partes. Prioridade: segurança (dor) → não
// realizado → RPE alto → parcial → desvio grande de duração → execução positiva.
// Nunca diagnostica; linguagem prudente.

export interface FeedbackInterpretationInput {
  athleteId: string;
  athleteName: string | null;
  status: string;
  plannedDurationMinutes: number | null;
  feedback: {
    actualDurationMinutes: number | null;
    sessionRpe: number | null;
    sessionRpeLoad: string | null;
    loadStatus: string;
    fatigueLevel: number | null;
    recoveryLevel: number | null;
    painLevel: number | null;
    painRegion: string | null;
  };
}

const PAIN_THRESHOLD = 4;
const HIGH_RPE = 9;

function confidence(input: FeedbackInterpretationInput): InsightConfidence {
  const hasRpe = input.feedback.sessionRpe != null;
  const hasDuration = input.feedback.actualDurationMinutes != null;
  return hasRpe && hasDuration ? "MEDIA" : "BAIXA";
}

function evidence(input: FeedbackInterpretationInput): InsightEvidence[] {
  const f = input.feedback;
  const out: InsightEvidence[] = [];
  if (f.sessionRpe != null) out.push({ label: "RPE", value: `${f.sessionRpe}/10` });
  if (f.sessionRpeLoad != null) out.push({ label: "Carga (sRPE)", value: f.sessionRpeLoad });
  if (f.actualDurationMinutes != null)
    out.push({ label: "Duração real", value: `${f.actualDurationMinutes} min` });
  if (input.plannedDurationMinutes != null)
    out.push({ label: "Duração planejada", value: `${input.plannedDurationMinutes} min` });
  if (f.painLevel) out.push({ label: "Dor", value: String(f.painLevel) });
  if (f.recoveryLevel != null) out.push({ label: "Recuperação", value: String(f.recoveryLevel) });
  return out;
}

export function interpretFeedback(input: FeedbackInterpretationInput): Insight {
  const f = input.feedback;
  const base = {
    athleteId: input.athleteId,
    athleteName: input.athleteName,
    engine: "feedback",
    confianca: confidence(input),
    dadosUsados: evidence(input),
  };
  const planned = input.plannedDurationMinutes;
  const actual = f.actualDurationMinutes;

  // 1. Segurança — dor sobrepõe tudo.
  if ((f.painLevel ?? 0) >= PAIN_THRESHOLD) {
    return {
      ...base,
      risk: "urgente",
      observacao: `O atleta relatou dor nível ${f.painLevel}${f.painRegion ? ` (${f.painRegion})` : ""} nesta sessão.`,
      interpretacao:
        "Dor é sinal de segurança e se sobrepõe à progressão. Pode ser prudente cautela na próxima sessão.",
      acoesSugeridas: [
        "Considere reduzir a intensidade da próxima sessão.",
        "Avalie conversar com o atleta e, se necessário, orientar avaliação profissional.",
      ],
      confianca: base.confianca === "BAIXA" ? "MEDIA" : base.confianca,
      limitacoes: "Não é um diagnóstico. Sem sono/HRV para contextualizar.",
      regras: ["seguranca:dor-relatada"],
    };
  }

  // 2. Não realizado.
  if (input.status === "MISSED") {
    return {
      ...base,
      risk: "atencao",
      observacao: "A sessão foi marcada como não realizada.",
      interpretacao: "Pode indicar sobrecarga, agenda ou desmotivação — o motivo não é conhecido.",
      acoesSugeridas: ["Considere verificar o motivo e reprogramar se fizer sentido."],
      limitacoes: "O sistema não conhece a causa da ausência.",
      regras: ["adesao:nao-realizado"],
    };
  }

  // 3. RPE muito alto.
  if ((f.sessionRpe ?? 0) >= HIGH_RPE) {
    return {
      ...base,
      risk: "revisar",
      observacao: `Esforço percebido muito alto (RPE ${f.sessionRpe}/10) para esta sessão.`,
      interpretacao: "Pode sinalizar fadiga ou que a sessão foi mais dura que o planejado.",
      acoesSugeridas: ["Considere confirmar recuperação e ajustar a próxima sessão intensa."],
      limitacoes: "Sinal isolado; sem HRV/sono para confirmar fadiga.",
      regras: ["carga:rpe-alto"],
    };
  }

  // 4. Parcial.
  if (input.status === "PARTIAL") {
    return {
      ...base,
      risk: "atencao",
      observacao: "A sessão foi concluída parcialmente.",
      interpretacao: "Parte do treino não foi executada; vale entender o que faltou.",
      acoesSugeridas: ["Considere revisar com o atleta o que ficou de fora."],
      limitacoes: "O sistema não sabe qual parte foi omitida.",
      regras: ["adesao:parcial"],
    };
  }

  // 5. Desvio grande de duração (real bem abaixo do planejado).
  if (planned != null && actual != null && planned > 0 && actual < planned * 0.6) {
    return {
      ...base,
      risk: "atencao",
      observacao: `Duração real (${actual} min) bem abaixo da planejada (${planned} min).`,
      interpretacao:
        "A sessão foi mais curta que o previsto; a carga planejada pode não ter sido atingida.",
      acoesSugeridas: ["Considere confirmar com o atleta e ajustar a próxima sessão."],
      limitacoes: "Duração não captura intensidade; pode ter sido intencional.",
      regras: ["execucao:duracao-abaixo"],
    };
  }

  // 6. Execução positiva.
  return {
    ...base,
    risk: "positivo",
    observacao: "Sessão concluída conforme o planejado, sem sinais de alerta.",
    interpretacao: "Boa execução e percepção dentro do esperado.",
    acoesSugeridas: ["Pode-se considerar manter o plano ou pequena progressão com monitoramento."],
    limitacoes: "Leitura de uma única sessão; tendência exige mais dados.",
    regras: ["execucao:conforme-planejado"],
  };
}
