"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import { ExerciseDemo } from "@/components/exercise-demo";

interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  targetMuscles: string[];
  modality: string | null;
  equipment: string | null;
  level: string | null;
  description: string | null;
  videoUrl: string | null;
  videoSource: string | null;
  videoLicense: string | null;
  isActive: boolean;
  isGlobal: boolean;
  editable: boolean;
}

interface ExerciseFormValues {
  id: string | null;
  name: string;
  category: string;
  targetMuscles: string;
  modality: string;
  equipment: string;
  level: string;
  description: string;
  videoUrl: string;
  videoSource: string;
  videoLicense: string;
}

const emptyForm: ExerciseFormValues = {
  id: null,
  name: "",
  category: "",
  targetMuscles: "",
  modality: "",
  equipment: "",
  level: "",
  description: "",
  videoUrl: "",
  videoSource: "",
  videoLicense: "",
};

const MODALITIES = [
  ["RUNNING", "Corrida"],
  ["STRENGTH", "Força"],
  ["FUNCTIONAL", "Funcional"],
  ["CYCLING", "Ciclismo"],
  ["SWIMMING", "Natação"],
  ["TRIATHLON", "Triatlo"],
] as const;

const LEVELS = ["iniciante", "intermediário", "avançado"] as const;

const modalityLabel = (value: string | null) =>
  MODALITIES.find(([v]) => v === value)?.[1] ?? null;

interface Filters {
  search: string;
  category: string;
  modality: string;
  muscleGroup: string;
  equipment: string;
  level: string;
  hasVideo: string;
  includeInactive: boolean;
}

const emptyFilters: Filters = {
  search: "",
  category: "",
  modality: "",
  muscleGroup: "",
  equipment: "",
  level: "",
  hasVideo: "",
  includeInactive: false,
};

