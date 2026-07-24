import type { NotificationCategory } from "@/modules/profile/profile-schema";

// Regra pura de gating de push (§14), sem dependência de DB/env para ser testável
// e reutilizável. Opt-in: só envia se a categoria foi explicitamente ligada —
// exceto accountAlert, sempre enviado. Consistente com a aba Notificações §12.
export function isCategoryEnabled(
  category: NotificationCategory,
  notifications: Record<string, boolean> | null | undefined,
): boolean {
  if (category === "accountAlert") return true;
  return notifications?.[category] === true;
}
