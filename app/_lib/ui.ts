// Shared Tailwind class strings built on the ENKY brand tokens (see
// app/globals.css @theme). Not a component library — just the common vocabulary
// so every page stays visually consistent. Orange is the performance CTA;
// electric blue carries links/data; turquesa signals success; danger is
// reserved for errors. Orange buttons use dark text for AA contrast on #FF6500.
export const uiClasses = {
  page: "min-h-screen bg-deep px-4 py-8 text-ink sm:px-6 sm:py-10",
  container: "mx-auto flex max-w-3xl flex-col gap-6",
  wide: "mx-auto flex max-w-6xl flex-col gap-6",

  card: "rounded-xl border border-line bg-petrol/70 p-5 sm:p-6",
  panel: "rounded-xl border border-line bg-petrol/70",

  heading: "font-display text-2xl font-bold tracking-tight text-ink",
  subheading: "font-display text-lg font-semibold tracking-tight text-ink",
  eyebrow: "text-xs font-semibold uppercase tracking-wider text-faint",

  label: "mb-1 block text-sm font-medium text-muted",
  input:
    "w-full rounded-lg border border-line bg-deep px-3 py-2 text-ink outline-none transition-colors placeholder:text-faint focus:border-electric",
  select:
    "w-full rounded-lg border border-line bg-deep px-3 py-2 text-ink outline-none transition-colors focus:border-electric",
  textarea:
    "w-full rounded-lg border border-line bg-deep px-3 py-2 text-ink outline-none transition-colors placeholder:text-faint focus:border-electric",

  // Primary CTA — laranja performance, texto escuro para contraste AA.
  button:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-orange px-4 py-2 font-semibold text-onbrand transition-colors hover:bg-orange-hi focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange disabled:cursor-not-allowed disabled:opacity-50",
  buttonSecondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 font-semibold text-ink transition-colors hover:border-electric hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:cursor-not-allowed disabled:opacity-50",
  buttonGhost:
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium text-muted transition-colors hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
  buttonDanger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50",

  error: "rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger",
  success: "rounded-lg border border-turq/40 bg-turq/10 px-3 py-2 text-sm text-turq",
  hint: "text-sm text-muted",
  link: "text-electric transition-colors hover:text-electric-hi hover:underline",
  badge: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
} as const;

export const statusBadgeClass: Record<string, string> = {
  DRAFT: "bg-surface text-muted",
  PUBLISHED: "bg-electric/15 text-electric-hi",
  IN_PROGRESS: "bg-orange/15 text-orange-hi",
  COMPLETED: "bg-turq/15 text-turq",
  PARTIAL: "bg-orange/15 text-orange-hi",
  MISSED: "bg-danger/15 text-danger",
  ARCHIVED: "bg-surface text-faint",
  CANCELLED: "bg-surface text-faint",
};
