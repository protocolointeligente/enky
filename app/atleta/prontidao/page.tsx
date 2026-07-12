"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { toISODate } from "@/app/_lib/calendar";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";

type ReadinessClass = "boa" | "atencao" | "baixa" | "insuficiente";

interface ReadinessView {
  id: string;
  checkInDate: string;
  sleepHours: number | null;
  sleepQuality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
  notes: string | null;
  readiness: { class: ReadinessClass; score: number | null; signalsUsed: number };
}

const CLASS_META: Record<ReadinessClass, { label: string; cls: string }> = {
  boa: { label: "Boa", cls: "bg-turq/15 text-turq" },
  atencao: { label: "Atenção", cls: "bg-electric/15 text-electric-hi" },
  baixa: { label: "Baixa", cls: "bg-danger/15 text-danger" },
  insuficiente: { label: "Dados insuficientes", cls: "bg-surface text-faint" },
};

// Escalas do questionário (ENKY_METRIC_REGISTRY: prontidão). 0–10.
const SCALES = [
  { key: "sleepQuality", label: "Qualidade do sono", low: "péssima", high: "ótima" },
  { key: "fatigue", label: "Fadiga", low: "nenhuma", high: "exausto" },
  { key: "soreness", label: "Dor muscular", low: "nenhuma", high: "muita" },
  { key: "stress", label: "Estresse", low: "calmo", high: "muito" },
  { key: "motivation", label: "Motivação", low: "baixa", high: "alta" },
] as const;

type ScaleKey = (typeof SCALES)[number]["key"];

function ReadinessChip({ klass }: { klass: ReadinessClass }) {
  const meta = CLASS_META[klass];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
  );
}

export default function AthleteReadinessPage() {
  const { checked } = useRequireRole("ATHLETE");
  const todayIso = useMemo(() => toISODate(new Date()), []);

  const [history, setHistory] = useState<ReadinessView[]>([]);
  const [sleepHours, setSleepHours] = useState("");
  const [scales, setScales] = useState<Record<ScaleKey, number>>({
    sleepQuality: 5,
    fatigue: 5,
    soreness: 0,
    stress: 5,
    motivation: 5,
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ReadinessView | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ checkIns: ReadinessView[] }>("/api/athlete/readiness")
      .then((r) => {
        setHistory(r.checkIns);
        const today = r.checkIns.find((c) => c.checkInDate === todayIso);
        if (today) {
          setSaved(today);
          if (today.sleepHours != null) setSleepHours(String(today.sleepHours));
          setScales({
            sleepQuality: today.sleepQuality ?? 5,
            fatigue: today.fatigue ?? 5,
            soreness: today.soreness ?? 0,
            stress: today.stress ?? 5,
            motivation: today.motivation ?? 5,
          });
          setNotes(today.notes ?? "");
        }
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked, todayIso]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, number | string> = { ...scales };
      if (sleepHours.trim() !== "") body.sleepHours = Number(sleepHours);
      if (notes.trim() !== "") body.notes = notes.trim();

      const result = await apiFetch<{ checkIn: ReadinessView }>("/api/athlete/readiness", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSaved(result.checkIn);
      setHistory((prev) => [
        result.checkIn,
        ...prev.filter((c) => c.checkInDate !== result.checkIn.checkInDate),
      ]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Não foi possível salvar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Prontidão de hoje</span>
          <h1 className={uiClasses.heading}>Como você está hoje?</h1>
          <p className={uiClasses.hint}>
            Um check-in rápido ajuda seu treinador a ajustar a sessão. Não é diagnóstico.
          </p>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {saved && (
          <div className="flex items-center justify-between rounded-xl border border-line bg-petrol/70 p-4">
            <span className="text-sm text-muted">Check-in de hoje registrado</span>
            <ReadinessChip klass={saved.readiness.class} />
          </div>
        )}

        <section className="flex flex-col gap-5 rounded-2xl border border-line bg-petrol/70 p-5">
          <div>
            <label htmlFor="sleepHours" className={uiClasses.label}>
              Horas de sono
            </label>
            <input
              id="sleepHours"
              type="number"
              min={0}
              max={24}
              step={0.5}
              inputMode="decimal"
              className={uiClasses.input}
              placeholder="ex.: 7.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
            />
          </div>

          {SCALES.map((scale) => (
            <div key={scale.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-muted">{scale.label}</span>
                <span className="tabular text-sm font-semibold text-ink">{scales[scale.key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                className="w-full accent-electric"
                value={scales[scale.key]}
                onChange={(e) =>
                  setScales((prev) => ({ ...prev, [scale.key]: Number(e.target.value) }))
                }
                aria-label={scale.label}
              />
              <div className="flex justify-between text-[11px] text-faint">
                <span>{scale.low}</span>
                <span>{scale.high}</span>
              </div>
            </div>
          ))}

          <div>
            <label htmlFor="notes" className={uiClasses.label}>
              Observações (opcional)
            </label>
            <textarea
              id="notes"
              className={uiClasses.textarea}
              rows={2}
              maxLength={2000}
              placeholder="Algo que seu treinador deveria saber?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="button"
            className={uiClasses.button}
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Salvando…" : saved ? "Atualizar check-in" : "Enviar check-in"}
          </button>
        </section>

        {history.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={uiClasses.subheading}>Últimos dias</h2>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-petrol/70">
              {history.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm capitalize text-ink">
                    {new Date(`${c.checkInDate}T00:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  <ReadinessChip klass={c.readiness.class} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href="/atleta" className={uiClasses.link}>
          ← Voltar
        </Link>
      </div>
    </main>
  );
}
