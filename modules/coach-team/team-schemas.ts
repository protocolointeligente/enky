import { z } from "zod";
import { CoachAthleteRole, OrganizationRole } from "@prisma/client";

export const setMemberRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(OrganizationRole),
});
export type SetMemberRoleInput = z.infer<typeof setMemberRoleSchema>;

export const setMemberActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});
export type SetMemberActiveInput = z.infer<typeof setMemberActiveSchema>;

export const assignAthleteSchema = z.object({
  trainerId: z.string().uuid(),
  athleteId: z.string().uuid(),
  role: z.nativeEnum(CoachAthleteRole).optional(),
});
export type AssignAthleteInput = z.infer<typeof assignAthleteSchema>;

export const transferAthleteSchema = z.object({
  athleteId: z.string().uuid(),
  fromTrainerId: z.string().uuid(),
  toTrainerId: z.string().uuid(),
});
export type TransferAthleteInput = z.infer<typeof transferAthleteSchema>;
