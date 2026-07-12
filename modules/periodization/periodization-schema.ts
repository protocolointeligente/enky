import { z } from "zod";

// Camada estratégica manual (produto v1). O treinador desenha o macrociclo:
// título, objetivo, janela e fases (base/build/pico/taper). As semanas são
// derivadas da janela pelo serviço. NÃO é o motor de geração automática
// (GenerationBatch/AUTOMATIC) — esse é Fase 5, depende de dados acumulados.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

const phaseInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da fase.").max(80),
    startDate: isoDate,
    endDate: isoDate,
    targetVolumeKm: z.number().nonnegative().max(10000).optional(),
    targetIntensity: z.string().trim().max(120).optional(),
  })
  .refine((p) => p.startDate <= p.endDate, {
    message: "Início da fase deve ser anterior ou igual ao fim.",
    path: ["startDate"],
  });

export const createPeriodizationInputSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título.").max(120),
    goal: z.string().trim().min(1, "Informe o objetivo.").max(200),
    startDate: isoDate,
    endDate: isoDate,
    phases: z.array(phaseInputSchema).max(12).default([]),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "Início do plano deve ser anterior ou igual ao fim.",
    path: ["startDate"],
  })
  .refine((d) => d.phases.every((p) => p.startDate >= d.startDate && p.endDate <= d.endDate), {
    message: "As fases devem ficar dentro da janela do plano.",
    path: ["phases"],
  });

export type CreatePeriodizationInput = z.infer<typeof createPeriodizationInputSchema>;
