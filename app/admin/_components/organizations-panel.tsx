"use client";

import { useState } from "react";
import Link from "next/link";
import { subscriptionStatusLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { adminTable, fmtDate, PanelState, SearchField, StateBadge } from "../_lib/ui-bits";
import { useAdminList, useDebounced } from "../_lib/use-admin-list";
import type { AdminOrganization } from "../_lib/types";

// A listagem não age: suspender exige abrir a organização e ver o que há dentro
// (quantos treinadores, quantos atletas, qual plano) antes de cortar o tenant
// inteiro. Suspender direto de uma linha de tabela seria fácil demais.
export function OrganizationsPanel() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const debouncedSearch = useDebounced(search);
  const { data, loading, error } = useAdminList<{
    organizations: AdminOrganization[];
    total: number;
  }>("/api/admin/organizations", {
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  return (
    <section className={uiClasses.panel}>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nome ou slug"
          label="Buscar organizações"
        />
        <select
          className={`${uiClasses.select} sm:w-56`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filtrar por situação"
        >
          <option value="">Todas as situações</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
        </select>
      </div>

      <PanelState loading={loading} error={error} empty={data?.organizations.length === 0} />

      {data && data.organizations.length > 0 && (
        <>
          <div className={adminTable.wrap}>
            <table className={adminTable.table}>
              <thead>
                <tr className={adminTable.headRow}>
                  <th className={adminTable.th}>Organização</th>
                  <th className={adminTable.th}>Plano</th>
                  <th className={adminTable.th}>Treinadores</th>
                  <th className={adminTable.th}>Atletas</th>
                  <th className={adminTable.th}>Treinos</th>
                  <th className={adminTable.th}>Situação</th>
                  <th className={adminTable.th}>Desde</th>
                </tr>
              </thead>
              <tbody className={adminTable.body}>
                {data.organizations.map((org) => (
                  <tr key={org.id}>
                    <td className={adminTable.tdStrong}>
                      <Link href={`/admin/organizacoes/${org.id}`} className={uiClasses.link}>
                        {org.name}
                      </Link>
                      <span className="block text-xs text-muted">{org.slug}</span>
                    </td>
                    <td className={adminTable.td}>
                      {org.planName ?? "—"}
                      {org.subscriptionStatus && (
                        <span className="block text-xs text-faint">
                          {subscriptionStatusLabel(org.subscriptionStatus)}
                        </span>
                      )}
                    </td>
                    <td className={`${adminTable.td} tabular`}>{org.trainers}</td>
                    <td className={`${adminTable.td} tabular`}>{org.athletes}</td>
                    <td className={`${adminTable.td} tabular`}>{org.workouts}</td>
                    <td className="px-5 py-3">
                      <StateBadge
                        active={org.isActive}
                        activeLabel="Ativa"
                        inactiveLabel="Suspensa"
                      />
                    </td>
                    <td className={adminTable.td}>{fmtDate(org.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Exibindo {data.organizations.length} de {data.total}.
          </p>
        </>
      )}
    </section>
  );
}
