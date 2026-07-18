import { ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

// Renderiza uma mensagem de erro e, quando o erro traz um correlationId, o
// "código" que a própria mensagem pede que o usuário informe ao suporte.
// Aceita string (mensagem já extraída) ou o erro cru.
export function ErrorNotice({ error }: { error: unknown }) {
  if (error == null) return null;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : "Erro inesperado.";
  const code = error instanceof ApiClientError ? error.correlationId : undefined;

  return (
    <div className={uiClasses.error}>
      <p>{message}</p>
      {code && (
        <p className="mt-1 font-mono text-xs opacity-80">
          Código: <span className="select-all">{code}</span>
        </p>
      )}
    </div>
  );
}
