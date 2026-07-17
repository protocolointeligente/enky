import {
  hasAdherenceSufficiency,
  hasLoadSufficiency,
  hasReadinessSufficiency,
  MIN_LOAD_DATA_DAYS,
  MIN_READINESS_CHECKINS,
  parseReportSnapshot,
  type ReportSnapshot,
} from "./report-snapshot";

// O DOCUMENTO do relatório premium — núcleo PURO (sem prisma, sem React, sem
// pdfkit). Recebe o Report + snapshot e devolve a estrutura de seções já
// redigida; o PDF (report-pdf.ts) e a tela (components/report-view.tsx) apenas
// DESENHAM isto. Uma redação só, dois meios — é isso que faz o snapshot test
// valer: o texto que o atleta lê é o texto que o teste trava.
//
// Regras de linguagem (Constitution Princípio 16), aplicadas aqui:
//  - contexto, nunca diagnóstico: descrevemos o registrado, não o que "está
//    acontecendo" com o corpo do atleta;
//  - dado insuficiente vira DECLARAÇÃO de insuficiência (`notice`), nunca um
//    número exibido com falsa confiança;
//  - nenhuma interpretação inventada: interpretação é campo do treinador
//    (`insights`/`recommendations`), exibido como fala dele.

export interface DocStat {
  label: string;
  value: string;
  note?: string;
}

export interface DocRow {
  label: string;
  value: string;
}

export interface DocSection {
  id: string;
  title: string;
  stats: DocStat[];
  rows: DocRow[];
  paragraphs: string[];
  /** Declaração de insuficiência de dados. Quando presente, os números da seção são parciais ou ausentes por decisão explícita. */
  notice: string | null;
}

export interface ReportDocument {
  reportId: string;
  athleteName: string;
  trainerName: string;
  periodLabel: string;
  statusLabel: string;
  generatedLabel: string;
  sections: DocSection[];
  disclaimer: string;
}

export interface ReportDocumentInput {
  report: {
    id: string;
    status: string;
    periodStart: Date;
    periodEnd: Date;
    metricsSnapshot: unknown;
    insights: string | null;
    recommendations: string | null;
    limitations: string | null;
    createdAt: Date;
  };
  athleteName: string | null;
  trainerName: string | null;
}

export const REPORT_DISCLAIMER =
  "Este documento é uma leitura de contexto do que foi registrado no período. Não é diagnóstico, avaliação clínica nem prescrição de saúde. Os números descrevem os registros; a interpretação é do treinador que assina.";

const REPORT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Compartilhado",
  REVOKED: "Compartilhamento revogado",
  ARCHIVED: "Arquivado",
};

const MODALITY_LABEL: Record<string, string> = {
  RUNNING: "Corrida",
  STRENGTH: "Força",
  FUNCTIONAL: "Funcional",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
};

const READINESS_LABEL: Record<string, string> = {
  boa: "boa",
  atencao: "atenção",
  baixa: "baixa",
  insuficiente: "insuficiente",
};

