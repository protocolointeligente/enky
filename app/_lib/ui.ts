// Shared Tailwind class strings for the MVP's plain HTML forms/buttons —
// not a component library, just enough to keep every page visually
// consistent without repeating the same long class strings everywhere.
export const uiClasses = {
  page: "min-h-screen bg-[#0a0f1c] px-6 py-12 text-slate-200",
  container: "mx-auto flex max-w-3xl flex-col gap-6",
  card: "rounded-xl border border-slate-800 bg-slate-900/60 p-6",
  heading: "text-2xl font-bold text-slate-50",
  label: "mb-1 block text-sm font-medium text-slate-300",
  input:
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-[#00e6c3]",
  select:
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-[#00e6c3]",
  button:
    "rounded-lg bg-gradient-to-r from-[#00e6c3] to-[#0066ff] px-4 py-2 font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50",
  buttonSecondary:
    "rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50",
  error: "rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300",
  success: "rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300",
  link: "text-[#00e6c3] hover:underline",
  badge: "rounded-full px-2.5 py-0.5 text-xs font-semibold",
} as const;

export const statusBadgeClass: Record<string, string> = {
  DRAFT: "bg-slate-700 text-slate-200",
  PUBLISHED: "bg-blue-900 text-blue-200",
  IN_PROGRESS: "bg-amber-900 text-amber-200",
  COMPLETED: "bg-emerald-900 text-emerald-200",
  PARTIAL: "bg-amber-900 text-amber-200",
  MISSED: "bg-red-900 text-red-200",
  ARCHIVED: "bg-slate-800 text-slate-400",
  CANCELLED: "bg-slate-800 text-slate-400",
};
