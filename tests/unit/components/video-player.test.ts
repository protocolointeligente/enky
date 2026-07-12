import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "@/components/video-player";

// O player é agnóstico de host: parseVideoUrl decide como embedar a URL guardada
// em Exercise.videoUrl. Cobre as origens que o treinador vai colar.

describe("parseVideoUrl", () => {
  it("reconhece YouTube em todas as formas e normaliza para /embed", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://youtube.com/watch?v=${id}&t=30s`,
    ]) {
      const r = parseVideoUrl(url);
      expect(r.kind).toBe("youtube");
      expect(r.src).toBe(`https://www.youtube.com/embed/${id}?rel=0`);
    }
  });

  it("reconhece Google Drive e normaliza para /preview", () => {
    const id = "1AbC_dEfGhIjKlMnOpQ";
    for (const url of [
      `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      `https://drive.google.com/open?id=${id}`,
      `https://drive.google.com/uc?id=${id}`,
    ]) {
      const r = parseVideoUrl(url);
      expect(r.kind).toBe("drive");
      expect(r.src).toBe(`https://drive.google.com/file/d/${id}/preview`);
    }
  });

  it("reconhece arquivo direto (mp4/webm) para player nativo", () => {
    expect(parseVideoUrl("https://cdn.exemplo.com/agachamento.mp4").kind).toBe("file");
    expect(parseVideoUrl("https://r2.exemplo.com/v.webm?token=x").kind).toBe("file");
  });

  it("reconhece GIF (ex.: ExerciseDB) como imagem", () => {
    expect(parseVideoUrl("https://v2.exercisedb.io/image/abc.gif").kind).toBe("image");
    expect(parseVideoUrl("https://cdn.exemplo.com/curl.gif?v=2").kind).toBe("image");
  });

  it("cai para link quando não reconhece a origem", () => {
    const r = parseVideoUrl("https://algum-site.com/pagina");
    expect(r.kind).toBe("link");
    expect(r.src).toBe("https://algum-site.com/pagina");
  });
});
