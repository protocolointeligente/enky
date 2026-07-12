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
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const thumb = thumbnailFor(url);
  const box = size === "sm" ? "h-9 w-12" : "h-12 w-16";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0"
        title="Ver demonstração"
        aria-label={`Ver demonstração: ${name}`}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de GIF/thumb externa
          <img src={thumb} alt="" className={`${box} rounded object-cover`} />
        ) : (
          <span
            className={`${box} flex items-center justify-center rounded bg-surface text-electric-hi`}
          >
            ▶
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
