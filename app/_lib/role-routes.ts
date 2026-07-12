import type { SessionUser } from "./use-session";

// Single source of truth for where an authenticated user lands by role.
// Every role now has a panel (admin básico landed the /admin panel), so this
// never returns null — callers redirect straight to the role's home.
export function panelPathForRole(role: SessionUser["globalRole"]): string {
  switch (role) {
    case "TRAINER":
      return "/treinador";
    case "ATHLETE":
      return "/atleta";
    default:
      return "/admin"; // ADMIN e SUPERADMIN
  }
}
