"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"] as const;

interface PlatformStats {
  trainers: number;
  athletes: number;
  organizations: number;
  workouts: number;
  reports: number;
  auditEvents: number;
}

interface AuditLog {
  id: string;
  action: string;
  entityName: string;
  entityId: string | null;
  createdAt: string;
  actorType: string;
  reason: string | null;
  user: { name: string; email: string } | null;
  organization: { name: string } | null;
}

const STAT_LABELS: { key: keyof PlatformStats; label: string }[] = [
  { key: "trainers", label: "Treinadores" },
  { key: "athletes", label: "Atletas" },
  { key: "organizations", label: "Organizações" },
  { key: "workouts", label: "Treinos" },
  { key: "reports", label: "Relatórios" },
  { key: "auditEvents", label: "Eventos de auditoria" },
];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const { user, checked } = useRequireRole(ADMIN_ROLES);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ stats: PlatformStats }>("/api/admin/stats")
      .then((r) => setStats(r.stats))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  useEffect(() => {
    if (!checked) return;
    const query = action ? `?action=${encodeURIComponent(action)}` : "";
    apiFetch<{ logs: AuditLog[]; actions: string[] }>(`/api/admin/audit${query}`)
      .then((r) => {
        setLogs(r.logs);
        // Só atualiza a lista de ações quando não há filtro (senão ela encolhe).
        if (!action) setActions(r.actions);
      })
      .catch(() => setLogs([]));
  }, [checked, action]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando painel administrativo...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Administração</span>
          <h1 className={uiClasses.heading}>Painel da plataforma</h1>
          <p className={uiClasses.hint}>
            Olá, {user?.name?.split(" ")[0] ?? "admin"}. Visão transversal de toda a plataforma.
          </p>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {stats && (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STAT_LABELS.map(({ key, label }) => (
              <div key={key} className={`${uiClasses.card} flex flex-col gap-1`}>
                <span className="font-display text-2xl font-bold tabular text-ink">
                  {stats[key]}
                </span>
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </section>
        )}

        <section className={uiClasses.panel}>
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className={uiClasses.subheading}>Trilha de auditoria</h2>
            <select
              className={`${uiClasses.select} sm:w-64`}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="Filtrar por ação"
            >
              <option value="">Todas as ações</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {logs.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nenhum evento registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-faint">
                    <th className="px-5 py-3">Quando</th>
                    <th className="px-5 py-3">Ação</th>
                    <th className="px-5 py-3">Entidade</th>
                    <th className="px-5 py-3">Usuário</th>
                    <th className="px-5 py-3">Organização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-muted">
                        {fmtDateTime(log.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`${uiClasses.badge} bg-electric/15 text-electric-hi`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted">{log.entityName}</td>
                      <td className="px-5 py-3 text-ink">
                        {log.user?.name ?? (log.actorType !== "USER" ? log.actorType : "—")}
                      </td>
                      <td className="px-5 py-3 text-muted">{log.organization?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
