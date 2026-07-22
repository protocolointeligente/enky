// Monitoramento de erro do servidor — Fase 12, item 8.
//
// `onRequestError` é o hook NATIVO do Next.js (App Router) que captura TODA
// exceção não tratada de request no servidor: erros de render de Server
// Component, de rota de API que escaparam do apiError(), de middleware. É o
// funil que faltava — apiError() só pega o que as rotas passam a ele de
// propósito; isto pega o resto.
//
// Zero dependência nova: reaproveita o pino de server/observability/logger.ts
// (que já redige senha/token/cookie/notes/symptoms). Nenhum SaaS de erro é
// adicionado agora de propósito — "sem abrir escala antes da estabilidade". O
// dia em que um Sentry/Datadog entrar, o ponto de plugue é aqui, sem tocar em
// rota nenhuma. docs/OPERATIONS.md documenta.

import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // O logger pino só é seguro no runtime Node. Em edge, cai para console.
  if (process.env.NEXT_RUNTIME === "edge") {
    console.error("[onRequestError:edge]", {
      path: request.path,
      routePath: context.routePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const { logger } = await import("@/server/observability/logger");
  logger.error(
    {
      err: error,
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
    },
    "erro não tratado de request (onRequestError)",
  );
};
