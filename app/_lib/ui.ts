// Shared Tailwind class strings built on the ENKY brand tokens (see
// app/globals.css @theme). Not a component library — just the common vocabulary
// so every page stays visually consistent.
//
// Semântica de cor:
//   Orange   → CTA primário, ações de performance, alertas de decisão
//   Electric → dados/links, séries de gráfico, informação secundária
//   Turquesa → sucesso, prontidão, recuperação
//   Danger   → erro, risco alto, condição crítica (uso restrito)
//   Warning  → atenção moderada (ACWR levemente alto, carga elevada)
//
// Orange buttons use dark text (--color-onbrand) for AA contrast on #FF6500.
export const uiClasses = {
  // Layout
  page:      "min-h-screen bg-deep px-4 py-6 text-ink sm:px-6 sm:py-8",
  container: "mx-auto flex max-w-3xl flex-col gap-6",
  wide:      "mx-auto flex max-w-6xl flex-col gap-6",

  // Surfaces
  card:  "rounded-2xl border border-line bg-petrol p-5 sm:p-6",
  panel: "rounded-2xl border border-line bg-petrol overflow-hidden",

  // KPI card — usado em dashboards de treinador e atleta
  kpiCard: "flex flex-col gap-1.5 rounded-2xl border border-line bg-kpi-bg p-4 transition-colors hover:border-line-strong",

  // Alert card — fundo de atenção com semáforo lateral
  alertCardHigh: "flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-lo p-4",
  alertCardMid:  "flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-lo p-4",
  alertCardLow:  "flex items-start gap-3 rounded-2xl border border-line bg-surface p-4",

  // Typography
  heading:    "font-display text-2xl font-bold tracking-tight text-ink",
  subheading: "font-display text-base font-semibold tracking-tight text-ink",
  eyebrow:    "text-[11px] font-semibold uppercase tracking-widest text-faint",
  metric:     "font-display tabular text-3xl font-bold text-ink leading-none",

  // Section header — label + action link na mesma linha
  sectionHeader: "flex items-center justify-between mb-3",

  // Forms
  label:    "mb-1 block text-sm font-medium text-muted",
  input:    "w-full rounded-xl border border-line bg-deep px-3 py-2.5 text-ink outline-none transition-colors placeholder:text-faint focus:border-electric focus:ring-1 focus:ring-electric/30",
  select:   "w-full rounded-xl border border-line bg-deep px-3 py-2.5 text-ink outline-none transition-colors focus:border-electric focus:ring-1 focus:ring-electric/30",
  textarea: "w-full rounded-xl border border-line bg-deep px-3 py-2.5 text-ink outline-none transition-colors placeholder:text-faint focus:border-electric focus:ring-1 focus:ring-electric/30",

  // Buttons
  button: "inline-flex items-center justify-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-onbrand transition-all hover:bg-orange-hi active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:cursor-not-allowed disabled:opacity-50",
  buttonSecondary: "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-all hover:border-electric hover:bg-surface-2 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:cursor-not-allowed disabled:opacity-50",
  buttonGhost:     "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
  buttonDanger:    "inline-flex items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger-lo px-4 py-2.5 text-sm font-semibold text-danger transition-all hover:bg-danger/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50",

  // Feedback
  error:   "rounded-xl border border-danger/40 bg-danger-lo px-4 py-3 text-sm text-danger",
  success: "rounded-xl border border-turq/40 bg-turq-lo px-4 py-3 text-sm text-turq",
  hint:    "text-sm text-muted",
  link:    "text-electric-hi underline-offset-2 transition-colors hover:text-electric hover:underline",
  badge:   "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
} as const;

export const statusBadgeClass: Record<string, string> = {
  DRAFT:       "bg-surface text-muted",
  PUBLISHED:   "bg-electric-lo text-electric-hi",
  IN_PROGRESS: "bg-orange-lo text-orange-hi",
  COMPLETED:   "bg-turq-lo text-turq",
  PARTIAL:     "bg-warning-lo text-warning",
  MISSED:      "bg-danger-lo text-danger",
  ARCHIVED:    "bg-surface text-faint",
  CANCELLED:   "bg-surface text-faint",
};
