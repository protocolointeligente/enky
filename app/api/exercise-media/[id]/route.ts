import type { NextRequest } from "next/server";

// Proxy da mídia do ExerciseDB. O GIF do RapidAPI exige a X-RapidAPI-Key no
// header, então o navegador não consegue embedar direto (<img> daria 401).
// Esta rota busca com a key no servidor e devolve o GIF, com cache forte para
// não gastar cota a cada visualização.
//
// ponytail: 1 chamada à API por GIF único na primeira vez (depois cache do
// browser/edge). Aberta (demos de exercício não são sensíveis). Se a cota do
// tier free apertar, baixar os GIFs no import e servir de public/ ou R2 remove
// a dependência de runtime — mas aí são binários no repo/host.

export const dynamic = "force-dynamic";

const HOST = "exercisedb.p.rapidapi.com";
const RESOLUTION = "360";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const key = process.env.EXERCISEDB_RAPIDAPI_KEY;
  if (!key) return new Response("Mídia indisponível.", { status: 503 });

  const { id: raw } = await params;
  const id = raw.replace(/\.gif$/i, "");
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return new Response("id inválido.", { status: 400 });

  const upstream = await fetch(
    `https://${HOST}/image?resolution=${RESOLUTION}&exerciseId=${encodeURIComponent(id)}`,
    { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST } },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response("Mídia não encontrada.", { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/gif",
      // GIFs de exercício não mudam — cache longo e imutável.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
