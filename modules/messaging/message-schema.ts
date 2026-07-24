import { z } from "zod";

export const MESSAGE_MAX_LENGTH = 4000;

// Sanitização defensiva do corpo (§13). A segurança contra XSS vem do render
// escapado do React (nunca dangerouslySetInnerHTML); aqui só normalizamos:
// remove caracteres de controle (menos \n e \t), colapsa quebras excessivas e
// apara. NÃO tentamos "remover HTML" com regex (mangla texto legítimo como
// "5 < 10") — o texto é armazenado como digitado e exibido escapado.
export function sanitizeMessageBody(raw: string): string {
  // Remove controle exceto \t (\x09) e \n (\x0A).
  const noControl = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return noControl.replace(/\n{3,}/g, "\n\n").trim();
}

export const sendMessageSchema = z.object({
  body: z
    .string()
    .min(1, "Mensagem vazia.")
    .max(MESSAGE_MAX_LENGTH, `Máximo de ${MESSAGE_MAX_LENGTH} caracteres.`)
    .transform(sanitizeMessageBody)
    .refine((b) => b.length > 0, "Mensagem vazia."),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Paginação por cursor (mensagens mais recentes primeiro; `before` = ISO da
// mensagem mais antiga já carregada, para buscar a página anterior).
export const messagePageSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type MessagePageInput = z.infer<typeof messagePageSchema>;
