"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";

// Ativação CONTEXTUAL de push (§14): só age quando o usuário clica — nunca pede
// permissão no carregamento. Faz fallback claro quando o navegador não suporta
// ou quando a chave VAPID não está configurada.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "unconfigured" | "off" | "on" | "denied";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return setState("unsupported");
    if (!VAPID_PUBLIC) return setState("unconfigured");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    setErr(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await apiFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(json) });
      setState("on");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Não foi possível ativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Erro ao desativar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-petrol/70 p-4">
      <p className="font-medium text-ink">Notificações neste dispositivo</p>
      {state === "loading" && <p className="text-xs text-muted">Verificando...</p>}
      {state === "unsupported" && (
        <p className="text-xs text-muted">Seu navegador não suporta notificações push.</p>
      )}
      {state === "unconfigured" && (
        <p className="text-xs text-muted">Push ainda não configurado neste ambiente.</p>
      )}
      {state === "denied" && (
        <p className="text-xs text-muted">
          Permissão bloqueada. Habilite as notificações do site nas configurações do navegador.
        </p>
      )}
      {state === "off" && (
        <>
          <p className="mb-3 text-xs text-muted">Receba avisos de treinos, mensagens e lembretes.</p>
          <button type="button" className={uiClasses.buttonSecondary} disabled={busy} onClick={enable}>
            Ativar notificações
          </button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="mb-3 text-xs text-turq">Ativado neste dispositivo.</p>
          <button type="button" className={uiClasses.buttonGhost} disabled={busy} onClick={disable}>
            Desativar
          </button>
        </>
      )}
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
