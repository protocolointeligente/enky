"use client";

// Fronteira de erro RAIZ do App Router — Fase 12, item 8. Só dispara quando o
// próprio layout raiz quebra no cliente; substitui <html>/<body>, então não
// pode usar o layout nem tokens de tema do app (precisa ser autossuficiente).
// A contraparte servidor é instrumentation.ts (onRequestError). O `digest` é o
// mesmo id que aparece no log do servidor — é o que o usuário informa ao
// suporte para localizar o erro sem a gente expor stack trace ao cliente.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sem PII: só a mensagem e o digest de correlação.
    console.error("[global-error]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#04202b",
          color: "#f2f6f8",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#ff6500", margin: "0 0 8px" }}>ENKY</p>
          <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Algo saiu do lugar</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#a2b7c1", margin: "0 0 24px" }}>
            Registramos o problema e já estamos de olho. Tente de novo — se persistir, informe o
            código abaixo ao suporte.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#ff6500",
              color: "#04202b",
              fontWeight: 700,
              border: "none",
              borderRadius: 10,
              padding: "12px 28px",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            Tentar novamente
          </button>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 12, color: "#6f8b98" }}>
              Código: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
