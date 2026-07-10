import type { SessionUser } from "./use-session";

// Single source of truth for where an authenticated user lands by role.
// TRAINER and ATHLETE have panels; SUPERADMIN/ADMIN have no UI yet (admin
// tooling is a later phase), so they return null and the caller shows an
// "administrativo em breve" state instead of redirecting into a role-gated
// panel that would bounce them straight back to /login.
export function panelPathForRole(role: SessionUser["globalRole"]): string | null {
  switch (role) {
    case "TRAINER":
      return "/treinador";
    case "ATHLETE":
      return "/atleta";
    default:
      return null;
  }
}
