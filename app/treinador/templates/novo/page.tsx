"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useExerciseOptions } from "@/app/_lib/use-exercise-options";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import {
  buildTemplatePayload,
  emptyTemplateForm,
  TemplateForm,
  type TemplateFormValues,
} from "@/components/template-form";

export default function NewTemplatePage() {
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const exerciseOptions = useExerciseOptions(checked);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: TemplateFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<{ templateId: string }>("/api/trainer/templates", {
        method: "POST",
        body: JSON.stringify(buildTemplatePayload(values)),
      });
      router.push("/treinador/templates");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  if (!checked) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <h1 className={uiClasses.heading}>Novo template</h1>
        <TemplateForm
          initialValues={emptyTemplateForm()}
          submitLabel="Criar template"
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          exerciseOptions={exerciseOptions}
        />
      </div>
    </main>
  );
}
