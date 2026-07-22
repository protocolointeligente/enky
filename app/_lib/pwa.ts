// Helpers de PWA no cliente. Mantidos fora dos componentes: só glue de browser.
import { idbDeleteDatabase } from "@/app/_lib/idb";

/**
 * Limpa todo rastro local no logout (§33/§35/§52): caches do service worker +
 * IndexedDB (snapshots, execuções, fila offline). Best-effort — nunca deve
 * impedir o logout de prosseguir.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage("CLEAR_CACHE");
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    await idbDeleteDatabase();
  } catch {
    // silencioso: logout tem prioridade sobre limpeza de dados locais
  }
}
