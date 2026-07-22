"use client";

import { useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";

interface CheckoutResponse {
  order: { pixCode?: string; reference: string; amountCents: number; alreadyExisted: boolean };
}

// Botão de compra. Gera UMA idempotencyKey por montagem — reclicar reaproveita o
// mesmo pedido (sem cobrança dupla). MVP: fecha o pedido no gateway sandbox e
// mostra o código PIX. A confirmação real do pagamento chega pelo webhook.
// ponytail: pagamento real (Asaas) + tela de status é a fatia B.
export function BuyButton({ slug, priceLabel }: { slug: string; priceLabel: string }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setState("loading");
    setError(null);
    try {
      const res = await apiFetch<CheckoutResponse>("/api/marketplace/checkout", {
        method: "POST",
        body: JSON.stringify({ productSlug: slug, idempotencyKey, method: "PIX" }),
      });
      setPixCode(res.order.pixCode ?? null);
      setState("done");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "AUTHENTICATION_ERROR") {
        setError("Entre na sua conta para comprar.");
      } else {
        setError(err instanceof ApiClientError ? err.message : "Não foi possível criar o pedido.");
      }
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-petrol/70 p-4">
        <p className="font-medium text-ink">Pedido criado — pague via PIX para liberar o acesso.</p>
        {pixCode && (
          <code className="break-all rounded bg-black/30 px-2 py-1 text-xs text-muted">{pixCode}</code>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={buy}
        disabled={state === "loading"}
        className="rounded-lg bg-orange px-6 py-2.5 font-semibold text-onbrand transition-colors hover:bg-orange-hi disabled:opacity-60"
      >
        {state === "loading" ? "Criando pedido..." : `Comprar · ${priceLabel}`}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
