"use client";

import { useState } from "react";
import { VideoPlayer, thumbnailFor } from "./video-player";

// Miniatura clicável da demonstração de um exercício — abre o player num modal.
// Usada na biblioteca (treinador) e no treino (atleta): o atleta precisa ver
// como se faz o movimento. Client, então funciona dentro de página server ou
// client.
export function ExerciseDemo({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string;
  // "card": miniatura 16:9 de largura total, para a grade da biblioteca.
  size?: "sm" | "md" | "card";
}) {
  const [open, setOpen] = useState(false);
  const thumb = thumbnailFor(url);
  const box = size === "sm" ? "h-9 w-12" : size === "card" ? "aspect-video w-full" : "h-12 w-16";
  const rounded = size === "card" ? "rounded-lg" : "rounded";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative shrink-0 ${size === "card" ? "w-full" : ""}`}
        title="Ver demonstração"
        aria-label={`Ver demonstração: ${name}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de GIF/thumb externa
          <img src={thumb} alt="" className={`${box} ${rounded} bg-surface object-cover`} />
        ) : (
          <span
            className={`${box} ${rounded} flex items-center justify-center bg-surface text-electric-hi`}
          >
            <PlayIcon />
          </span>
        )}
        {/* Affordance de play sobre a miniatura do cartão. */}
        {size === "card" && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 flex items-center justify-center ${rounded} bg-deep/30 opacity-0 transition-opacity group-hover:opacity-100`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange text-onbrand">
              <PlayIcon />
            </span>
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-petrol p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">{name}</h2>
              <button
                type="button"
                className="text-sm text-muted hover:text-ink"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>
            <VideoPlayer url={url} />
          </div>
        </div>
      )}
    </>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.14-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}
