import { z } from "zod";

// Length over composition rules (NIST SP 800-63B guidance) — a long
// passphrase is harder to brute-force than a short "complex" password, and
// forced-composition rules push users toward predictable substitutions.
export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: "A senha deve conter letras e números.",
  });