// Formatação determinística (sem Intl/toLocaleDateString): o mesmo relatório
// precisa render igual no servidor, no teste e na máquina de quem revisa.
function fmtDay(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDayIso(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtNum(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace(".", ",");
}

function fmtPct(value: number | null): string {
  return value != null ? `${fmtNum(value)}%` : "—";
}

function pluralize(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

// --- Seções ---------------------------------------------------------------

function executiveSummary(s: ReportSnapshot): DocSection {
  const paragraphs: string[] = [];

  paragraphs.push(
    hasAdherenceSufficiency(s)
      ? `No período foram previstas ${s.adherence.due} ${pluralize(s.adherence.due, "sessão", "sessões")}, com ${s.adherence.completed} ${pluralize(s.adherence.completed, "concluída", "concluídas")}, ${s.adherence.partial} ${pluralize(s.adherence.partial, "parcial", "parciais")} e ${s.adherence.missed} ${pluralize(s.adherence.missed, "perdida", "perdidas")}. A aderência registrada foi de ${fmtPct(s.adherence.pct)}.`
      : "Não houve sessões previstas no período, então não há aderência a medir.",
  );

  if (s.volume.sessions > 0) {
    const partes = [`${s.volume.sessions} ${pluralize(s.volume.sessions, "sessão", "sessões")}`];
    if (s.volume.minutes > 0) partes.push(`${s.volume.minutes} min registrados`);
    if (s.volume.distanceKm > 0) partes.push(`${fmtNum(s.volume.distanceKm, 1)} km`);
    paragraphs.push(`Volume realizado: ${partes.join(", ")}.`);
  } else {
    paragraphs.push("Nenhuma sessão com volume registrado no período.");
  }

  paragraphs.push(
    hasLoadSufficiency(s)
      ? `Carga interna acumulada de ${fmtNum(s.internalLoad.total)} UA, com CTL ${fmtNum(s.load.ctl)} e ACWR ${fmtNum(s.load.acwr ?? 0, 2)} ao fim do período.`
      : `Carga interna acumulada de ${fmtNum(s.internalLoad.total)} UA. O histórico ainda não sustenta a leitura de CTL/ATL/TSB/ACWR (${s.load.dataDays} de ${MIN_LOAD_DATA_DAYS} dias com registro).`,
  );

  paragraphs.push(
    hasReadinessSufficiency(s)
      ? `Prontidão auto-relatada em ${s.readiness.count} check-ins, com leitura mais recente "${READINESS_LABEL[s.readiness.latestClass ?? ""] ?? "—"}".`
      : `Prontidão com ${s.readiness.count} ${pluralize(s.readiness.count, "check-in", "check-ins")} no período — abaixo dos ${MIN_READINESS_CHECKINS} necessários para uma leitura estável.`,
  );

  return {
    id: "resumo-executivo",
    title: "Resumo executivo",
    stats: [
      { label: "Aderência", value: fmtPct(s.adherence.pct) },
      { label: "Sessões", value: String(s.volume.sessions) },
      { label: "Carga interna", value: `${fmtNum(s.internalLoad.total)} UA` },
      {
        label: "Prontidão",
        value: hasReadinessSufficiency(s)
          ? (READINESS_LABEL[s.readiness.latestClass ?? ""] ?? "—")
          : "—",
      },
    ],
    rows: [],
    paragraphs,
    notice: null,
  };
}

function adherenceSection(s: ReportSnapshot): DocSection {
  const a = s.adherence;
  return {
    id: "aderencia",
    title: "Aderência",
    stats: [
      { label: "Previstas", value: String(a.due) },
      { label: "Concluídas", value: String(a.completed) },
      { label: "Parciais", value: String(a.partial) },
      { label: "Perdidas", value: String(a.missed) },
    ],
    rows: a.pending > 0 ? [{ label: "Ainda sem retorno", value: String(a.pending) }] : [],
    paragraphs: hasAdherenceSufficiency(s)
      ? [
          `Aderência de ${fmtPct(a.pct)} considera concluídas e parciais sobre o total previsto no período (${a.completed + a.partial} de ${a.due}).`,
        ]
      : [],
    notice: hasAdherenceSufficiency(s)
      ? null
      : "Sem sessões previstas na janela escolhida — não há aderência a calcular.",
  };
}

function volumeSection(s: ReportSnapshot): DocSection {
  const v = s.volume;
  return {
    id: "volume",
    title: "Volume",
    stats: [
      { label: "Sessões", value: String(v.sessions) },
      { label: "Tempo", value: v.minutes > 0 ? `${v.minutes} min` : "—" },
      { label: "Distância", value: v.distanceKm > 0 ? `${fmtNum(v.distanceKm, 1)} km` : "—" },
    ],
    rows: v.byModality.map((m) => ({
      label: MODALITY_LABEL[m.modality] ?? m.modality,
      value:
        m.minutes > 0
          ? `${m.sessions} ${pluralize(m.sessions, "sessão", "sessões")} · ${m.minutes} min`
          : `${m.sessions} ${pluralize(m.sessions, "sessão", "sessões")}`,
    })),
    paragraphs:
      v.sessions > 0
        ? [
            "Volume conta apenas o que o atleta registrou como realizado (tempo e distância do feedback da sessão).",
          ]
        : [],
    notice:
      v.sessions === 0
        ? "Nenhuma sessão com volume registrado — sem dado de tempo ou distância para reportar."
        : v.minutes === 0 && v.distanceKm === 0
          ? "Sessões registradas sem tempo nem distância preenchidos: o volume do período não pôde ser quantificado."
          : null,
  };
}

function internalLoadSection(s: ReportSnapshot): DocSection {
  const l = s.internalLoad;
  return {
    id: "carga-interna",
    title: "Carga interna",
    stats: [
      { label: "Total", value: `${fmtNum(l.total)} UA` },
      {
        label: "Média semanal",
        value: l.weeklyAverage != null ? `${fmtNum(l.weeklyAverage)} UA` : "—",
      },
      { label: "Sessões com sRPE", value: String(l.sessionsWithLoad) },
    ],
    rows: [],
    paragraphs: [
      "Carga interna usa o sRPE da sessão (esforço percebido × duração), em unidades arbitrárias (UA). É a percepção do atleta, não uma medida fisiológica direta.",
    ],
    notice:
      l.sessionsWithoutLoad > 0
        ? `${l.sessionsWithoutLoad} ${pluralize(l.sessionsWithoutLoad, "sessão realizada não tem", "sessões realizadas não têm")} sRPE registrado e ${pluralize(l.sessionsWithoutLoad, "ficou", "ficaram")} de fora deste total.`
        : null,
  };
}

function loadStateSection(s: ReportSnapshot): DocSection {
  const sufficient = hasLoadSufficiency(s);
  if (!sufficient) {
    return {
      id: "estado-de-carga",
      title: "Estado de carga (CTL · ATL · TSB · ACWR)",
      stats: [],
      rows: [],
      paragraphs: [],
      notice: `Dados insuficientes para esta leitura. CTL/ATL/TSB/ACWR derivam de uma média móvel de 42 dias e exigem pelo menos ${MIN_LOAD_DATA_DAYS} dias com carga registrada na janela — há ${s.load.dataDays}. Os valores não são exibidos porque seriam instáveis, não porque são zero.`,
    };
  }

  const l = s.load;
  return {
    id: "estado-de-carga",
    title: "Estado de carga (CTL · ATL · TSB · ACWR)",
    stats: [
      { label: "CTL", value: fmtNum(l.ctl, 1), note: "crônica · 42d" },
      { label: "ATL", value: fmtNum(l.atl, 1), note: "aguda · 7d" },
      { label: "TSB", value: fmtNum(l.tsb, 1), note: "CTL − ATL" },
      { label: "ACWR", value: fmtNum(l.acwr ?? 0, 2), note: "ATL / CTL" },
    ],
    rows: [
      { label: "Monotonia (7d)", value: l.monotony != null ? fmtNum(l.monotony, 2) : "—" },
      { label: "Strain (7d)", value: l.strain != null ? fmtNum(l.strain) : "—" },
      {
        label: "Variação da CTL (7d)",
        value: l.rampPct != null ? `${fmtNum(l.rampPct * 100, 1)}%` : "—",
      },
      { label: "Dias com registro", value: `${l.dataDays} de ${s.period.days}` },
    ],
    paragraphs: [
      "Valores calculados a partir da série diária de carga interna do próprio atleta. São descrições do histórico registrado, não faixas-alvo nem limites de segurança.",
    ],
    notice: null,
  };
}

function readinessSection(s: ReportSnapshot): DocSection {
  const r = s.readiness;
  if (!hasReadinessSufficiency(s)) {
    return {
      id: "prontidao",
      title: "Prontidão",
      stats: [],
      rows: [],
      paragraphs: [],
      notice: `Dados insuficientes: ${r.count} ${pluralize(r.count, "check-in", "check-ins")} no período, abaixo dos ${MIN_READINESS_CHECKINS} necessários para uma leitura estável de prontidão.`,
    };
  }

  return {
    id: "prontidao",
    title: "Prontidão",
    stats: [
      { label: "Check-ins", value: String(r.count) },
      {
        label: "Última leitura",
        value: READINESS_LABEL[r.latestClass ?? ""] ?? "—",
      },
      { label: "Escore recente", value: r.latestScore != null ? String(r.latestScore) : "—" },
      { label: "Escore médio", value: r.averageScore != null ? String(r.averageScore) : "—" },
    ],
    rows: [],
    paragraphs: [
      "Prontidão é um composto do auto-relato diário (sono, fadiga, dores, estresse, motivação). É uma hipótese de disposição para treinar no dia, marcada como experimental — entra como sinal, nunca como decisão isolada.",
    ],
    notice: null,
  };
}

function sessionsSection(s: ReportSnapshot): DocSection {
  const a = s.adherence;
  const rows: DocRow[] = [
    { label: "Concluídas", value: String(a.completed) },
    { label: "Parciais", value: String(a.partial) },
    { label: "Perdidas", value: String(a.missed) },
  ];
  if (a.pending > 0) rows.push({ label: "Sem retorno até agora", value: String(a.pending) });

  return {
    id: "sessoes",
    title: "Treinos concluídos, parciais e perdidos",
    stats: [],
    rows,
    paragraphs:
      a.due > 0
        ? [
            'Uma sessão é "parcial" quando o atleta registrou execução incompleta, e "perdida" quando não houve execução registrada até o fim do período.',
          ]
        : [],
    notice: a.due === 0 ? "Nenhuma sessão prevista no período." : null,
  };
}

function commentsSection(s: ReportSnapshot): DocSection {
  return {
    id: "comentarios",
    title: "Comentários do atleta",
    stats: [],
    rows: s.comments.map((c) => ({
      label: `${fmtDayIso(c.date)} · ${c.workoutTitle}`,
      value:
        c.painLevel != null && c.painLevel > 0
          ? `${c.notes} (dor relatada: ${c.painLevel}/10)`
          : c.notes,
    })),
    paragraphs: s.comments.length
      ? [
          "Transcrição literal do que o atleta escreveu no feedback das sessões, sem edição nem interpretação.",
        ]
      : [],
    notice: s.comments.length === 0 ? "Nenhum comentário registrado no período." : null,
  };
}

function limitationsSection(s: ReportSnapshot, trainerLimitations: string | null): DocSection {
  const paragraphs: string[] = [REPORT_DISCLAIMER];

  const gaps: string[] = [];
  if (!hasAdherenceSufficiency(s)) gaps.push("não havia sessões previstas para medir aderência");
  if (!hasLoadSufficiency(s))
    gaps.push(
      `o histórico de carga (${s.load.dataDays} ${pluralize(s.load.dataDays, "dia", "dias")} com registro) não sustenta CTL/ATL/TSB/ACWR`,
    );
  if (!hasReadinessSufficiency(s))
    gaps.push(
      `houve ${s.readiness.count} ${pluralize(s.readiness.count, "check-in", "check-ins")} de prontidão`,
    );
  if (s.internalLoad.sessionsWithoutLoad > 0)
    gaps.push(
      `${s.internalLoad.sessionsWithoutLoad} ${pluralize(s.internalLoad.sessionsWithoutLoad, "sessão realizada ficou", "sessões realizadas ficaram")} sem sRPE`,
    );

  paragraphs.push(
    gaps.length
      ? `Neste período: ${gaps.join("; ")}. Onde o dado não sustenta a leitura, o relatório declara a lacuna em vez de estimar.`
      : "Neste período os registros cobriram aderência, carga e prontidão nos limiares mínimos de leitura.",
  );

  paragraphs.push(
    "A qualidade de toda a leitura depende da constância com que o atleta registra sessões, sRPE e check-ins. Ausência de registro não é ausência de treino.",
  );

  if (trainerLimitations) paragraphs.push(trainerLimitations);

  return {
    id: "limitacoes",
    title: "Limitações desta leitura",
    stats: [],
    rows: [],
    paragraphs,
    notice: null,
  };
}

function trainerNotesSection(
  insights: string | null,
  recommendations: string | null,
): DocSection | null {
  const paragraphs: string[] = [];
  if (insights) paragraphs.push(insights);
  if (recommendations) paragraphs.push(recommendations);
  if (paragraphs.length === 0) return null;

  return {
    id: "leitura-do-treinador",
    title: "Leitura do treinador",
    stats: [],
    rows: [],
    paragraphs,
    notice: null,
  };
}

// --- Builder --------------------------------------------------------------

export function buildReportDocument(input: ReportDocumentInput): ReportDocument {
  const { report } = input;
  const athleteName = input.athleteName?.trim() || "Atleta";
  const trainerName = input.trainerName?.trim() || "Treinador";
  const base = {
    reportId: report.id,
    athleteName,
    trainerName,
    periodLabel: `${fmtDay(report.periodStart)} a ${fmtDay(report.periodEnd)}`,
    statusLabel: REPORT_STATUS_LABEL[report.status] ?? report.status,
    generatedLabel: `Gerado em ${fmtDay(report.createdAt)}`,
    disclaimer: REPORT_DISCLAIMER,
  };

  const snapshot = parseReportSnapshot(report.metricsSnapshot);

  // Snapshot de versão desconhecida (relatório legado): não reinterpretamos os
  // campos antigos — declaramos e pedimos regeneração.
  if (!snapshot) {
    return {
      ...base,
      sections: [
        {
          id: "limitacoes",
          title: "Limitações desta leitura",
          stats: [],
          rows: [],
          paragraphs: [REPORT_DISCLAIMER],
          notice:
            "Este relatório foi gerado em uma versão anterior do formato de métricas e não pode ser reexibido no formato premium sem risco de reinterpretar os números. Gere um novo relatório para o mesmo período.",
        },
      ],
    };
  }

  const sections: DocSection[] = [
    executiveSummary(snapshot),
    adherenceSection(snapshot),
    volumeSection(snapshot),
    internalLoadSection(snapshot),
    loadStateSection(snapshot),
    readinessSection(snapshot),
    sessionsSection(snapshot),
    commentsSection(snapshot),
  ];

  const trainerNotes = trainerNotesSection(report.insights, report.recommendations);
  if (trainerNotes) sections.push(trainerNotes);

  sections.push(limitationsSection(snapshot, report.limitations));

  return { ...base, sections };
}
