"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { MODALITIES } from "@/modules/periodization/periodization-schema";

// Biblioteca científica de sessões (Fase 2) — leitura. O treinador navega o
// catálogo por modalidade/fase/nível e vê objetivo, sistema energético, zona,
// contraindicações, pré-requisitos e a EVIDÊNCIA de cada sessão. Dado estático;
// a página só filtra e exibe.

interface CatalogSession {
  id: string;
  modality: string;
  title: string;
  objective: string;
  sessionKind: string;
  idealPhases: string[];
  levels: string[];
  energySystem: string;
  method: string;
  intensity: string;
  description: string;
  durationMin: [number, number];
  estimatedLoadPerHour: number;
  contraindications: string[];
  prerequisites: string[];
  evidenceLevel: "A" | "B" | "C";
  references: string[];
}

const MODALITY_LABEL: Record<string, string> = {
  RUNNING: "Corrida",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
  STRENGTH: "Musculação",
  FUNCTIONAL: "Funcional",
};

const PHASES = [
  ["", "Todas as fases"],
  ["BASE", "Base"],
  ["BUILD", "Específico"],
  ["PEAK", "Pico"],
  ["TAPER", "Taper"],
  ["TRANSITION", "Transição"],
] as const;

const LEVELS = [
  ["", "Todos os níveis"],
  ["BEGINNER", "Iniciante"],
  ["INTERMEDIATE", "Intermediário"],
  ["ADVANCED", "Avançado"],
] as const;

const ENERGY_LABEL: Record<string, string> = {
  AEROBIC_BASE: "Aeróbico base",
  AEROBIC_THRESHOLD: "Limiar aeróbico",
  VO2MAX: "VO₂máx",
  ANAEROBIC: "Anaeróbico",
  NEUROMUSCULAR: "Neuromuscular",
  MIXED: "Misto",
};

const EVIDENCE_CLS: Record<string, string> = {
  A: "bg-turq/15 text-turq",
  B: "bg-electric/15 text-electric",
  C: "bg-orange/15 text-orange",
};

export default function TrainingLibraryPage() {
  const { checked } = useRequireRole("TRAINER");
  const [modality, setModality] = useState("");
  const [phase, setPhase] = useState("");
  const [level, setLevel] = useState("");
  const [sessions, setSessions] = useState<CatalogSession[]>([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checked) return;
    const params = new URLSearchParams();
    if (modality) params.set("modality", modality);
    if (phase) params.set("phase", phase);
    if (level) params.set("level", level);
    setLoading(true);
    apiFetch<{ version: string; sessions: CatalogSession[] }>(
      `/api/trainer/training-library?${params.toString()}`,
    )
      .then((r) => {
        setSessions(r.sessions);
        setVersion(r.version);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [checked, modality, phase, level]);

  if (!checked) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Biblioteca</span>
          <h1 className={uiClasses.heading}>Sessões científicas</h1>
          <p className={uiClasses.hint}>
            Catálogo fundamentado por modalidade — objetivo, sistema energético, zona,
            contraindicações e evidência de cada sessão. É a base que o ENKY usa para sugerir e
            explicar. {version && <span className="text-faint">({version})</span>}
          </p>
        </header>

        <section className={`${uiClasses.card} grid gap-3 sm:grid-cols-3`}>
          <div>
            <label htmlFor="f-modality" className={uiClasses.label}>
              Modalidade
            </label>
            <select
              id="f-modality"
              className={uiClasses.select}
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            >
              <option value="">Todas as modalidades</option>
              {MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {MODALITY_LABEL[m] ?? m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-phase" className={uiClasses.label}>
              Fase
            </label>
            <select
              id="f-phase"
              className={uiClasses.select}
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            >
              {PHASES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-level" className={uiClasses.label}>
              Nível
            </label>
            <select
              id="f-level"
              className={uiClasses.select}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              {LEVELS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <p className="text-sm text-muted">Carregando sessões…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma sessão para este filtro.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((s) => (
              <article key={s.id} className={`${uiClasses.card} flex flex-col gap-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-ink">{s.title}</h2>
                    <p className="text-xs text-faint">
                      {MODALITY_LABEL[s.modality] ?? s.modality} · {ENERGY_LABEL[s.energySystem] ?? s.energySystem}
                    </p>
                  </div>
                  <span
                    className={`${uiClasses.badge} ${EVIDENCE_CLS[s.evidenceLevel] ?? ""}`}
                    title="Nível de evidência"
                  >
                    Evidência {s.evidenceLevel}
                  </span>
                </div>

                <p className="text-sm text-muted">{s.objective}</p>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-faint">Método</dt>
                  <dd className="text-ink">{s.method}</dd>
                  <dt className="text-faint">Intensidade</dt>
                  <dd className="text-ink">{s.intensity}</dd>
                  <dt className="text-faint">Duração</dt>
                  <dd className="text-ink">
                    {s.durationMin[0]}–{s.durationMin[1]} min
                  </dd>
                  <dt className="text-faint">Fases</dt>
                  <dd className="text-ink">{s.idealPhases.join(", ")}</dd>
                </dl>

                <p className="text-xs text-muted">{s.description}</p>

                {s.contraindications.length > 0 && (
                  <p className="text-xs text-orange">
                    Evitar: {s.contraindications.join("; ")}.
                  </p>
                )}
                {s.prerequisites.length > 0 && (
                  <p className="text-xs text-faint">Pré-requisito: {s.prerequisites.join("; ")}.</p>
                )}

                <details className="text-[11px] text-faint">
                  <summary className="cursor-pointer">Referências</summary>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {s.references.map((ref, i) => (
                      <li key={i}>· {ref}</li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </div>
        )}

        <Link href="/treinador" className={uiClasses.link}>
          ← Voltar ao painel
        </Link>
      </div>
    </main>
  );
}
