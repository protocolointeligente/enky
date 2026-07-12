import { z } from "zod";

// Relatório de período do atleta (item 6). O treinador escolhe a janela; o
// sistema fotografa aderência + carga + prontidão dos motores que já existem.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

export const generateReportInputSchema = z
  .object({
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((d) => d.periodStart <= d.periodEnd, {
    message: "periodStart deve ser anterior ou igual a periodEnd.",
    path: ["periodStart"],
  });

export type GenerateReportInput = z.infer<typeof generateReportInputSchema>;
