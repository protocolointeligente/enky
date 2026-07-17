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
  workoutId?: string | null; // treino-alvo, quando o motor analisa uma sessão
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

// Máquina de estados do Insight persistido (Fase 03). NEW→VIEWED→ACCEPTED/IGNORED
// →RESOLVED; EXPIRED quando a situação some antes de qualquer decisão. "PENDING"
// é aceito só na leitura de linhas legadas (reconciliadas para NEW pela migração).
export type InsightLifecycleStatus =
  | "NEW"
  | "VIEWED"
  | "ACCEPTED"
  | "IGNORED"
  | "RESOLVED"
  | "EXPIRED";

// Insight calculado + seu estado persistido (02H). `id` é null enquanto a
// situação nunca foi gravada; status/nota/outcome refletem a decisão do treinador.
export type PersistedInsight = Insight & {
  id: string | null;
  status: InsightLifecycleStatus;
  note: string | null;
  outcome: string | null;
};

// Versão do conjunto de regras da Intelligence. Entra no fingerprint: mudar a
// versão faz uma mesma situação virar um insight novo (não reaproveita a decisão
// tomada sobre a regra antiga). Bump manual quando a semântica de uma regra muda.
export const RULESET_VERSION = "1.0.0";

// Janela temporal (semana ISO-8601, baseada na quinta-feira). Puro/determinístico.
// A mesma situação recorrendo em semanas diferentes é um insight distinto —
// dedup "por janela temporal" da Fase 03.
export function isoWeekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7; // domingo (0) vira 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Identidade estável de uma situação: mesmo atleta + motor + regras disparadas
// + versão de regras + janela temporal ⇒ mesma linha, preservando aceito/ignorado
// dentro da janela. Regras ordenadas para ser determinístico. Puro (testável).
export function fingerprintOf(
  insight: Pick<Insight, "athleteId" | "engine" | "regras">,
  opts: { version: string; windowKey: string },
): string {
  const regras = [...insight.regras].sort().join("|");
  return `${insight.athleteId}:${insight.engine}:${opts.version}:${opts.windowKey}:${regras}`;
}
