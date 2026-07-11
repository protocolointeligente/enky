"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";

interface TemplateListItem {
  id: string;
  title: string;
  description: string | null;
  modality: string;
  isActive: boolean;
}

interface AthleteOption {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
}

export default function TrainerTemplatesPage() {
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState<TemplateListItem | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (includeInactive) params.set("includeInactive", "true");
    return apiFetch<{ templates: TemplateListItem[] }>(
      `/api/trainer/templates?${params.toString()}`,
    )
      .then((r) => {
        setTemplates(r.templates);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [includeInactive]);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes")
      .then((r) => setAthletes(r.athletes))
      .catch(() => undefined);
  }, [checked]);

  useEffect(() => {
    if (!checked) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [checked, load]);

  async function runAction(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <div className="flex items-center justify-between">
          <h1 className={uiClasses.heading}>Templates</h1>
          <Link href="/treinador/templates/novo" className={uiClasses.button}>
            + Novo template
          </Link>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}
        {notice && <p className={uiClasses.success}>{notice}</p>}

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Incluir arquivados
        </label>

        <section className={`${uiClasses.card} flex flex-col gap-2`}>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhum template ainda. Crie um do zero ou salve um treino como template.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {templates.map((tpl) => (
                <li
                  key={tpl.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-slate-100">
                      <span className="truncate">{tpl.title}</span>
                      <span className={`${uiClasses.badge} bg-slate-700 text-slate-200`}>
                        {tpl.modality}
                      </span>
                      {!tpl.isActive && (
                        <span className={`${uiClasses.badge} bg-slate-800 text-slate-400`}>
                          Arquivado
                        </span>
                      )}
                    </p>
                    {tpl.description && (
                      <p className="truncate text-xs text-slate-400">{tpl.description}</p>
                    )}
                  </div>
                  {tpl.isActive && (
                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <button
                        type="button"
                        className="text-[#00e6c3] hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setApplying(tpl)}
                      >
                        Aplicar
                      </button>
                      <Link
                        href={`/treinador/templates/${tpl.id}/editar`}
                        className="text-slate-300 hover:underline"
                      >
                        Editar
                      </Link>
                      <button
                        type="button"
                        className="text-slate-300 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiFetch(`/api/trainer/templates/${tpl.id}/duplicate`, {
                                method: "POST",
                              }),
                            "Template duplicado.",
                          )
                        }
                      >
                        Duplicar
                      </button>
                      <button
                        type="button"
                        className="text-red-400 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          runAction(
                            () =>
                              apiFetch(`/api/trainer/templates/${tpl.id}/archive`, {
                                method: "POST",
                              }),
                            "Template arquivado.",
                          )
                        }
                      >
                        Arquivar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {applying && (
        <ApplyTemplateModal
          template={applying}
          athletes={athletes}
          onClose={() => setApplying(null)}
          onApplied={(workoutId) => router.push(`/treinador/treinos/${workoutId}`)}
        />
      )}
    </main>
  );
}

function ApplyTemplateModal({
  template,
  athletes,
  onClose,
  onApplied,
}: {
  template: TemplateListItem;
  athletes: AthleteOption[];
  onClose: () => void;
  onApplied: (workoutId: string) => void;
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.athleteProfileId ?? "");
  const [plannedDate, setPlannedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ workoutId: string }>(
        `/api/trainer/templates/${template.id}/apply`,
        {
          method: "POST",
          body: JSON.stringify({ athleteId, plannedDate }),
        },
      );
      onApplied(result.workoutId);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        className={`${uiClasses.card} flex w-full max-w-md flex-col gap-3`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleApply}
      >
        <h2 className="font-semibold text-slate-100">Aplicar “{template.title}”</h2>
        {error && <p className={uiClasses.error}>{error}</p>}
        <div>
          <label className={uiClasses.label} htmlFor="apply-athlete">
            Atleta
          </label>
          <select
            id="apply-athlete"
            required
            className={uiClasses.select}
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
          >
            <option value="" disabled>
              Selecione um atleta
            </option>
            {athletes.map((a) => (
              <option key={a.athleteProfileId} value={a.athleteProfileId}>
                {a.name ?? a.email ?? a.athleteProfileId}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="apply-date">
            Data planejada
          </label>
          <input
            id="apply-date"
            type="date"
            required
            className={uiClasses.input}
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button type="button" className={`${uiClasses.buttonSecondary} flex-1`} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={`${uiClasses.button} flex-1`} disabled={busy}>
            {busy ? "Aplicando..." : "Aplicar (cria rascunho)"}
          </button>
        </div>
      </form>
    </div>
  );
}
