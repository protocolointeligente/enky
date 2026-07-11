"use client";

import { useState } from "react";
import { uiClasses } from "@/app/_lib/ui";

const COMPLETION_STATUSES = ["COMPLETED", "PARTIAL", "MISSED"] as const;

export interface FeedbackFormValues {
  completionStatus: (typeof COMPLETION_STATUSES)[number];
  actualDurationMinutes: string;
  actualDistanceKm: string;
  sessionRpe: string;
  fatigueLevel: string;
  recoveryLevel: string;
  painLevel: string;
  painLaterality: string;
  painRegion: string;
  notes: string;
}

export function emptyFeedbackForm(): FeedbackFormValues {
  return {
    completionStatus: "COMPLETED",
    actualDurationMinutes: "",
    actualDistanceKm: "",
    sessionRpe: "",
    fatigueLevel: "",
    recoveryLevel: "",
    painLevel: "0",
    painLaterality: "",
    painRegion: "",
    notes: "",
  };
}

function toIntOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toFloatOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// Reused for both the first submission (POST) and the single allowed
// correction (PATCH) — same fields, same validation, same component.
export function buildFeedbackPayload(values: FeedbackFormValues) {
  return {
    completionStatus: values.completionStatus,
    actualDurationMinutes: toIntOrUndefined(values.actualDurationMinutes),
    actualDistanceKm: toFloatOrUndefined(values.actualDistanceKm),
    sessionRpe: toFloatOrUndefined(values.sessionRpe),
    fatigueLevel: toIntOrUndefined(values.fatigueLevel),
    recoveryLevel: toIntOrUndefined(values.recoveryLevel),
    painLevel: toIntOrUndefined(values.painLevel) ?? 0,
    painLaterality: values.painLaterality.trim() === "" ? undefined : values.painLaterality,
    painRegion: values.painRegion.trim() === "" ? undefined : values.painRegion,
    notes: values.notes.trim() === "" ? undefined : values.notes,
  };
}

interface WorkoutFeedbackFormProps {
  initialValues: FeedbackFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: FeedbackFormValues) => void;
}

export function WorkoutFeedbackForm({
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: WorkoutFeedbackFormProps) {
  const [values, setValues] = useState<FeedbackFormValues>(initialValues);
  const isMissed = values.completionStatus === "MISSED";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className={`${uiClasses.card} flex flex-col gap-4`}
    >
      {error && <p className={uiClasses.error}>{error}</p>}

      <div>
        <label className={uiClasses.label} htmlFor="completionStatus">
          Como foi o treino?
        </label>
        <select
          id="completionStatus"
          className={uiClasses.select}
          value={values.completionStatus}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              completionStatus: event.target.value as FeedbackFormValues["completionStatus"],
            }))
          }
        >
          {COMPLETION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {!isMissed && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={uiClasses.label} htmlFor="actualDurationMinutes">
              Duração real (min)
            </label>
            <input
              id="actualDurationMinutes"
              type="number"
              className={uiClasses.input}
              value={values.actualDurationMinutes}
              onChange={(event) =>
                setValues((current) => ({ ...current, actualDurationMinutes: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="actualDistanceKm">
              Distância real (km)
            </label>
            <input
              id="actualDistanceKm"
              type="number"
              step="0.01"
              className={uiClasses.input}
              value={values.actualDistanceKm}
              onChange={(event) =>
                setValues((current) => ({ ...current, actualDistanceKm: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="sessionRpe">
              RPE da sessão (1-10)
            </label>
            <input
              id="sessionRpe"
              type="number"
              min={1}
              max={10}
              className={uiClasses.input}
              value={values.sessionRpe}
              onChange={(event) =>
                setValues((current) => ({ ...current, sessionRpe: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="fatigueLevel">
              Fadiga (0-10)
            </label>
            <input
              id="fatigueLevel"
              type="number"
              min={0}
              max={10}
              className={uiClasses.input}
              value={values.fatigueLevel}
              onChange={(event) =>
                setValues((current) => ({ ...current, fatigueLevel: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="recoveryLevel">
              Recuperação (0-10)
            </label>
            <input
              id="recoveryLevel"
              type="number"
              min={0}
              max={10}
              className={uiClasses.input}
              value={values.recoveryLevel}
              onChange={(event) =>
                setValues((current) => ({ ...current, recoveryLevel: event.target.value }))
              }
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={uiClasses.label} htmlFor="painLevel">
            Dor (0-10)
          </label>
          <input
            id="painLevel"
            type="number"
            min={0}
            max={10}
            className={uiClasses.input}
            value={values.painLevel}
            onChange={(event) =>
              setValues((current) => ({ ...current, painLevel: event.target.value }))
            }
          />
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="painRegion">
            Região da dor
          </label>
          <input
            id="painRegion"
            className={uiClasses.input}
            value={values.painRegion}
            onChange={(event) =>
              setValues((current) => ({ ...current, painRegion: event.target.value }))
            }
          />
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="painLaterality">
            Lateralidade
          </label>
          <input
            id="painLaterality"
            className={uiClasses.input}
            value={values.painLaterality}
            onChange={(event) =>
              setValues((current) => ({ ...current, painLaterality: event.target.value }))
            }
          />
        </div>
      </div>

      <div>
        <label className={uiClasses.label} htmlFor="notes">
          Notas (opcional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className={uiClasses.input}
          value={values.notes}
          onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
        />
      </div>

      <button type="submit" className={uiClasses.button} disabled={submitting}>
        {submitting ? "Enviando..." : submitLabel}
      </button>
    </form>
  );
}
