// Contrato único de saída da ENKY Intelligence (docs/ENKY_INTELLIGENCE_ARCHITECTURE.md
// §3). Tipos puros, sem dependências — importável por motores (server) e pela
// UI (type-only). Todo motor produz este mesmo Insight, no formato de 6 partes.

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
  observacao: string;
  interpretacao: string;
  acoesSugeridas: string[];
  confianca: InsightConfidence;
  limitacoes: string;
  dadosUsados: InsightEvidence[];
  regras: string[];
}
