import pino, { type Logger } from "pino";
import { env } from "@/lib/env";

// Constructed lazily on first actual use, not at import (module-scope)
// time — see the comment at the top of lib/env.ts. Building the real pino
// instance touches env.LOG_LEVEL/env.NODE_ENV, which would otherwise
// trigger full environment validation the moment anything imports the
// logger, including during Next.js's build-time "Collecting page data"
// step (which happens even for `dynamic = "force-dynamic"` routes).
let instance: Logger | null = null;

function getLogger(): Logger {
  if (instance) return instance;

  instance = pino({
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
        "*.localizedPain",
      ],
      censor: "[REDACTED]",
    },
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
  });

  return instance;
}

export const logger: Logger = new Proxy({} as Logger, {
  get(_target, prop: string | symbol) {
    const real = getLogger();
    const value = real[prop as keyof Logger];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
