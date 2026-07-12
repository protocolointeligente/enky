"use client";

// Player agnóstico de host: o Exercise só guarda uma URL (Exercise.videoUrl).
// Detecta a origem e embeda do jeito certo — YouTube (unlisted), Google Drive
// ou arquivo MP4/webm direto (ex.: Cloudflare R2). Trocar de host = trocar a
// URL, sem tocar aqui.

type Parsed = { kind: "youtube" | "drive" | "file" | "image" | "link"; src: string };

export function parseVideoUrl(raw: string): Parsed {
  const url = raw.trim();

  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (yt) return { kind: "youtube", src: `https://www.youtube.com/embed/${yt[1]}?rel=0` };

  const gd = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]+)/);
  if (gd) return { kind: "drive", src: `https://drive.google.com/file/d/${gd[1]}/preview` };

  // GIF animado (ex.: ExerciseDB) — imagem, não vídeo.
  if (/\.gif(\?.*)?$/i.test(url)) return { kind: "image", src: url };

  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) return { kind: "file", src: url };

  return { kind: "link", src: url };
}

export function VideoPlayer({ url }: { url: string }) {
  const { kind, src } = parseVideoUrl(url);

  if (kind === "file") {
    return <video controls preload="metadata" src={src} className="w-full rounded-lg bg-black" />;
  }

  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- GIF externo (ExerciseDB), sem otimização do next/image
    return <img src={src} alt="Demonstração do exercício" className="w-full rounded-lg bg-black" />;
  }

  if (kind === "link") {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="text-electric transition-colors hover:text-electric-hi hover:underline"
      >
        Abrir vídeo →
      </a>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-black"
      style={{ aspectRatio: "16 / 9" }}
    >
      <iframe
        src={src}
        title="Vídeo do exercício"
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
