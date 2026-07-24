import "server-only";
import webpush from "web-push";
import { env } from "@/lib/env";

// Fábrica do provedor Web Push (§14). Único ponto que decide o que fazer sem as
// chaves VAPID: retorna null → push desligado, app funciona normalmente. Mesmo
// racional dos periféricos (Strava/pagamento). Configura o web-push uma vez.
let cached: typeof webpush | null | undefined;

export function getPushProvider(): typeof webpush | null {
  if (cached !== undefined) return cached;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    cached = null;
    return null;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  cached = webpush;
  return webpush;
}
