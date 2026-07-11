"use client";

import { useState } from "react";
import type { SVGProps } from "react";
import type { Insight } from "@/modules/intelligence/insight";

// A superfície única da ENKY Intelligence — aparece em qualquer tela que peça
// análise. Não é um chatbot: é um cartão que já analisou e explica. Segue o
// formato de 6 partes e mostra sempre o "por quê" (anti caixa-preta).
export type { Insight };

const RISK_META: Record<Insight["risk"], { label: string; chip: string; accent: string }> = {
  urgente: { label: "Urgente", chip: "bg-danger/15 text-danger", accent: "#e5484d" },
  revisar: { label: "Revisar", chip: "bg-orange/15 text-orange-hi", accent: "#ff6500" },
  atencao: { label: "Atenção", chip: "bg-electric/15 text-electric-hi", accent: "#0066ff" },
  positivo: { label: "Boa execução", chip: "bg-turq/15 text-turq", accent: "#00d6c3" },
};

const CONFIDENCE_META: Record<Insight["confianca"], { label: string; cls: string }> = {
  ALTA: { label: "Confiança alta", cls: "text-turq" },
  MEDIA: { label: "Confiança média", cls: "text-electric-hi" },
  BAIXA: { label: "Confiança baixa", cls: "text-faint" },
};

function SparkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2zM19 14l.9 3.1L23 18l-3.1.9L19 22l-.9-3.1L15 18l3.1-.9L19 14z" />
    </svg>
  );
}

export function InsightCard({ insight, href }: { insight: Insight; href?: string }) {
  const [open, setOpen] = useState(false);
  const risk = RISK_META[insight.risk];
  const confidence = CONFIDENCE_META[insight.confianca];

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-line bg-petrol/70 p-4"
      style={{ borderLeft: `3px solid ${risk.accent}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-electric-hi">
          <SparkIcon /> ENKY Intelligence
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${risk.chip}`}>
          {risk.label}
        </span>
      </div>

      {insight.athleteName && (
        <p className="font-display text-sm font-semibold text-ink">{insight.athleteName}</p>
      )}
      <p className="text-sm text-ink">{insight.observacao}</p>

      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-medium ${confidence.cls}`}>{confidence.label}</span>
        <button
          type="button"
          className="text-xs font-medium text-muted transition-colors hover:text-ink"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Ocultar" : "Ver por quê"}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2 border-t border-line pt-2 text-xs text-muted">
          <p>
            <span className="font-semibold text-faint">Interpretação: </span>
            {insight.interpretacao}
          </p>
          {insight.dadosUsados.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {insight.dadosUsados.map((d) => (
                <span key={d.label} className="rounded-md bg-surface px-2 py-0.5 text-ink">
                  {d.label}: <span className="tabular font-medium">{d.value}</span>
                </span>
              ))}
            </div>
          )}
          <p>
            <span className="font-semibold text-faint">Limitações: </span>
            {insight.limitacoes}
          </p>
          {insight.regras.length > 0 && (
            <p className="text-[11px] text-faint">Regras: {insight.regras.join(" · ")}</p>
          )}
        </div>
      )}

      {insight.acoesSugeridas.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-line pt-2">
          {insight.acoesSugeridas.map((acao) => (
            <li key={acao} className="flex gap-1.5 text-xs text-muted">
              <span style={{ color: risk.accent }}>›</span>
              {acao}
            </li>
          ))}
        </ul>
      )}

      {href && (
        <a href={href} className="text-xs font-medium text-electric-hi hover:underline">
          Abrir atleta →
        </a>
      )}
    </div>
  );
}
