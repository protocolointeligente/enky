import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, findArticle } from "@/modules/content/articles";
import { uiClasses } from "@/app/_lib/ui";

// Artigo institucional PÚBLICO. Conteúdo estático (modules/content/articles),
// sem banco. Slug desconhecido → 404. Pré-renderizado por generateStaticParams.

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) return { title: "Artigo não encontrado — ENKY" };
  return { title: `${article.title} — ENKY`, description: article.excerpt };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = findArticle(slug);
  if (!article) notFound();

  const updated = new Date(article.updatedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-14 sm:px-6">
      <Link href="/novidades" className="text-sm font-medium text-electric-hi hover:underline">
        ← Novidades
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {article.title}
        </h1>
        <p className={uiClasses.hint}>Atualizado em {updated}</p>
      </header>
      <article className="flex flex-col gap-4 text-lg leading-relaxed text-muted">
        {article.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-6">
        <Link
          href="/registrar"
          className="rounded-lg bg-orange px-5 py-2.5 font-semibold text-onbrand transition-colors hover:bg-orange-hi"
        >
          Criar conta grátis
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-line-strong px-5 py-2.5 font-semibold text-ink transition-colors hover:border-electric hover:text-electric-hi"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
