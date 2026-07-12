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

// Upsert global idempotente por nome. `ex` = { name, category, targetMuscles[], videoUrl }.
async function upsertGlobalExercise(prisma, ex) {
  const existing = await prisma.exercise.findFirst({
    where: { name: ex.name, organizationId: null },
  });
  if (existing) {
    await prisma.exercise.update({
      where: { id: existing.id },
      data: { category: ex.category, targetMuscles: ex.targetMuscles, videoUrl: ex.videoUrl },
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
    },
  });
  return "created";
}

module.exports = { guardProduction, sleep, asString, asStringArray, upsertGlobalExercise };
