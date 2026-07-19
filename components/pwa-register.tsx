"use client";

import { useEffect } from "react";
import { toast } from "@/app/_lib/toast";

// Registra o service worker e avisa quando há nova versão (§32). Não força
// reload: o atleta pode estar no meio de um treino — a atualização é aplicada
// naturalmente quando o app é reaberto. Só roda em produção para não brigar com
// o hot-reload do dev.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let notified = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // Novo worker instalado E já havia um controlando = é atualização.
            if (installing.state === "installed" && navigator.serviceWorker.controller && !notified) {
              notified = true;
              toast.info("Nova versão disponível — será aplicada ao reabrir o app.");
            }
          });
        });
      })
      .catch(() => {
        // registro falhou (browser sem suporte, etc.) — app segue funcionando online
      });
  }, []);

  return null;
}
