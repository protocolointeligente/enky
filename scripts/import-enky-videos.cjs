/* eslint-disable */
// Importa a biblioteca de vídeos própria da ENKY (Treinamento Funcional) como
// exercícios GLOBAIS, lendo o catálogo .xlsx que é a fonte de verdade humana.
// Manual e idempotente — NÃO é rota de runtime.
//
//   node scripts/import-enky-videos.cjs [--file <caminho.xlsx>] [--dry-run]
//
// Colunas usadas: D "Exercicio", H "Forma de execucao", I "Para que serve",
// J "Link YouTube", K "Status YouTube". Só entram linhas com K=uploaded e link.
//
// Lê o .xlsx direto (não um CSV derivado) de propósito: o catálogo continua
// sendo atualizado conforme os vídeos restantes sobem, então re-rodar o script
// pega os novos sem ninguém reexportar nada. Um .xlsx é um ZIP de XML — o
// leitor abaixo usa só zlib/stdlib, sem dependência nova.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { PrismaClient } = require("@prisma/client");
const { guardProduction, upsertGlobalExercise } = require("./import-common.cjs");

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const fileArg = args.indexOf("--file");
const XLSX_PATH =
  fileArg >= 0
    ? args[fileArg + 1]
    : path.join(
        __dirname,
        "..",
        "videos Treinamento Funcional",
        "catalogo_videos_treinamento_funcional_enky.xlsx",
      );

// --- leitor mínimo de .xlsx (ZIP + XML, stdlib) ----------------------------

// Lê o ZIP pelo End of Central Directory → central directory → entradas.
function readZipEntries(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("xlsx inválido: EOCD não encontrado.");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    // Cabeçalho local: os tamanhos de nome/extra podem diferir do central.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);
    entries.set(name, method === 0 ? raw : zlib.inflateRawSync(raw));
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");

// Extrai as células de cada <row>. Suporta inlineStr (como o catálogo grava) e
// sharedStrings, cobrindo os dois jeitos que geradores de xlsx costumam usar.
function parseSheet(xml, shared) {
  const rows = [];
  for (const [, rowXml] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const [, attrs, body] of rowXml.matchAll(/<c([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(attrs);
      if (!ref || body == null) continue;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      let value;
      if (type === "inlineStr") {
        value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("");
      } else {
        const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (v == null) continue;
        value = type === "s" ? (shared[Number(v)] ?? "") : v;
      }
      cells[ref[1]] = decode(value).trim();
    }
    rows.push(cells);
  }
  return rows;
}

function readCatalog(file) {
  const entries = readZipEntries(fs.readFileSync(file));
  const sharedXml = entries.get("xl/sharedStrings.xml");
  const shared = sharedXml
    ? [...sharedXml.toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, si]) =>
        decode([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")),
      )
    : [];
  const sheet = entries.get("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("xlsx sem xl/worksheets/sheet1.xml.");
  return parseSheet(sheet.toString("utf8"), shared);
}

// --- mapeamento ------------------------------------------------------------

const CATEGORY = "Funcional";
const VIDEO_SOURCE = "YouTube — canal ENKY (não listado)";
const VIDEO_LICENSE = "Material próprio ENKY";

// H e I são textos curtos de apoio; juntos viram a descrição do exercício.
function buildDescription(row) {
  const parts = [];
  if (row.H) parts.push(`Execução: ${row.H}`);
  if (row.I) parts.push(`Para que serve: ${row.I}`);
  return parts.join("\n\n") || undefined;
}

async function main() {
  guardProduction();

  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Catálogo não encontrado: ${XLSX_PATH}`);
  }

  const rows = readCatalog(XLSX_PATH);
  const header = rows[0] ?? {};
  if (header.D !== "Exercicio" || header.J !== "Link YouTube") {
    throw new Error(
      `Colunas inesperadas no catálogo (D=${header.D}, J=${header.J}). Confira o arquivo.`,
    );
  }

  const data = rows.slice(1).filter((r) => r.D);
  const published = data.filter((r) => r.K === "uploaded" && r.J);

  // Vários vídeos (ângulos/tomadas) para o mesmo exercício: Exercise tem um só
  // videoUrl e nome único, então colapsa por nome ficando com a primeira linha
  // publicada (menor ID = a tomada principal do catálogo).
  const byName = new Map();
  for (const row of published) {
    const name = row.D.replace(/\s+/g, " ").trim();
    if (!byName.has(name)) byName.set(name, row);
  }

  console.log(`Catálogo: ${XLSX_PATH}`);
  console.log(
    `  ${data.length} linhas · ${published.length} publicadas · ${byName.size} exercícios distintos` +
      ` (${published.length - byName.size} vídeos extras colapsados)`,
  );
  const pending = data.length - published.length;
  if (pending > 0) console.log(`  ${pending} ainda sem vídeo publicado — reimporte depois de subir.`);

  if (DRY_RUN) {
    for (const [name, row] of [...byName].slice(0, 10)) console.log(`  [dry] ${name} → ${row.J}`);
    console.log(`  [dry] nada gravado (${byName.size} seriam importados).`);
    return;
  }

  let created = 0;
  let updated = 0;
  for (const [name, row] of byName) {
    const result = await upsertGlobalExercise(prisma, {
      name,
      category: CATEGORY,
      targetMuscles: [],
      videoUrl: row.J,
      modality: "FUNCTIONAL",
      description: buildDescription(row),
      videoSource: VIDEO_SOURCE,
      videoLicense: VIDEO_LICENSE,
    });
    if (result === "created") created += 1;
    else updated += 1;
  }
  console.log(`Importados: ${created} criados, ${updated} atualizados.`);
}

main()
  .catch((error) => {
    console.error("FALHOU:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
