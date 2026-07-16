// Utilitários compartilhados pelos importadores de exercícios (MuscleWiki,
// ExerciseDB, ...). Concentra a parte não-trivial: o upsert de exercício GLOBAL
// (organizationId null), que precisa deduplicar à mão porque
// @@unique([name, organizationId]) não vale para organizationId NULL no Postgres.

function guardProduction() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Importação BLOQUEADA: não rode contra produção a partir de um script local.");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Campos aninhados de APIs externas podem vir como string OU objeto.
function asString(v) {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object") return v.name || v.title || null;
  return v != null ? String(v) : null;
}
function asStringArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map(asString).filter(Boolean);
}

// Upsert global idempotente por nome. `ex` = { name, category, targetMuscles[],
// videoUrl } e, opcionalmente, os metadados da Fase 5 (modality, equipment,
// level, description, videoSource, videoLicense). Só os campos presentes em
// `ex` são gravados — um importador que não conhece um metadado nunca apaga o
// que outro preencheu.
const OPTIONAL_FIELDS = [
  "modality",
  "equipment",
  "level",
  "description",
  "videoSource",
  "videoLicense",
];

function optionalData(ex) {
  const data = {};
  for (const field of OPTIONAL_FIELDS) {
    if (ex[field] !== undefined) data[field] = ex[field];
  }
  return data;
}

async function upsertGlobalExercise(prisma, ex) {
  const existing = await prisma.exercise.findFirst({
    where: { name: ex.name, organizationId: null },
  });
  if (existing) {
    await prisma.exercise.update({
      where: { id: existing.id },
      data: {
        category: ex.category,
        targetMuscles: ex.targetMuscles,
        videoUrl: ex.videoUrl,
        ...optionalData(ex),
      },
    });
    return "updated";
  }
  await prisma.exercise.create({
    data: {
      organizationId: null,
      name: ex.name,
      category: ex.category,
      targetMuscles: ex.targetMuscles,
      videoUrl: ex.videoUrl,
      isActive: true,
      ...optionalData(ex),
    },
  });
  return "created";
}

module.exports = { guardProduction, sleep, asString, asStringArray, upsertGlobalExercise };
