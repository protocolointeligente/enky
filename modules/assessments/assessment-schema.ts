import { z } from "zod";

// Avaliação física = um resultado de teste (TestResult). testType é texto livre
// (o vocabulário sugerido fica na UI) — o produto não fixa protocolos ainda.
// calculatedMetrics guarda o que o treinador derivou (ex.: zonas), sem o sistema
// inventar cálculo (coerente com a decisão "intensidade só em RPE" da Fase 6).
export const recordTestResultSchema = z.object({
  testType: z.string().min(2).max(80),
  resultValue: z.number().finite(),
  unit: z.string().min(1).max(20),
  protocol: z.string().max(200).optional(),
  performedAt: z.string().datetime().optional(),
  calculatedMetrics: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type RecordTestResultBody = z.infer<typeof recordTestResultSchema>;
