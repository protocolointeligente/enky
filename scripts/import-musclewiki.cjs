/* eslint-disable */
// Importa exercícios da MuscleWiki API como exercícios GLOBAIS (organizationId
// null), reaproveitados por todas as organizações. Manual e idempotente —
// NÃO é rota de runtime (não expõe a key, não gasta chamadas em produção).
//
//   node scripts/import-musclewiki.cjs [--limit N] [--dry-run]
//
// Lê MUSCLEWIKI_API_KEY do .env. O tier direto da API é pago (~US$10/mês).
// A lista devolve id+name; os detalhes (músculos, categoria, vídeo) exigem
// uma chamada por exercício — por isso o --limit, para não estourar a cota.
//
// Idempotente: reexecutar converge (upsert por nome, escopo global). Mapeamento
// defensivo — a API pode devolver strings ou objetos nos campos aninhados.

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

const API = "https://api.musclewiki.com";
const KEY = process.env.MUSCLEWIKI_API_KEY;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : 50;

async function api(path) {
  const res = await fetch(`${API}${path}`, { headers: { "X-API-Key": KEY } });
  if (!res.ok) {
    throw new Error(`MuscleWiki ${path} → HTTP ${res.status} ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

function firstVideoUrl(videos) {
  if (!Array.isArray(videos)) return null;
  for (const item of videos) {
    if (typeof item === "string" && /^https?:\/\//.test(item)) return item;
    if (item && typeof item === "object") {
      const u = item.url || item.video || item.src || item.file || item.branded_video;
      if (typeof u === "string" && /^https?:\/\//.test(u)) return u;
    }
  }
  return null;
}

function mapExercise(detail) {
  const name = asString(detail.name);
  const muscles = asStringArray(detail.primary_muscles);
  const category = asString(detail.category) || muscles[0] || "Geral";
  const videoUrl = firstVideoUrl(detail.videos);
  return { name, category, targetMuscles: muscles, videoUrl };
}

async function main() {
  guardProduction();
  if (!KEY) throw new Error("MUSCLEWIKI_API_KEY ausente no .env.");

  console.log(`MuscleWiki import — limite ${LIMIT}${DRY_RUN ? " (DRY RUN)" : ""}`);

  const list = await api(`/exercises?limit=${Math.min(LIMIT, 100)}&offset=0`);
  const items = (list.results || []).slice(0, LIMIT);
  console.log(`Lista: ${list.total ?? "?"} no total, processando ${items.length}.`);

  let created = 0,
    updated = 0,
    skipped = 0;

  for (const [i, row] of items.entries()) {
    try {
      const detail = await api(`/exercises/${row.id}`);
      const ex = mapExercise(detail);
      if (!ex.name) {
        skipped++;
        continue;
      }
      if (DRY_RUN) {
        console.log(`  [${i + 1}] ${ex.name} · ${ex.category} · ${ex.targetMuscles.join(", ")} · ${ex.videoUrl ? "vídeo✓" : "sem vídeo"}`);
      } else {
        const r = await upsertGlobalExercise(prisma, ex);
        r === "created" ? created++ : updated++;
        console.log(`  [${i + 1}] ${r}: ${ex.name}`);
      }
      await sleep(250); // educado com o rate limit
    } catch (err) {
      skipped++;
      console.warn(`  [${i + 1}] pulado (${row.name ?? row.id}): ${err.message}`);
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