export default function TrainerExercisesPage() {
  const { checked } = useRequireRole("TRAINER");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [form, setForm] = useState<ExerciseFormValues | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.category.trim()) params.set("category", filters.category.trim());
    if (filters.modality) params.set("modality", filters.modality);
    if (filters.muscleGroup.trim()) params.set("muscleGroup", filters.muscleGroup.trim());
    if (filters.equipment.trim()) params.set("equipment", filters.equipment.trim());
    if (filters.level) params.set("level", filters.level);
    if (filters.hasVideo) params.set("hasVideo", filters.hasVideo);
    if (filters.includeInactive) params.set("includeInactive", "true");
    return apiFetch<{ exercises: ExerciseItem[] }>(`/api/trainer/exercises?${params.toString()}`)
      .then((r) => {
        setExercises(r.exercises);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [filters]);

  useEffect(() => {
    if (!checked) return;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [checked, load]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const optional = (value: string) => (value.trim() === "" ? undefined : value.trim());
    const body = JSON.stringify({
      name: form.name,
      category: form.category,
      targetMuscles: form.targetMuscles
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      modality: optional(form.modality),
      equipment: optional(form.equipment),
      level: optional(form.level),
      description: optional(form.description),
      videoUrl: optional(form.videoUrl),
      videoSource: optional(form.videoSource),
      videoLicense: optional(form.videoLicense),
    });
    try {
      if (form.id) {
        await apiFetch(`/api/trainer/exercises/${form.id}`, { method: "PATCH", body });
        setNotice("Exercício atualizado.");
      } else {
        await apiFetch("/api/trainer/exercises", { method: "POST", body });
        setNotice("Exercício criado.");
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: ExerciseItem) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const action = item.isActive ? "archive" : "reactivate";
      await apiFetch(`/api/trainer/exercises/${item.id}/${action}`, { method: "POST" });
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
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const withVideo = exercises.filter((e) => e.videoUrl).length;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className={uiClasses.eyebrow}>Biblioteca</span>
            <h1 className={uiClasses.heading}>Exercícios</h1>
            <p className={uiClasses.hint}>
              {exercises.length} exercício{exercises.length === 1 ? "" : "s"} · {withVideo} com
              demonstração em vídeo
            </p>
          </div>
          <button
            type="button"
            className={uiClasses.button}
            onClick={() => setForm({ ...emptyForm })}
          >
            + Novo exercício
          </button>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}
        {notice && <p className={uiClasses.success}>{notice}</p>}

        <section className={`${uiClasses.card} flex flex-col gap-3`}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={uiClasses.input}
              placeholder="Buscar por nome..."
              aria-label="Buscar por nome"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <select
              className={uiClasses.select}
              aria-label="Modalidade"
              value={filters.modality}
              onChange={(e) => setFilters({ ...filters, modality: e.target.value })}
            >
              <option value="">Modalidade: todas</option>
              {MODALITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              className={uiClasses.input}
              placeholder="Categoria"
              aria-label="Categoria"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            />
            <input
              className={uiClasses.input}
              placeholder="Grupo muscular"
              aria-label="Grupo muscular"
              value={filters.muscleGroup}
              onChange={(e) => setFilters({ ...filters, muscleGroup: e.target.value })}
            />
            <input
              className={uiClasses.input}
              placeholder="Equipamento"
              aria-label="Equipamento"
              value={filters.equipment}
              onChange={(e) => setFilters({ ...filters, equipment: e.target.value })}
            />
            <select
              className={uiClasses.select}
              aria-label="Nível"
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            >
              <option value="">Nível: todos</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <select
              className={uiClasses.select}
              aria-label="Vídeo"
              value={filters.hasVideo}
              onChange={(e) => setFilters({ ...filters, hasVideo: e.target.value })}
            >
              <option value="">Vídeo: tanto faz</option>
              <option value="true">Com vídeo</option>
              <option value="false">Sem vídeo</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 accent-orange"
                checked={filters.includeInactive}
                onChange={(e) => setFilters({ ...filters, includeInactive: e.target.checked })}
              />
              Incluir inativos
            </label>
          </div>
          <button
            type="button"
            className="self-start text-xs text-muted transition-colors hover:text-ink"
            onClick={() => setFilters(emptyFilters)}
          >
            Limpar filtros
          </button>
        </section>

        {exercises.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nenhum exercício encontrado.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exercises.map((item) => (
              <li
                key={item.id}
                className={`flex flex-col overflow-hidden rounded-xl border border-line bg-petrol/60 transition-colors hover:border-line-strong ${
                  item.isActive ? "" : "opacity-60"
                }`}
              >
                {item.videoUrl ? (
                  <ExerciseDemo name={item.name} url={item.videoUrl} size="card" />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-surface">
                    <span className="text-xs text-faint">Sem vídeo</span>
                  </div>
                )}

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-sm font-semibold leading-tight text-ink">
                      {item.name}
                    </h2>
                    <div className="flex shrink-0 gap-1">
                      {!item.isActive && (
                        <span className={`${uiClasses.badge} bg-surface text-faint`}>Inativo</span>
                      )}
                      <span
                        className={`${uiClasses.badge} ${
                          item.isGlobal ? "bg-surface text-muted" : "bg-electric/15 text-electric-hi"
                        }`}
                      >
                        {item.isGlobal ? "Global" : "Minha org"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[
                      modalityLabel(item.modality),
                      item.category,
                      item.equipment,
                      item.level,
                    ]
                      .filter(Boolean)
                      .map((chip) => (
                        <span
                          key={chip as string}
                          className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted"
                        >
                          {chip}
                        </span>
                      ))}
                  </div>

                  {item.targetMuscles.length > 0 && (
                    <p className="text-xs text-faint">{item.targetMuscles.join(" · ")}</p>
                  )}

                  {item.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                      {item.description}
                    </p>
                  )}

                  {item.videoUrl && (item.videoSource || item.videoLicense) && (
                    <p className="truncate text-[11px] text-faint">
                      Vídeo: {[item.videoSource, item.videoLicense].filter(Boolean).join(" — ")}
                    </p>
                  )}

                  {item.editable && (
                    <div className="mt-auto flex items-center gap-3 border-t border-line pt-3">
                      <button
                        type="button"
                        className={`text-xs ${uiClasses.link} disabled:opacity-50`}
                        disabled={busy}
                        onClick={() =>
                          setForm({
                            id: item.id,
                            name: item.name,
                            category: item.category,
                            targetMuscles: item.targetMuscles.join(", "),
                            modality: item.modality ?? "",
                            equipment: item.equipment ?? "",
                            level: item.level ?? "",
                            description: item.description ?? "",
                            videoUrl: item.videoUrl ?? "",
                            videoSource: item.videoSource ?? "",
                            videoLicense: item.videoLicense ?? "",
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
                        disabled={busy}
                        onClick={() => toggleActive(item)}
                      >
                        {item.isActive ? "Arquivar" : "Reativar"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setForm(null)}
        >
          <form
            className={`${uiClasses.card} max-h-[90vh] w-full max-w-md flex flex-col gap-3 overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
          >
            <h2 className="font-display font-semibold text-ink">
              {form.id ? "Editar exercício" : "Novo exercício"}
            </h2>
            <div>
              <label className={uiClasses.label} htmlFor="ex-name">
                Nome
              </label>
              <input
                id="ex-name"
                required
                className={uiClasses.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-category">
                Categoria
              </label>
              <input
                id="ex-category"
                required
                className={uiClasses.input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-modality">
                Modalidade (opcional)
              </label>
              <select
                id="ex-modality"
                className={uiClasses.select}
                value={form.modality}
                onChange={(e) => setForm({ ...form, modality: e.target.value })}
              >
                <option value="">—</option>
                {MODALITIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-muscles">
                Grupos musculares (separados por vírgula)
              </label>
              <input
                id="ex-muscles"
                className={uiClasses.input}
                value={form.targetMuscles}
                onChange={(e) => setForm({ ...form, targetMuscles: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-equipment">
                Equipamento (opcional)
              </label>
              <input
                id="ex-equipment"
                className={uiClasses.input}
                placeholder="barra, halter, peso corporal..."
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-level">
                Nível (opcional)
              </label>
              <select
                id="ex-level"
                className={uiClasses.select}
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                <option value="">—</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-description">
                Descrição / execução (opcional)
              </label>
              <textarea
                id="ex-description"
                rows={3}
                className={uiClasses.input}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-video">
                URL do vídeo (opcional)
              </label>
              <input
                id="ex-video"
                type="url"
                className={uiClasses.input}
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-video-source">
                Origem do vídeo (opcional)
              </label>
              <input
                id="ex-video-source"
                className={uiClasses.input}
                placeholder="YouTube, gravação própria, MuscleWiki..."
                value={form.videoSource}
                onChange={(e) => setForm({ ...form, videoSource: e.target.value })}
              />
            </div>
            <div>
              <label className={uiClasses.label} htmlFor="ex-video-license">
                Licença / observação do vídeo (opcional)
              </label>
              <input
                id="ex-video-license"
                className={uiClasses.input}
                placeholder="CC BY 4.0, uso autorizado, material próprio..."
                value={form.videoLicense}
                onChange={(e) => setForm({ ...form, videoLicense: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${uiClasses.buttonSecondary} flex-1`}
                onClick={() => setForm(null)}
              >
                Cancelar
              </button>
              <button type="submit" className={`${uiClasses.button} flex-1`} disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
