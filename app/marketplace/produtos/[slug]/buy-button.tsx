"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

interface CheckoutResponse {
  order: { pixCode?: string; paymentUrl?: string; reference: string; amountCents: number; alreadyExisted: boolean };
}

// Máscara CPF/CNPJ: formata enquanto digita
function maskTaxId(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Botão de compra via PIX. Gera uma idempotencyKey por montagem —
// reclicar reaproveita o mesmo pedido (sem cobrança dupla).
export function BuyButton({ slug, priceLabel }: { slug: string; priceLabel: string }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [taxId, setTaxId]   = useState("");
  const [state, setState]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pixCode, setPixCode]   = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const digits = taxId.replace(/\D/g, "");
  const taxIdValid = digits.length === 11 || digits.length === 14;

  async function buy() {
    setState("loading");
    setError(null);
    try {
      const res = await apiFetch<CheckoutResponse>("/api/marketplace/checkout", {
        method: "POST",
        body: JSON.stringify({
          productSlug: slug,
          idempotencyKey,
          method: "PIX",
          ...(taxIdValid ? { buyerTaxId: digits } : {}),
        }),
      });
      setPixCode(res.order.pixCode ?? null);
      setPaymentUrl(res.order.paymentUrl ?? null);
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

  async function copyPix() {
    if (!pixCode) return;
    await navigator.clipboard.writeText(pixCode).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Estado: PIX gerado ────────────────────────────────────────────
  if (state === "done") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-turq/40 bg-turq-lo px-4 py-3">
          <span className="text-turq">✓</span>
          <p className="text-sm font-semibold text-ink">Pedido criado com sucesso!</p>
        </div>

        {pixCode ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">
              Código PIX Copia e Cola
            </p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xl border border-line bg-deep px-3 py-2.5 text-xs text-muted">
                {pixCode}
              </code>
            </div>
            <button
              type="button"
              onClick={copyPix}
              className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                copied
                  ? "bg-turq-lo text-turq border border-turq/40"
                  : "bg-orange text-onbrand hover:bg-orange-hi active:scale-95"
              }`}
            >
              {copied ? "✓ Código copiado!" : "Copiar código PIX"}
            </button>
          </div>
        ) : paymentUrl ? (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={uiClasses.button + " w-full"}
          >
            Ir para pagamento →
          </a>
        ) : null}

        <p className="text-center text-xs text-muted">
          Após confirmar o pagamento, o acesso é liberado{" "}
          <span className="font-semibold text-ink">automaticamente</span>.
        </p>

        <Link
          href="/marketplace/biblioteca"
          className="text-center text-sm text-electric-hi transition-colors hover:text-electric hover:underline"
        >
          Ver minha biblioteca →
        </Link>
      </div>
    );
  }

  // ── Estado: idle / error ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="taxid-input" className={uiClasses.label}>
          CPF ou CNPJ
          <span className="ml-1 text-faint font-normal">(obrigatório para emissão de nota)</span>
        </label>
        <input
          id="taxid-input"
          ref={inputRef}
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={taxId}
          onChange={(e) => setTaxId(maskTaxId(e.target.value))}
          className={uiClasses.input}
          disabled={state === "loading"}
        />
      </div>

      <button
        type="button"
        onClick={buy}
        disabled={state === "loading" || !taxIdValid}
        className={uiClasses.button + " w-full justify-center"}
      >
        {state === "loading" ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            Criando pedido...
          </span>
        ) : (
          `Comprar · ${priceLabel}`
        )}
      </button>

      {error && (
        <div className="flex flex-col gap-2">
          <p className={uiClasses.error}>{error}</p>
          {error.includes("conta") && (
            <Link href="/login" className={uiClasses.buttonSecondary + " text-sm w-full justify-center"}>
              Entrar na conta
            </Link>
          )}
          {!error.includes("conta") && (
            <button
              type="button"
              onClick={buy}
              className={uiClasses.buttonSecondary + " text-sm w-full justify-center"}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-faint">
        Pagamento seguro via PIX. Acesso imediato após confirmação.
      </p>
    </div>
  );
}
