"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { TrendingUpIcon } from "@/components/ui/icons";
import {
  GOAL_MODALITIES,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  GOAL_TYPES,
} from "@/modules/goals/goal-schema";

interface GoalEvent {
  id: string;
  kind: string;
  authorRole: string;
  note: string | null;
  changedFields: string[];
  createdAt: string;
}
interface Goal {
  id: string;
  title: string;
  type: string;
  modality: string | null;
  targetEvent: string | null;
  targetDate: string | null;
  weeklyFrequency: number | null;
  priority: string;
  status: string;
  progress: number;
  notes: string | null;
  lockVersion: number;
  events: GoalEvent[];
}

const TYPE_LABEL: Record<string, string> = {
  RACE: "Prova",
  PERFORMANCE: "Performance",
  CONDITIONING: "Condicionamento",
  HEALTH: "Saúde",
  BODY_COMPOSITION: "Composição corporal",
  ADHERENCE: "Aderência",
  RETURN_TO_SPORT: "Retorno ao esporte",
  CUSTOM: "Personalizado",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  ACHIEVED: "Alcançado",
  MISSED: "Não atingido",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
};
const PRIORITY_LABEL: Record<string, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };
const MODALITY_LABEL: Record<string, string> = {
  RUNNING: "Corrida",
  STRENGTH: "Força",
  FUNCTIONAL: "Funcional",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
};

export default function AthleteGoalsPage() {
  const { checked } = useRequireRole("ATHLETE");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined); // undefined=fechado, null=novo

  async function reload() {
    try {
      const { goals } = await apiFetch<{ goals: Goal[] }>("/api/athlete/goals");
      setGoals(goals);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (checked) void reload();
  }, [checked]);

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className={uiClasses.eyebrow}>Suas metas</span>
            <h1 className={uiClasses.heading}>Objetivos</h1>
          </div>
          <button type="button" className={uiClasses.button} onClick={() => setEditing(null)}>
            + Nova meta
          </button>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : goals.length === 0 ? (
          <EmptyState
            title="Você ainda não definiu objetivos"
            description="Cadastre uma prova-alvo ou meta de performance para acompanhar seu progresso."
            icon={<TrendingUpIcon width={28} height={28} />}
            action={{ label: "Criar primeira meta", onClick: () => setEditing(null) }}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />
            ))}
          </ul>
        )}
      </div>

      {editing !== undefined && (
        <GoalFormModal
          goal={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void reload();
          }}
        />
      )}
    </main>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const comments = goal.events.filter((e) => e.kind === "COMMENT");
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-petrol/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{goal.title}</p>
          <p className="text-xs text-muted">
            {TYPE_LABEL[goal.type] ?? goal.type}
            {goal.modality ? ` · ${MODALITY_LABEL[goal.modality] ?? goal.modality}` : ""}
            {goal.targetDate ? ` · alvo ${new Date(`${goal.targetDate}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
          </p>
        </div>
        <button type="button" className={uiClasses.buttonGhost} onClick={onEdit}>
          Editar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-line px-2 py-0.5 text-muted">
          {STATUS_LABEL[goal.status] ?? goal.status}
        </span>
        <span className="rounded-full border border-line px-2 py-0.5 text-muted">
          Prioridade {PRIORITY_LABEL[goal.priority] ?? goal.priority}
        </span>
        {goal.weeklyFrequency != null && (
          <span className="rounded-full border border-line px-2 py-0.5 text-muted">
            {goal.weeklyFrequency}x/semana
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-turq" style={{ width: `${goal.progress}%` }} />
        </div>
        <span className="tabular text-xs text-muted">{goal.progress}%</span>
      </div>

      {goal.targetEvent && <p className="text-xs text-muted">Evento: {goal.targetEvent}</p>}
      {goal.notes && <p className="text-sm text-ink/90">{goal.notes}</p>}

      {comments.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t border-line pt-2">
          <p className="text-[11px] font-medium text-muted">Comentários do treinador</p>
          {comments.map((c) => (
            <p key={c.id} className="text-xs text-ink/90">
              <span className="text-faint">
                {new Date(c.createdAt).toLocaleDateString("pt-BR")}:
              </span>{" "}
              {c.note}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

function GoalFormModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = goal != null;
  const [title, setTitle] = useState(goal?.title ?? "");
  const [type, setType] = useState(goal?.type ?? "RACE");
  const [modality, setModality] = useState(goal?.modality ?? "");
  const [targetEvent, setTargetEvent] = useState(goal?.targetEvent ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [weeklyFrequency, setWeeklyFrequency] = useState(
    goal?.weeklyFrequency != null ? String(goal.weeklyFrequency) : "",
  );
  const [priority, setPriority] = useState(goal?.priority ?? "MEDIUM");
  const [status, setStatus] = useState(goal?.status ?? "ACTIVE");
  const [progress, setProgress] = useState(goal?.progress ?? 0);
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setErr(null);
    const base = {
      title,
      type,
      modality: modality || undefined,
      targetEvent: targetEvent || undefined,
      targetDate: targetDate || undefined,
      weeklyFrequency: weeklyFrequency ? Number(weeklyFrequency) : undefined,
      priority,
      notes: notes || undefined,
    };
    try {
      if (isEdit) {
        await apiFetch(`/api/athlete/goals/${goal.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...base, status, progress, lockVersion: goal.lockVersion }),
        });
      } else {
        await apiFetch("/api/athlete/goals", { method: "POST", body: JSON.stringify(base) });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Erro ao salvar.");
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Editar meta" : "Nova meta"}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={uiClasses.buttonSecondary} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className={uiClasses.button} onClick={submit} disabled={saving || title.trim().length < 2}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {err && <p className={uiClasses.error}>{err}</p>}
        <label className="flex flex-col gap-1">
          <span className={uiClasses.label}>Objetivo principal</span>
          <input className={uiClasses.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={uiClasses.label}>Tipo</span>
            <select className={uiClasses.select} value={type} onChange={(e) => setType(e.target.value)}>
              {GOAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiClasses.label}>Modalidade</span>
            <select className={uiClasses.select} value={modality} onChange={(e) => setModality(e.target.value)}>
              <option value="">—</option>
              {GOAL_MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {MODALITY_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={uiClasses.label}>Evento-alvo (opcional)</span>
          <input className={uiClasses.input} value={targetEvent} onChange={(e) => setTargetEvent(e.target.value)} maxLength={160} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={uiClasses.label}>Data-alvo</span>
            <input type="date" className={uiClasses.input} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={uiClasses.label}>Freq. semanal</span>
            <input type="number" min={0} max={21} className={uiClasses.input} value={weeklyFrequency} onChange={(e) => setWeeklyFrequency(e.target.value)} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={uiClasses.label}>Prioridade</span>
            <select className={uiClasses.select} value={priority} onChange={(e) => setPriority(e.target.value)}>
              {GOAL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          {isEdit && (
            <label className="flex flex-col gap-1">
              <span className={uiClasses.label}>Status</span>
              <select className={uiClasses.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                {GOAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {isEdit && (
          <label className="flex flex-col gap-1">
            <span className={uiClasses.label}>Progresso: {progress}%</span>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className={uiClasses.label}>Observações</span>
          <textarea className={uiClasses.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={3} />
        </label>
      </div>
    </Modal>
  );
}
