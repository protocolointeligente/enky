import { describe, expect, it } from "vitest";
import { parseFeed } from "@/modules/content/feed";

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Blog ENKY</title>
  <item>
    <title><![CDATA[Como ler ACWR]]></title>
    <link>https://blog.enky.com.br/acwr</link>
    <pubDate>Wed, 16 Jul 2026 10:00:00 GMT</pubDate>
    <description><![CDATA[<img src="https://img/a.jpg"/><p>Guia r&#225;pido de carga &amp; recupera&#231;&#227;o.</p>]]></description>
  </item>
  <item>
    <title>Sem link deve sumir</title>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Periodização na prática</title>
    <link href="https://blog.enky.com.br/periodizacao" rel="alternate"/>
    <published>2026-07-15T12:00:00Z</published>
    <summary>Montando um macrociclo real.</summary>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("lê itens RSS: decodifica CDATA/entidades, extrai imagem e descarta item sem link", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Como ler ACWR",
      link: "https://blog.enky.com.br/acwr",
      image: "https://img/a.jpg",
    });
    expect(items[0]?.excerpt).toContain("rápido"); // &#225; decodificado + HTML removido
    expect(items[0]?.excerpt).toContain("carga & recuperação");
    expect(items[0]?.excerpt).not.toContain("<");
  });

  it("lê entries Atom usando href do link e summary", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0]?.link).toBe("https://blog.enky.com.br/periodizacao");
    expect(items[0]?.excerpt).toBe("Montando um macrociclo real.");
  });
});
