"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useExerciseOptions } from "@/app/_lib/use-exercise-options";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import { blocksInputToState, type BlockInputLike, type Modality } from "@/components/blocks-editor";
import {
  buildTemplatePayload,
  TemplateForm,
  type TemplateFormValues,
} from "@/components/template-form";

interface TemplateDetailDto {
  id: string;
  title: string;
  description: string | null;
  modality: Modality;
  content: {
    blocks: BlockInputLike[];
    level?: string;
    objective?: string;
    estimatedDurationMinutes?: number;
    tags?: string[];
  };
}

function toFormValues(template: TemplateDetailDto): TemplateFormValues {
  return {
    title: template.title,
    description: template.description ?? "",
    modality: template.modality,
    level: template.content.level ?? "",
    objective: template.content.objective ?? "",
    estimatedDurationMinutes: template.content.estimatedDurationMinutes?.toString() ?? "",
    tags: (template.content.tags ?? []).join(", "),
    blocks: blocksInputToState(template.content.blocks),
  };
}

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const exerciseOptions = useExerciseOptions(checked);
  const [initialValues, setInitialValues] = useState<TemplateFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ template: TemplateDetailDto }>(`/api/trainer/templates/${id}`)
      .then((r) => setInitialValues(toFormValues(r.template)))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [checked, id]);

  async function handleSubmit(values: TemplateFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(buildTemplatePayload(values)),
      });
      router.push("/treinador/templates");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  if (!checked || (!initialValues && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  if (error && !initialValues) {
    return (
      <main className={uiClasses.page}>
        <p className={uiClasses.error}>{error}</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <h1 className={uiClasses.heading}>Editar template</h1>
        <TemplateForm
          initialValues={initialValues as TemplateFormValues}
          submitLabel="Salvar alterações"
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          exerciseOptions={exerciseOptions}
        />
      </div>
    </main>
  );
}
