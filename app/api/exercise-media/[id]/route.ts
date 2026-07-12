import type { NextRequest } from "next/server";

// Mídia de exercício. Os GIFs do ExerciseDB foram baixados no build para
// public/exercise-gifs/{id}.gif (ver histórico) — servidos estaticamente pela
// CDN, sem depender da X-RapidAPI-Key nem gastar cota em runtime. Esta rota só
// existe para manter compatível a URL já gravada em Exercise.videoUrl
// (/api/exercise-media/{id}.gif): redireciona para o arquivo estático, então
// nada precisa mudar no banco (vale para preview e produção).
//
// ponytail: redirect estável, GIFs imutáveis. Se um dia importar exercícios
// novos, baixe o GIF para public/exercise-gifs/ no mesmo passo do import.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = raw.replace(/\.gif$/i, "");
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return new Response("id inválido.", { status: 400 });
  return Response.redirect(new URL(`/exercise-gifs/${id}.gif`, request.url), 307);
}
