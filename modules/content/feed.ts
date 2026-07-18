// Parser de feed de conteúdo (RSS 2.0 / Atom) para a área do cliente.
//
// ponytail: parser naïve por regex — cobre os campos que a página exibe
// (title/link/data/resumo/imagem) em RSS e Atom comuns. Troque por
// `rss-parser` se surgir um feed que ele não dê conta.

export interface FeedItem {
  title: string;
  link: string;
  date: string | null;
  excerpt: string;
  image: string | null;
  modality?: string;
  source?: string;
}

// Feeds curados por modalidade para a área do cliente. Editar aqui é a forma de
// trocar as fontes — sem env, sem CMS. `modality` casa com MODALITY_META.
export interface ContentFeed {
  modality: string;
  label: string;
  url: string;
}

export const CONTENT_FEEDS: ContentFeed[] = [
  { modality: "RUNNING", label: "Webrun", url: "https://webrun.com.br/feed" },
  { modality: "CYCLING", label: "Giro do Ciclismo", url: "https://girodociclismo.com.br/feed" },
  { modality: "SWIMMING", label: "Best Swimming", url: "https://bestswimming.swimchannel.net/feed" },
  { modality: "TRIATHLON", label: "220 Triathlon", url: "https://www.220triathlon.com/feed" },
];

function decode(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // por último: evita reprocessar entidades já decodificadas
}

function tagText(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? (m[1] ?? "").trim() : null;
}

function stripHtml(input: string): string {
  return decode(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

// Agrega todos os feeds curados, mais recente primeiro. Cada feed é resiliente:
// se um cair, os outros continuam. Usado pela página pública /novidades (Server
// Component) — sem auth, é conteúdo de vitrine.
export async function loadContentFeeds(): Promise<FeedItem[]> {
  const groups = await Promise.all(
    CONTENT_FEEDS.map((f) => loadFeed(f.url, f.modality, f.label)),
  );
  return groups.flat().sort((a, b) => timestamp(b.date) - timestamp(a.date));
}

export function parseFeed(xml: string): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi) ?? [];
  return blocks
    .slice(0, 24)
    .map((b): FeedItem => {
      const link = isAtom
        ? (b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "")
        : (tagText(b, "link") ?? "");
      const rawDesc =
        tagText(b, "description") ?? tagText(b, "summary") ?? tagText(b, "content") ?? "";
      const image =
        b.match(/<(?:enclosure|media:content|media:thumbnail)[^>]*url="([^"]+)"/i)?.[1] ??
        decode(rawDesc).match(/<img[^>]*src="([^"]+)"/i)?.[1] ??
        null;
      return {
        title: decode(tagText(b, "title") ?? ""),
        link: decode(link),
        date: tagText(b, "pubDate") ?? tagText(b, "published") ?? tagText(b, "updated") ?? null,
        excerpt: stripHtml(rawDesc).slice(0, 200),
        image,
      };
    })
    .filter((i) => i.title && i.link);
}
