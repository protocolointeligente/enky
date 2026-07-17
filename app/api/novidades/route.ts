import type { NextRequest } from "next/server";
import { CONTENT_FEEDS, parseFeed, type FeedItem } from "@/modules/content/feed";
import { requireAuthenticatedUser } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

// Hub de conteúdo para o cliente: agrega os blogs por modalidade (CONTENT_FEEDS)
// e devolve os posts como JSON. Só para usuários autenticados — é a "área do
// cliente", não a landing de venda. Cada feed é resiliente: se um cair, os
// outros continuam.

function timestamp(date: string | null): number {
  if (!date) return 0;
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

async function loadFeed(url: string, modality: string, source: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }, // cache 1h — não martelar os blogs a cada visita
      headers: { "user-agent": "ENKY/1.0 (+https://enky.com.br)" },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text())
      .slice(0, 8)
      .map((item) => ({ ...item, modality, source }));
  } catch {
    return [];
  }
}

export async function GET(_request: NextRequest) {
  try {
    await requireAuthenticatedUser();

    const groups = await Promise.all(
      CONTENT_FEEDS.map((f) => loadFeed(f.url, f.modality, f.label)),
    );
    const items = groups.flat().sort((a, b) => timestamp(b.date) - timestamp(a.date));

    return apiSuccess({ items });
  } catch (error) {
    return apiError(error);
  }
}
