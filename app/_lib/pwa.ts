// Helpers de PWA no cliente. Mantidos fora dos componentes: só glue de browser.

/**
 * Limpa todo rastro local no logout (§33/§52): manda o service worker apagar os
 * caches e apaga direto também, caso o SW não esteja controlando a página ainda.
 * Best-effort — nunca deve impedir o logout de prosseguir.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage("CLEAR_CACHE");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // silencioso: logout tem prioridade sobre limpeza de cache
  }
}
