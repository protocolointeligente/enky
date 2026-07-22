"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/_lib/api-client";
import { roleLabel, ROLE_LABELS } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import type { SessionUser } from "@/app/_lib/use-session";
import { ConfirmActionDialog, type ConfirmActionTarget } from "@/components/admin/confirm-action-dialog";
import { adminTable, fmtDate, PanelState, SearchField, StateBadge } from "../_lib/ui-bits";
import { useAdminList, useDebounced } from "../_lib/use-admin-list";
import type { AdminUser } from "../_lib/types";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];

// Bloquear/desbloquear é a ação de suporte mais usada, e a mais perigosa: por
// isso passa por confirmação com motivo e nunca apaga nada.
export function UsersPanel({ currentUser }: { currentUser: SessionUser | null }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<AdminUser | null>(null);

  const debouncedSearch = useDebounced(search);
  const { data, loading, error, reload } = useAdminList<{ users: AdminUser[]; total: number }>(
    "/api/admin/users",
    { search: debouncedSearch || undefined, role: role || undefined, status: status || undefined },
  );

  // Espelha as regras do servidor (admin-service.ts) para não oferecer um botão
  // que só falharia: ninguém bloqueia a si mesmo, e só SUPERADMIN mexe em
  // ADMIN/SUPERADMIN. O servidor é quem garante — aqui é só não mentir na tela.
  function blockDisabledReason(user: AdminUser): string | null {
    if (user.id === currentUser?.userId) return "Você não pode bloquear a própria conta.";
    if (ADMIN_ROLES.includes(user.globalRole) && currentUser?.globalRole !== "SUPERADMIN") {
      return "Apenas SUPERADMIN altera contas ADMIN/SUPERADMIN.";
    }
    return null;
  }

  async function applyStatus(reason: string) {
    if (!pending) return;
    await apiFetch(`/api/admin/users/${pending.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !pending.isActive, reason: reason || undefined }),
    });
    setPending(null);
    reload();
  }

  const confirmTarget: ConfirmActionTarget | null = pending
    ? pending.isActive
      ? {
          title: "Bloquear usuário",
          description:
            "O usuário perde o acesso imediatamente e todas as sessões dele são encerradas. Nada é apagado — você pode desbloquear depois.",
          targetName: `${pending.name} (${pending.email})`,
          confirmLabel: "Bloquear acesso",
          destructive: true,
        }
      : {
          title: "Desbloquear usuário",
          description: "O usuário volta a conseguir entrar na plataforma.",
          targetName: `${pending.name} (${pending.email})`,
          confirmLabel: "Desbloquear",
          destructive: false,
        }
    : null;

  return (
    <section className={uiClasses.panel}>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nome ou e-mail"
          label="Buscar usuários"
        />
        <div className="flex gap-2">
          <select
            className={uiClasses.select}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Filtrar por papel"
          >
            <option value="">Todos os papéis</option>
            {Object.keys(ROLE_LABELS).map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <select
            className={uiClasses.select}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filtrar por situação"
          >
            <option value="">Todas as situações</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
          </select>
        </div>
      </div>

      <PanelState loading={loading} error={error} empty={data?.users.length === 0} />

      {data && data.users.length > 0 && (
        <>
          <div className={adminTable.wrap}>
            <table className={adminTable.table}>
              <thead>
                <tr className={adminTable.headRow}>
                  <th className={adminTable.th}>Usuário</th>
                  <th className={adminTable.th}>Papel</th>
                  <th className={adminTable.th}>Organização</th>
                  <th className={adminTable.th}>Situação</th>
                  <th className={adminTable.th}>Desde</th>
                  <th className={adminTable.th}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className={adminTable.body}>
                {data.users.map((user) => {
                  const disabledReason = user.isActive ? blockDisabledReason(user) : null;
                  return (
                    <tr key={user.id}>
                      <td className={adminTable.tdStrong}>
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          <span className="text-xs text-muted">{user.email}</span>
                        </div>
                      </td>
                      <td className={adminTable.td}>{roleLabel(user.globalRole)}</td>
                      <td className={adminTable.td}>
                        {user.organizations.length === 0
                          ? "—"
                          : user.organizations.map((org) => (
                              <Link
                                key={org.id}
                                href={`/admin/organizacoes/${org.id}`}
                                className={`${uiClasses.link} block`}
                              >
                                {org.name}
                              </Link>
                            ))}
                      </td>
                      <td className="px-5 py-3">
                        <StateBadge
                          active={user.isActive}
                          activeLabel="Ativo"
                          inactiveLabel="Bloqueado"
                        />
                      </td>
                      <td className={adminTable.td}>{fmtDate(user.createdAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          className={user.isActive ? uiClasses.buttonDanger : uiClasses.buttonSecondary}
                          onClick={() => setPending(user)}
                          disabled={Boolean(disabledReason)}
                          title={disabledReason ?? undefined}
                        >
                          {user.isActive ? "Bloquear" : "Desbloquear"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Exibindo {data.users.length} de {data.total}.
          </p>
        </>
      )}

      <ConfirmActionDialog
        target={confirmTarget}
        onCancel={() => setPending(null)}
        onConfirm={applyStatus}
      />
    </section>
  );
}
