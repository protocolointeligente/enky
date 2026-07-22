// Artigos institucionais estáticos da vitrine pública /novidades/[slug].
// Sem CMS, sem banco: editar aqui é publicar. São a "apresentação do ENKY"
// que o briefing pede na página pública. Se um dia virar conteúdo editorial
// de verdade (muitos autores, agendamento), aí sim troca por um store real.
// ponytail: lista estática — vira tabela quando houver quem escreva além do time.

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  updatedAt: string; // YYYY-MM-DD
  // Corpo em parágrafos simples — sem markdown/HTML para não abrir superfície de XSS.
  body: string[];
}

export const ARTICLES: Article[] = [
  {
    slug: "o-que-e-enky",
    title: "O que é a ENKY",
    excerpt:
      "Prescrição, calendário e leitura de carga do atleta num só lugar — dados viram contexto claro para decidir o próximo treino.",
    updatedAt: "2026-07-18",
    body: [
      "A ENKY é uma plataforma de performance humana para treinadores e atletas. Ela reúne a prescrição de treinos, o calendário e a leitura de carga (CTL, ATL, TSB, ACWR) em um único ambiente.",
      "O treinador comanda a operação: cadastra atletas, prescreve no calendário e acompanha quem precisa de atenção antes de virar problema. O atleta treina com clareza pelo celular e devolve o feedback na hora.",
      "A inteligência da ENKY explica — nunca diagnostica. A palavra final é sempre do treinador.",
    ],
  },
  {
    slug: "como-a-enky-le-a-carga",
    title: "Como a ENKY lê a carga de treino",
    excerpt:
      "CTL, ATL, TSB, ACWR, monotonia e prontidão traduzidos em linguagem de contexto para apoiar a decisão do treinador.",
    updatedAt: "2026-07-18",
    body: [
      "A carga de treino é medida a partir do que o atleta de fato executou e do feedback que ele registra (sRPE). A partir daí a ENKY calcula métricas de longo e curto prazo — CTL e ATL — e o equilíbrio entre elas (TSB).",
      "O ACWR (razão entre carga aguda e crônica) sinaliza quando a progressão está saindo da faixa segura. Monotonia e strain complementam a leitura de risco.",
      "Nenhuma dessas métricas substitui o treinador. Elas organizam a evidência para que a conversa deixe de ser achismo.",
    ],
  },
];

export function findArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
