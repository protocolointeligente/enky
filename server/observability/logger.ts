import pino from "pino";
import { env } from "@/lib/env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { env: env.NODE_ENV },
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "cookie",
      "req.headers.cookie",
      "req.headers.authorization",
      "*.password",
      "*.passwordHash",
      "*.token",
      "payment",
      "*.cardNumber",
      "*.cvv",
      "*.symptoms",
      "*.notes",
    ],
    censor: "[REDACTED]",
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});
