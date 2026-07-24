// Fórmulas financeiras (§17) e classificação de atraso (§15). Tudo PURO e
// testado — as consultas ficam no finance-service, aqui só a aritmética das
// definições formais, para que "ticket médio", "churn", "conversão" tenham UM
// lugar de verdade e sejam auditáveis.

export type OverdueBucket = "1-7" | "8-15" | "16-30" | "31-60" | "60+";
export const OVERDUE_BUCKETS: OverdueBucket[] = ["1-7", "8-15", "16-30", "31-60", "60+"];

// Dias de atraso por data CIVIL (componentes UTC dos dois lados; @db.Date já é
// meia-noite UTC). ponytail: usa UTC, não o fuso da organização — simplificação
// conhecida; refinar com o timezone da org quando a inadimplência virar régua fina.
export function daysLate(dueDate: Date, now: Date): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const ref = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((ref - due) / 86_400_000));
}

export function overdueBucket(days: number): OverdueBucket {
  if (days <= 7) return "1-7";
  if (days <= 15) return "8-15";
  if (days <= 30) return "16-30";
  if (days <= 60) return "31-60";
  return "60+";
}

// Ticket médio = receita recebida no período / clientes pagantes no período.
export function ticketMedio(received: number, payingClients: number): number {
  return payingClients > 0 ? received / payingClients : 0;
}

// Churn mensal = contratos cancelados no período / contratos ativos no início.
export function churnRate(cancelled: number, activeAtStart: number): number {
  return activeAtStart > 0 ? cancelled / activeAtStart : 0;
}

// Conversão = leads ganhos / leads encerrados (ganhos + perdidos).
export function conversionRate(won: number, lost: number): number {
  const closed = won + lost;
  return closed > 0 ? won / closed : 0;
}

// Normaliza o valor de um contrato para MENSAL, conforme a periodicidade, para
// somar num MRR comparável.
export function monthlyValue(value: number, interval: string | null): number {
  switch (interval) {
    case "WEEKLY":
      return (value * 52) / 12;
    case "MONTHLY":
      return value;
    case "QUARTERLY":
      return value / 3;
    case "SEMIANNUAL":
      return value / 6;
    case "ANNUAL":
      return value / 12;
    default:
      return value; // CUSTOM / null: assume aproximação mensal
  }
}

// LTV simples = ticket médio / churn mensal. Sem churn conhecido, retorna 0
// (não dá para estimar retenção) — melhor 0 explícito que um número inventado.
export function simpleLtv(averageTicket: number, monthlyChurn: number): number {
  return monthlyChurn > 0 ? averageTicket / monthlyChurn : 0;
}
