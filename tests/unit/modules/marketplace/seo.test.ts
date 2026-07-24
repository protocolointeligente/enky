import { describe, expect, it } from "vitest";
import {
  buildProductSeo,
  buildSellerSeo,
  isProductIndexable,
  isSellerIndexable,
  type ProductSeoInput,
} from "@/modules/marketplace-catalog/seo";

const BASE = "https://enky.test";

function product(over: Partial<ProductSeoInput> = {}): ProductSeoInput {
  return {
    slug: "corrida-10k-iniciante",
    title: "Corrida 10K Iniciante",
    shortDescription: "Plano de 8 semanas para sua primeira prova de 10 km.",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    thumbnailUrl: "https://cdn.test/thumb.jpg",
    ...over,
  };
}

describe("indexabilidade (§37)", () => {
  it("produto só é indexável se PUBLISHED + PUBLIC", () => {
    expect(isProductIndexable({ status: "PUBLISHED", visibility: "PUBLIC" })).toBe(true);
    expect(isProductIndexable({ status: "PUBLISHED", visibility: "UNLISTED" })).toBe(false);
    expect(isProductIndexable({ status: "PUBLISHED", visibility: "PRIVATE" })).toBe(false);
    expect(isProductIndexable({ status: "DRAFT", visibility: "PUBLIC" })).toBe(false);
    expect(isProductIndexable({ status: "PENDING_REVIEW", visibility: "PUBLIC" })).toBe(false);
  });

  it("vendedor só é indexável se PUBLISHED", () => {
    expect(isSellerIndexable({ status: "PUBLISHED" })).toBe(true);
    expect(isSellerIndexable({ status: "VERIFIED" })).toBe(false);
    expect(isSellerIndexable({ status: "PENDING_REVIEW" })).toBe(false);
  });
});

describe("buildProductSeo", () => {
  it("gera canonical, og e index quando público", () => {
    const seo = buildProductSeo(product(), BASE);
    expect(seo.canonical).toBe(`${BASE}/marketplace/produtos/corrida-10k-iniciante`);
    expect(seo.robots).toBe("index,follow");
    expect(seo.openGraph.url).toBe(seo.canonical);
    expect(seo.openGraph.image).toBe("https://cdn.test/thumb.jpg");
    expect(seo.openGraph.type).toBe("product");
  });

  it("rascunho é noindex", () => {
    expect(buildProductSeo(product({ status: "DRAFT" }), BASE).robots).toBe("noindex,nofollow");
  });

  it("usa o título como descrição quando não há shortDescription", () => {
    const seo = buildProductSeo(product({ shortDescription: null }), BASE);
    expect(seo.description).toBe("Corrida 10K Iniciante");
  });

  it("trunca descrição longa em ~160 chars com reticências", () => {
    const long = "x".repeat(300);
    const seo = buildProductSeo(product({ shortDescription: long }), BASE);
    expect(seo.description.length).toBeLessThanOrEqual(160);
    expect(seo.description.endsWith("…")).toBe(true);
  });

  it("sem thumbnail, og.image fica indefinido", () => {
    const seo = buildProductSeo(product({ thumbnailUrl: null }), BASE);
    expect(seo.openGraph.image).toBeUndefined();
  });
});

describe("buildSellerSeo", () => {
  it("gera canonical de treinador e og profile", () => {
    const seo = buildSellerSeo(
      { slug: "ana-coach", displayName: "Ana Coach", headline: "Corrida e trail", status: "PUBLISHED" },
      BASE,
    );
    expect(seo.canonical).toBe(`${BASE}/marketplace/treinadores/ana-coach`);
    expect(seo.robots).toBe("index,follow");
    expect(seo.openGraph.type).toBe("profile");
    expect(seo.description).toBe("Corrida e trail");
  });
});
