import { z } from "zod";
import { CoachGroupStatus, Modality } from "@prisma/client";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  modality: z.nativeEnum(Modality).nullish(),
  level: z.string().trim().max(100).nullish(),
  coachId: z.string().uuid().nullish(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema.partial().extend({
  status: z.nativeEnum(CoachGroupStatus).optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addMembersSchema = z.object({
  athleteIds: z.array(z.string().uuid()).min(1).max(200),
});
export type AddMembersInput = z.infer<typeof addMembersSchema>;

export const listGroupsQuerySchema = z.object({
  status: z.nativeEnum(CoachGroupStatus).optional(),
  q: z.string().trim().max(200).optional(),
});
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
