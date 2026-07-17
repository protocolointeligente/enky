// Contrato único de saída da ENKY Intelligence (docs/ENKY_INTELLIGENCE_ARCHITECTURE.md
// §3). Tipos puros, sem dependências — importável por motores (server) e pela
// UI (type-only). Todo motor produz este mesmo Insight.
//
// O contrato é a garantia de explicabilidade (Fase 7): todo campo abaixo é
// obrigatório, então um motor novo não consegue expor uma conclusão sem dizer
// de onde ela veio, o que faltava e o que ela NÃO afirma. O tipo é o guarda.

export type InsightRisk = "positivo" | "atencao" | "revisar" | "urgente";
export type InsightConfidence = "BAIXA" | "MEDIA" | "ALTA";

export interface InsightEvidence {
  label: string;
  value: string;
}

export interface Insight {
  athleteId: string;
  athleteName: string | null;
  engine: string;
  risk: InsightRisk;
  observacao: string; // motivo principal — por que este atleta apareceu
  interpretacao: string;
  acoesSugeridas: string[]; // recomendação prudente (nunca prescrição)
  confianca: InsightConfidence;
  limitacoes: string; // o que este insight NÃO afirma
  dadosUsados: InsightEvidence[]; // sinais presentes que sustentam o motivo
  sinaisAusentes: string[]; // sinais que o motor NÃO tinha ao concluir
  janela: string; // contexto temporal legível da leitura
  regras: string[];
}

export type InsightLifecycleStatus = "PENDING" | "ACCEPTED" | "IGNORED";

// Insight calculado + seu estado persistido (02H). `id` é null enquanto a
// situação nunca foi gravada; status/outcome refletem a decisão do treinador.
export type PersistedInsight = Insight & {
  id: string | null;
  status: InsightLifecycleStatus;
  outcome: string | null;
};

// Identidade estável de uma situação: mesmo atleta + mesmo motor + mesmas
// regras disparadas ⇒ mesma linha, preservando aceito/ignorado entre
// varreduras. Regras ordenadas para ser determinístico. Puro (testável).
export function fingerprintOf(insight: Pick<Insight, "athleteId" | "engine" | "regras">): string {
  return `${insight.athleteId}:${insight.engine}:${[...insight.regras].sort().join("|")}`;
}
