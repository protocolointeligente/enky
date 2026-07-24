// Aritmética PURA do dashboard comercial (§16.4) — testável, sem DB.

/** Take-rate (%) = comissões / GMV. 0 quando não houve GMV. Uma casa decimal. */
export function takeRatePct(gmv: number, commissions: number): number {
  return gmv > 0 ? Math.round((commissions / gmv) * 1000) / 10 : 0;
}

/** Ticket médio = GMV / número de vendas. 0 sem vendas. Duas casas. */
export function averageTicket(gmv: number, sales: number): number {
  return sales > 0 ? Math.round((gmv / sales) * 100) / 100 : 0;
}

/** Receita mensal-equivalente de uma assinatura, normalizando o ciclo. */
export function monthlyFromCycle(price: number, cycle: "MENSAL" | "ANUAL"): number {
  return cycle === "ANUAL" ? price / 12 : price;
}
