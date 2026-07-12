/* eslint-disable */
// Importa exercícios do ExerciseDB (via RapidAPI) como exercícios GLOBAIS.
// Manual e idempotente — NÃO é rota de runtime.
//
//   node scripts/import-exercisedb.cjs [--limit N] [--dry-run]
//
// Lê EXERCISEDB_RAPIDAPI_KEY do .env. ExerciseDB entrega GIFs (gifUrl) — o
// VideoPlayer renderiza GIF como imagem. O endpoint /exercises devolve um
// array direto (sem envelope). Tier free do RapidAPI é rate-limited: rode com
// --dry-run primeiro e ajuste --limit.

try {
  process.loadEnvFile(".env");
} catch {
  /* .env opcional se as variáveis já estiverem no ambiente */
}

const { PrismaClient } = require("@prisma/client");
const {
  guardProduction,
  sleep,
  asString,
  asStringArray,
  upsertGlobalExercise,
} = require("./import-common.cjs");
const prisma = new PrismaClient();

const HOST = "exercisedb.p.rapidapi.com";
const KEY = process.env.EXERCISEDB_RAPIDAPI_KEY;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : 50;

async function api(path) {
  const res = await fetch(`https://${HOST}${path}`, {
    headers: { "X-RapidAPI-Key": KEY, "X-RapidAPI-Host": HOST },
  });
  if (!res.ok) {
    throw new Error(`ExerciseDB ${path} → HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

// Um exercício ExerciseDB: { name, bodyPart, target, equipment, gifUrl,
// secondaryMuscles[], instructions[] }.
function mapExercise(e) {
  const name = asString(e.name);
  const category = asString(e.bodyPart) || asString(e.equipment) || "Geral";
  const targetMuscles = [asString(e.target), ...asStringArray(e.secondaryMuscles)].filter(Boolean);
  const videoUrl = asString(e.gifUrl);
  return { name, category, targetMuscles, videoUrl };
}

async function main() {
  guardProduction();
  if (!KEY) throw new Error("EXERCISEDB_RAPIDAPI_KEY ausente no .env.");

  console.log(`ExerciseDB import — limite ${LIMIT}${DRY_RUN ? " (DRY RUN)" : ""}`);

  const list = await api(`/exercises?limit=${LIMIT}&offset=0`);
  const items = (Array.isArray(list) ? list : list.results || []).slice(0, LIMIT);
  console.log(`Recebidos ${items.length} exercícios.`);

  let created = 0,
    updated = 0,
    skipped = 0;

  for (const [i, raw] of items.entries()) {
    try {
      const ex = mapExercise(raw);
      if (!ex.name) {
        skipped++;
        continue;
      }
      if (DRY_RUN) {
        console.log(`  [${i + 1}] ${ex.name} · ${ex.category} · ${ex.targetMuscles.join(", ")} · ${ex.videoUrl ? "gif✓" : "sem gif"}`);
      } else {
        const r = await upsertGlobalExercise(prisma, ex);
        r === "created" ? created++ : updated++;
        console.log(`  [${i + 1}] ${r}: ${ex.name}`);
        await sleep(100);
      }
    } catch (err) {
      skipped++;
      console.warn(`  [${i + 1}] pulado: ${err.message}`);
    }
  }

  console.log(
    DRY_RUN
      ? `\nDRY RUN concluído: ${items.length} mapeados, ${skipped} pulados.`
      : `\nConcluído: ${created} criados, ${updated} atualizados, ${skipped} pulados.`,
  );
}

main()
  .catch((e) => {
    console.error("ERRO:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
