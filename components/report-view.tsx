"use client";

import { useState } from "react";
import { uiClasses } from "@/app/_lib/ui";
import type { DocSection, ReportDocument } from "@/modules/reports/report-document";

// Tela do relatório premium. Desenha o MESMO ReportDocument que o PDF desenha
// (modules/reports/report-document.ts) — nenhuma frase é redigida aqui, então
// o que o atleta lê na tela é, palavra por palavra, o que sai no PDF e o que o
// snapshot test trava. Este componente só decide cor, caixa e ordem.

export interface ReportItem {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  sharedAt: string | null;
}

export interface ReportEntry {
  report: ReportItem;
  document: ReportDocument;
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "bg-surface text-muted",
  PUBLISHED: "bg-turq/15 text-turq",
  REVOKED: "bg-danger/15 text-danger",
  ARCHIVED: "bg-surface text-faint",
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col rounded-lg bg-surface px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-faint">{label}</span>
      <span className="tabular font-display text-lg font-bold text-ink">{value}</span>
      {note && <span className="text-[10px] text-electric">{note}</span>}
    </div>
  );
}

// Insuficiência de dado é informação de primeira classe no ENKY — turquesa,
// visível, nunca escondida num rodapé cinza.
function Notice({ children }: { children: string }) {
  return (
    <p className="rounded-lg border-l-2 border-turq bg-turq/10 px-3 py-2 text-xs text-ink">
      {children}
    </p>
  );
}

function Section({ section }: { section: DocSection }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h4 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-orange" />
        {section.title}
      </h4>

      {section.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {section.stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} note={stat.note} />
          ))}
        </div>
      )}

      {section.paragraphs.map((text) => (
        <p key={text} className="text-sm leading-relaxed text-muted">
          {text}
        </p>
      ))}

      {section.rows.length > 0 && (
        <dl className="flex flex-col gap-1">
          {section.rows.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className="flex justify-between gap-4 rounded-md px-2 py-1.5 text-sm odd:bg-surface/50"
            >
              <dt className="text-faint">{row.label}</dt>
              <dd className="text-right font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {section.notice && <Notice>{section.notice}</Notice>}
    </section>
  );
}

export function ReportView({
  entry,
  pdfHref,
  onShare,
  onRevoke,
}: {
  entry: ReportEntry;
  pdfHref: string;
  onShare?: () => void | Promise<void>;
  onRevoke?: () => void | Promise<void>;
}) {
  const { report, document } = entry;
  const [open, setOpen] = useState(false);
  const [summary, ...details] = document.sections;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-petrol/70 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="font-display text-base font-semibold text-ink">{document.periodLabel}</h3>
          <span className="text-xs text-faint">
            {document.athleteName} · {document.generatedLabel}
          </span>
        </div>
        <span
          className={`${uiClasses.badge} ${STATUS_CLASS[report.status] ?? "bg-surface text-faint"}`}
        >
          {document.statusLabel}
        </span>
      </header>

      {/* Resumo executivo sempre aberto; o resto expande sob demanda. */}
      {summary && <Section section={summary} />}

      {details.length > 0 && (
        <>
          <button
            type="button"
            className={`${uiClasses.buttonGhost} self-start`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Ocultar detalhamento" : "Ver relatório completo"}
          </button>

          {open && (
            <div className="flex flex-col gap-5 border-t border-line pt-4">
              {details.map((section) => (
                <Section key={section.id} section={section} />
              ))}
            </div>
          )}
        </>
      )}

      <footer className="flex flex-wrap gap-2 border-t border-line pt-4">
        <a className={uiClasses.button} href={pdfHref} download>
          Baixar PDF
        </a>
        {onShare && (
          <button
            type="button"
            className={uiClasses.buttonSecondary}
            onClick={() => void onShare()}
          >
            {report.status === "REVOKED" ? "Compartilhar novamente" : "Compartilhar com o atleta"}
          </button>
        )}
        {onRevoke && (
          <button type="button" className={uiClasses.buttonDanger} onClick={() => void onRevoke()}>
            Revogar compartilhamento
          </button>
        )}
      </footer>
    </article>
  );
}
