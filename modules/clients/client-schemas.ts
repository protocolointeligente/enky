import { z } from "zod";
import { ClientStatus } from "@prisma/client";

// Fronteira de confiança das rotas de cliente (§28). `.nullish()` dá a semântica
// de PATCH que o Prisma espera (ausente = não mexe; null = limpa).

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).nullish(),
  phone: z.string().trim().max(50).nullish(),
  document: z.string().trim().max(40).nullish(),
  birthDate: z.coerce.date().nullish(),
  status: z.nativeEnum(ClientStatus).optional(),
  notes: z.string().trim().max(2000).nullish(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const listClientsQuerySchema = z.object({
  status: z.nativeEnum(ClientStatus).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
