"use client";

import { useState } from "react";
import Link from "next/link";
import { uiClasses } from "@/app/_lib/ui";
import { adminTable, fmtDate, PanelState, SearchField } from "../_lib/ui-bits";
import { useAdminList, useDebounced } from "../_lib/use-admin-list";
import type { AdminAthlete, AdminAthleteStatus } from "../_lib/types";

// Atleta tem três estados, não dois: além de ativo/bloqueado existe o convidado
// que nunca ativou (sem User). É o caso que mais gera chamado de suporte
// ("convidei e ele não aparece"), então tem rótulo próprio em vez de virar
// "bloqueado" por omissão.
const ATHLETE_STATUS: Record<AdminAthleteStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Ativo", className: "bg-turq/15 text-turq" },
  BLOCKED: { label: "Bloqueado", className: "bg-danger/15 text-danger" },
  PENDING_INVITE: { label: "Convite pendente", className: "bg-orange/15 text-orange-hi" },
};

export function AthletesPanel() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);

  const { data, loading, error } = useAdminList<{ athletes: AdminAthlete[]; total: number }>(
    "/api/admin/athletes",
    { search: debouncedSearch || undefined },
  );

  return (
    <section className={uiClasses.panel}>
      <div className="border-b border-line px-5 py-4">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nome ou e-mail (inclui convites)"
          label="Buscar atletas"
        />
      </div>

      <PanelState loading={loading} error={error} empty={data?.athletes.length === 0} />

      {data && data.athletes.length > 0 && (
        <>
          <div className={adminTable.wrap}>
            <table className={adminTable.table}>
              <thead>
                <tr className={adminTable.headRow}>
                  <th className={adminTable.th}>Atleta</th>
                  <th className={adminTable.th}>Treinador</th>
                  <th className={adminTable.th}>Organização</th>
                  <th className={adminTable.th}>Treinos</th>
                  <th className={adminTable.th}>Situação</th>
                  <th className={adminTable.th}>Desde</th>
                </tr>
              </thead>
              <tbody className={adminTable.body}>
                {data.athletes.map((athlete) => {
                  const state = ATHLETE_STATUS[athlete.status];
                  return (
                    <tr key={athlete.id}>
                      <td className={adminTable.tdStrong}>
                        <div className="flex flex-col">
                          <span>{athlete.name}</span>
                          <span className="text-xs text-muted">{athlete.email ?? "—"}</span>
                        </div>
                      </td>
                      <td className={adminTable.td}>{athlete.trainerName ?? "—"}</td>
                      <td className={adminTable.td}>
                        {athlete.organization ? (
                          <Link
                            href={`/admin/organizacoes/${athlete.organization.id}`}
                            className={uiClasses.link}
                          >
                            {athlete.organization.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${adminTable.td} tabular`}>{athlete.workouts}</td>
                      <td className="px-5 py-3">
                        <span className={`${uiClasses.badge} ${state.className}`}>{state.label}</span>
                      </td>
                      <td className={adminTable.td}>{fmtDate(athlete.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Exibindo {data.athletes.length} de {data.total}.
          </p>
        </>
      )}
    </section>
  );
}
