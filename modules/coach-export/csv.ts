// Serialização CSV mínima e segura (§27). Escapa aspas/vírgula/quebra de linha
// (injeção de fórmula à parte — estes exports são comerciais, sem entrada de
// terceiros não confiável). CRLF + BOM para abrir bem no Excel pt-BR.

export type CsvCell = string | number | null | undefined;

function escape(v: CsvCell): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return "﻿" + lines.join("\r\n");
}
