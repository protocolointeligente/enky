"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import { VideoPlayer } from "@/components/video-player";

interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  targetMuscles: string[];
  videoUrl: string | null;
  isActive: boolean;
  isGlobal: boolean;
  editable: boolean;
}

interface ExerciseFormValues {
  id: string | null;
  name: string;
  category: string;
  targetMuscles: string;
  videoUrl: string;
}

const emptyForm: ExerciseFormValues = {
  id: null,
  name: "",
  category: "",
  targetMuscles: "",
  videoUrl: "",
};

export default function TrainerExercisesPage() {
  const { checked } = useRequireRole("TRAINER");
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState<ExerciseFormValues | null>(null);
  const [playing, setPlaying] = useState<{ name: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (includeInactive) params.set("includeInactive", "true");
    return apiFetch<{ exercises: ExerciseItem[] }>(`/api/trainer/exercises?${params.toString()}`)
      .then((r) => {
        setExercises(r.exercises);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [search, includeInactive]);

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
    const body = JSON.stringify({
      name: form.name,
      category: form.category,
      targetMuscles: form.targetMuscles
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      videoUrl: form.videoUrl.trim() === "" ? undefined : form.videoUrl.trim(),
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
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <div className="flex items-center justify-between">
          <h1 className={uiClasses.heading}>Exercícios</h1>
          <button
            type="button"
            className={uiClasses.button}
            onClick={() => setForm({ ...emptyForm })}
          >
            + Novo exercício
          </button>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}
        {notice && <p className={uiClasses.success}>{notice}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <input
            className={uiClasses.input}
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Incluir inativos
          </label>
        </div>

        <section className={`${uiClasses.card} flex flex-col gap-2`}>
          {exercises.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum exercício encontrado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {exercises.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-slate-100">
                      <span className="truncate">{item.name}</span>
                      <span
                        className={`${uiClasses.badge} ${item.isGlobal ? "bg-slate-700 text-slate-200" : "bg-blue-900 text-blue-200"}`}
                      >
                        {item.isGlobal ? "Global" : "Minha organização"}
                      </span>
                      {!item.isActive && (
                        <span className={`${uiClasses.badge} bg-slate-800 text-slate-400`}>
                          Inativo
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {item.category}
                      {item.targetMuscles.length ? ` · ${item.targetMuscles.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.videoUrl && (
                      <button
                        type="button"
                        className="text-xs font-medium text-electric-hi hover:underline"
                        onClick={() => setPlaying({ name: item.name, url: item.videoUrl! })}
                      >
                        ▶ Vídeo
                      </button>
                    )}
                    {item.editable && (
                      <>
                        <button
                          type="button"
                          className="text-xs text-[#00e6c3] hover:underline disabled:opacity-50"
                          disabled={busy}
                          onClick={() =>
                            setForm({
                              id: item.id,
                              name: item.name,
                              category: item.category,
                              targetMuscles: item.targetMuscles.join(", "),
                              videoUrl: item.videoUrl ?? "",
                            })
                          }
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:underline disabled:opacity-50"
                          disabled={busy}
                          onClick={() => toggleActive(item)}
                        >
                          {item.isActive ? "Arquivar" : "Reativar"}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {form && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setForm(null)}
        >
          <form
            className={`${uiClasses.card} w-full max-w-md flex flex-col gap-3`}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
          >
            <h2 className="font-semibold text-slate-100">
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

      {playing && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-petrol p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">{playing.name}</h2>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => setPlaying(null)}
              >
                Fechar
              </button>
            </div>
            <VideoPlayer url={playing.url} />
          </div>
        </div>
      )}
    </main>
  );
}
