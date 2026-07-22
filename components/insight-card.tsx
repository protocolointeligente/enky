"use client";

import { useState } from "react";
import type { SVGProps } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import type { Insight, InsightLifecycleStatus } from "@/modules/intelligence/insight";

// A superfície única da ENKY Intelligence — aparece em qualquer tela que peça
// análise. Não é um chatbot: é um cartão que já analisou e explica. Mostra
// sempre o "por quê" (anti caixa-preta): motivo, sinais usados, sinais
// AUSENTES, confiança, período, limitação — e devolve a decisão ao treinador
// (aceitar/ignorar/resultado), que é quem fecha o ciclo.
export type { Insight };

// Quando o insight vem persistido (02H), traz id + estado do ciclo. Sem id
// (ex.: insight de sessão on-the-fly), o cartão é só leitura — sem ações.
export type InsightCardInsight = Insight & {
  id?: string | null;
  status?: InsightLifecycleStatus;
  outcome?: string | null;
};

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

// NEW/VIEWED não mostram selo (o cartão ainda oferece as ações); os estados
// terminais (decisão do treinador ou expiração) mostram.
const STATUS_META: Record<InsightLifecycleStatus, { label: string; cls: string } | null> = {
  NEW: null,
  VIEWED: null,
  ACCEPTED: { label: "Aceito", cls: "text-turq" },
  IGNORED: { label: "Ignorado", cls: "text-faint" },
  RESOLVED: { label: "Resolvido", cls: "text-turq" },
  EXPIRED: { label: "Expirado", cls: "text-faint" },
};

export function InsightCard({ insight, href }: { insight: InsightCardInsight; href?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<InsightLifecycleStatus>(insight.status ?? "NEW");
  const [busy, setBusy] = useState<InsightLifecycleStatus | "OUTCOME" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(insight.outcome ?? null);
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const risk = RISK_META[insight.risk];
  const confidence = CONFIDENCE_META[insight.confianca];

  const actionable = insight.id != null;
  const resolved = STATUS_META[status];

  async function post(body: Record<string, string>, marker: InsightLifecycleStatus | "OUTCOME") {
    if (!insight.id || busy) return false;
    setBusy(marker);
    setActionError(null);
    try {
      await apiFetch(`/api/trainer/intelligence/insights/${insight.id}/decision`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return true;
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function resolve(next: "ACCEPTED" | "IGNORED") {
    if (await post({ status: next }, next)) setStatus(next);
  }

  async function saveOutcome() {
    const text = draft.trim();
    if (!text) return;
    if (await post({ outcome: text }, "OUTCOME")) {
      setOutcome(text);
      setDraft("");
      setWriting(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-line bg-petrol/70 p-4"
      style={{ borderLeft: `3px solid ${risk.accent}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-electric-hi">
          <SparkIcon /> ENKY Intelligence
        </span>
        <div className="flex items-center gap-2">
          {resolved && (
            <span className={`text-[11px] font-semibold ${resolved.cls}`}>✓ {resolved.label}</span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${risk.chip}`}>
            {risk.label}
          </span>
        </div>
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
          <p>
            <span className="font-semibold text-faint">Período analisado: </span>
            {insight.janela}
          </p>
          {insight.dadosUsados.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-faint">Sinais usados</span>
              <div className="flex flex-wrap gap-1.5">
                {insight.dadosUsados.map((d) => (
                  <span key={d.label} className="rounded-md bg-surface px-2 py-0.5 text-ink">
                    {d.label}: <span className="tabular font-medium">{d.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {insight.sinaisAusentes.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-faint">
                Sinais ausentes (o que o sistema não viu)
              </span>
              <ul className="flex flex-col gap-0.5">
                {insight.sinaisAusentes.map((s) => (
                  <li key={s} className="flex gap-1.5 text-faint">
                    <span aria-hidden="true">–</span>
                    {s}
                  </li>
                ))}
              </ul>
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
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          <span className="text-[11px] font-semibold text-faint">
            Sugestões — a decisão é sua
          </span>
          <ul className="flex flex-col gap-1">
            {insight.acoesSugeridas.map((acao) => (
              <li key={acao} className="flex gap-1.5 text-xs text-muted">
                <span style={{ color: risk.accent }}>›</span>
                {acao}
              </li>
            ))}
          </ul>
        </div>
      )}

      {href && (
        <a href={href} className="text-xs font-medium text-electric-hi hover:underline">
          Abrir atleta →
        </a>
      )}

      {actionable && (status === "NEW" || status === "VIEWED") && (
        <div className="flex items-center gap-2 border-t border-line pt-2">
          <button
            type="button"
            onClick={() => resolve("ACCEPTED")}
            disabled={busy != null}
            className="rounded-lg bg-turq/15 px-3 py-1.5 text-xs font-semibold text-turq transition-colors hover:bg-turq/25 disabled:opacity-50"
          >
            {busy === "ACCEPTED" ? "Salvando…" : "Aceitar"}
          </button>
          <button
            type="button"
            onClick={() => resolve("IGNORED")}
            disabled={busy != null}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
          >
            {busy === "IGNORED" ? "Salvando…" : "Ignorar"}
          </button>
        </div>
      )}

      {actionError && <p className="text-xs text-danger">{actionError}</p>}

      {outcome ? (
        <p className="border-t border-line pt-2 text-xs text-muted">
          <span className="font-semibold text-faint">Resultado: </span>
          {outcome}
        </p>
      ) : (
        actionable &&
        (writing ? (
          <div className="flex flex-col gap-2 border-t border-line pt-2">
            <label htmlFor={`outcome-${insight.id}`} className="text-[11px] font-semibold text-faint">
              O que você observou depois?
            </label>
            <textarea
              id={`outcome-${insight.id}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ex.: conversei com o atleta, era dor muscular tardia; mantive o plano."
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-faint"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveOutcome}
                disabled={busy != null || draft.trim().length === 0}
                className="rounded-lg bg-electric/15 px-3 py-1.5 text-xs font-semibold text-electric-hi transition-colors hover:bg-electric/25 disabled:opacity-50"
              >
                {busy === "OUTCOME" ? "Salvando…" : "Salvar resultado"}
              </button>
              <button
                type="button"
                onClick={() => setWriting(false)}
                className="text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="self-start border-t border-line pt-2 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            + Registrar resultado/observação
          </button>
        ))
      )}
    </div>
  );
}
