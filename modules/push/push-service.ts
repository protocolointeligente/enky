import "server-only";
import { prisma } from "@/infrastructure/database/prisma";
import type { NotificationCategory } from "@/modules/profile/profile-schema";
import { getPushProvider } from "./get-push-provider";
import { isCategoryEnabled } from "./push-category";

// Serviço de Web Push (§14). Envio é sensível à preferência por categoria
// (opt-in, consistente com a aba Notificações §12): só dispara se o usuário
// ligou aquela categoria — exceto `accountAlert`, sempre enviado. Subscriptions
// inválidas (404/410) são removidas no envio. Nunca lança para o chamador
// (push é best-effort; não pode derrubar o fluxo que o disparou).

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  category: NotificationCategory;
}

export async function saveSubscription(
  userId: string,
  sub: BrowserSubscription,
  userAgent?: string,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
  });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

async function categoryEnabled(userId: string, category: NotificationCategory): Promise<boolean> {
  if (category === "accountAlert") return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const prefs = (user?.preferences as { notifications?: Record<string, boolean> } | null)?.notifications;
  return isCategoryEnabled(category, prefs);
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const provider = getPushProvider();
  if (!provider) return; // push desligado (sem VAPID)
  if (!(await categoryEnabled(userId, payload.category))) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/" });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await provider.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}
