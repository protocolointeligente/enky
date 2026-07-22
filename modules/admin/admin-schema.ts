import type { Role } from "@prisma/client";
import { z } from "zod";

// Fase 9 — Admin Operacional.
//
// Filtros chegam como query string (texto livre do cliente) e ações de estado
// chegam como JSON. Os parsers de filtro abaixo NUNCA lançam: um valor inválido
// vira `undefined` (= sem filtro), em vez de descer até o Prisma e virar 500.
// Já o corpo das ações usa zod e falha alto — ali um valor errado é erro real
// do chamador, não um filtro que o usuário digitou torto.

export const GLOBAL_ROLES = ["SUPERADMIN", "ADMIN", "TRAINER", "ATHLETE"] as const;

export function parseRoleFilter(value: string | null): Role | undefined {
  return GLOBAL_ROLES.includes(value as Role) ? (value as Role) : undefined;
}

// `isActive` do User: "blocked" é o inverso, não um estado separado.
export type UserStatusFilter = "active" | "blocked";
export function parseUserStatusFilter(value: string | null): UserStatusFilter | undefined {
  return value === "active" || value === "blocked" ? value : undefined;
}

// `isActive` da Organization: "suspended" é o inverso.
export type OrgStatusFilter = "active" | "suspended";
export function parseOrgStatusFilter(value: string | null): OrgStatusFilter | undefined {
  return value === "active" || value === "suspended" ? value : undefined;
}

export function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

// Data em ISO (YYYY-MM-DD ou instante completo) para o recorte da trilha.
export function parseDateFilter(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

const reasonField = z.string().trim().max(500).optional();

// Motivo é OBRIGATÓRIO no sentido destrutivo (bloquear/suspender) e opcional no
// restaurativo. Não é burocracia: é o único campo da trilha que explica POR QUE
// a conta foi cortada — sem ele, `ADMIN_BLOCK_USER` seis meses depois é um
// registro que não responde a pergunta que motivou a consulta.
export const setUserStatusInputSchema = z
  .object({
    isActive: z.boolean(),
    reason: reasonField,
  })
  .refine((v) => v.isActive || (v.reason?.length ?? 0) >= 5, {
    message: "Bloquear um usuário exige um motivo (mínimo 5 caracteres).",
    path: ["reason"],
  });
export type SetUserStatusInput = z.infer<typeof setUserStatusInputSchema>;

export const setOrganizationStatusInputSchema = z
  .object({
    isActive: z.boolean(),
    reason: reasonField,
  })
  .refine((v) => v.isActive || (v.reason?.length ?? 0) >= 5, {
    message: "Suspender uma organização exige um motivo (mínimo 5 caracteres).",
    path: ["reason"],
  });
export type SetOrganizationStatusInput = z.infer<typeof setOrganizationStatusInputSchema>;
