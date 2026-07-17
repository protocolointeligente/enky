"use client";

import { useState } from "react";
import Link from "next/link";
import { uiClasses } from "@/app/_lib/ui";
import { adminTable, fmtDate, PanelState, SearchField, StateBadge } from "../_lib/ui-bits";
import { useAdminList, useDebounced } from "../_lib/use-admin-list";
import type { AdminTrainer } from "../_lib/types";

// Visão de "atletas por treinador" no detalhe — a métrica agregada do painel
// responde a média; esta tabela responde quem.
export function TrainersPanel() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);

  const { data, loading, error } = useAdminList<{ trainers: AdminTrainer[]; total: number }>(
    "/api/admin/trainers",
    { search: debouncedSearch || undefined },
  );

  return (
    <section className={uiClasses.panel}>
      <div className="border-b border-line px-5 py-4">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nome ou e-mail"
          label="Buscar treinadores"
        />
      </div>

      <PanelState loading={loading} error={error} empty={data?.trainers.length === 0} />

      {data && data.trainers.length > 0 && (
        <>
          <div className={adminTable.wrap}>
            <table className={adminTable.table}>
              <thead>
                <tr className={adminTable.headRow}>
                  <th className={adminTable.th}>Treinador</th>
                  <th className={adminTable.th}>CREF</th>
                  <th className={adminTable.th}>Organização</th>
                  <th className={adminTable.th}>Atletas</th>
                  <th className={adminTable.th}>Treinos</th>
                  <th className={adminTable.th}>Situação</th>
                  <th className={adminTable.th}>Desde</th>
                </tr>
              </thead>
              <tbody className={adminTable.body}>
                {data.trainers.map((trainer) => (
                  <tr key={trainer.id}>
                    <td className={adminTable.tdStrong}>
                      <div className="flex flex-col">
                        <span>{trainer.name}</span>
                        <span className="text-xs text-muted">{trainer.email}</span>
                      </div>
                    </td>
                    <td className={adminTable.td}>{trainer.crefCode ?? "—"}</td>
                    <td className={adminTable.td}>
                      {trainer.organization ? (
                        <Link
                          href={`/admin/organizacoes/${trainer.organization.id}`}
                          className={uiClasses.link}
                        >
                          {trainer.organization.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {trainer.organization && !trainer.organization.isActive && (
                        <span className="block text-xs text-danger">suspensa</span>
                      )}
                    </td>
                    <td className={`${adminTable.td} tabular`}>{trainer.athletes}</td>
                    <td className={`${adminTable.td} tabular`}>{trainer.workouts}</td>
                    <td className="px-5 py-3">
                      <StateBadge
                        active={trainer.isActive}
                        activeLabel="Ativo"
                        inactiveLabel="Bloqueado"
                      />
                    </td>
                    <td className={adminTable.td}>{fmtDate(trainer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Exibindo {data.trainers.length} de {data.total}.
          </p>
        </>
      )}
    </section>
  );
}
