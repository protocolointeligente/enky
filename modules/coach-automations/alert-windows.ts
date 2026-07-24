// Janelas de tempo das automações (§23). Puro e em UTC (mesma convenção @db.Date
// do resto do financeiro) — testável e sem depender do fuso do servidor.

export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export interface AlertWindows {
  today: Date; // meia-noite UTC de hoje
  tomorrow: Date; // meia-noite UTC de amanhã
  dayAfter: Date; // meia-noite UTC de depois de amanhã
  in7days: Date; // hoje + 7
  in8days: Date; // hoje + 8 (limite exclusivo p/ "próximos 7 dias")
  cutoff24h: Date; // agora - 24h
}

export function alertWindows(now: Date): AlertWindows {
  const today = utcDayStart(now);
  return {
    today,
    tomorrow: addDays(today, 1),
    dayAfter: addDays(today, 2),
    in7days: addDays(today, 7),
    in8days: addDays(today, 8),
    cutoff24h: new Date(now.getTime() - 86_400_000),
  };
}
