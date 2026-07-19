import { z } from "zod";
import { CommunicationChannel, CommunicationRecipientType } from "@prisma/client";

export const logCommunicationSchema = z.object({
  recipientType: z.nativeEnum(CommunicationRecipientType),
  recipientId: z.string().uuid(),
  channel: z.nativeEnum(CommunicationChannel).optional(),
  subject: z.string().trim().max(200).nullish(),
  body: z.string().trim().max(5000).nullish(),
  templateCode: z.string().trim().max(100).nullish(),
});
export type LogCommunicationInput = z.infer<typeof logCommunicationSchema>;

export const listCommunicationsQuerySchema = z.object({
  recipientType: z.nativeEnum(CommunicationRecipientType).optional(),
  recipientId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListCommunicationsQuery = z.infer<typeof listCommunicationsQuerySchema>;
