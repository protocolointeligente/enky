"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { actorTypeLabel, auditActionLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { adminTable, fmtDateTime, PanelState } from "../_lib/ui-bits";
import { useAdminList } from "../_lib/use-admin-list";
import type { AdminAuditLog } from "../_lib/types";

// Trilha append-only, do mais recente. Os filtros existem para responder as
// perguntas reais de investigação: "o que aconteceu com esta organização?",
// "quem bloqueou este usuário?", "o que houve naquele dia?".
export function AuditPanel({ organizationId }: { organizationId?: string }) {
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // A lista de ações do filtro vem do primeiro carregamento sem filtro; se
  // fosse relida a cada busca ela encolheria para "só a ação selecionada" e o
  // filtro viraria uma armadilha de mão única.
  const [knownActions, setKnownActions] = useState<string[]>([]);

  const { data, loading, error } = useAdminList<{
    logs: AdminAuditLog[];
    total: number;
    actions: string[];
  }>("/api/admin/audit", {
    action: action || undefined,
    organizationId,
    from: from || undefined,
    // `to` é uma data civil; sem isto o filtro "até 16/07" excluiria tudo que
    // aconteceu no próprio dia 16 depois da meia-noite.
    to: to ? `${to}T23:59:59` : undefined,
    limit: "100",
  });

  useEffect(() => {
    if (!data) return;
    setKnownActions((current) => (current.length === 0 ? data.actions : current));
  }, [data]);

  return (
    <section className={uiClasses.panel}>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <label className={uiClasses.label} htmlFor="audit-action">
            Ação
          </label>
          <select
            id="audit-action"
            className={`${uiClasses.select} sm:w-64`}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">Todas as ações</option>
            {(knownActions.length > 0 ? knownActions : data?.actions ?? []).map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <div>
            <label className={uiClasses.label} htmlFor="audit-from">
              De
            </label>
            <input
              id="audit-from"
              type="date"
              className={uiClasses.input}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="audit-to">
              Até
            </label>
            <input
              id="audit-to"
              type="date"
              className={uiClasses.input}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <PanelState loading={loading} error={error} empty={data?.logs.length === 0} />

      {data && data.logs.length > 0 && (
        <>
          <div className={adminTable.wrap}>
            <table className={adminTable.table}>
              <thead>
                <tr className={adminTable.headRow}>
                  <th className={adminTable.th}>Quando</th>
                  <th className={adminTable.th}>Ação</th>
                  <th className={adminTable.th}>Entidade</th>
                  <th className={adminTable.th}>Quem</th>
                  <th className={adminTable.th}>Organização</th>
                  <th className={adminTable.th}>Motivo</th>
                </tr>
              </thead>
              <tbody className={adminTable.body}>
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className={`${adminTable.td} whitespace-nowrap`}>
                      {fmtDateTime(log.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`${uiClasses.badge} bg-electric/15 text-electric-hi`}>
                        {auditActionLabel(log.action)}
                      </span>
                    </td>
                    <td className={adminTable.td}>{log.entityName}</td>
                    <td className={adminTable.tdStrong}>
                      {log.user?.name ?? actorTypeLabel(log.actorType)}
                      {log.user && (
                        <span className="block text-xs text-muted">{log.user.email}</span>
                      )}
                    </td>
                    <td className={adminTable.td}>
                      {log.organization ? (
                        <Link
                          href={`/admin/organizacoes/${log.organization.id}`}
                          className={uiClasses.link}
                        >
                          {log.organization.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${adminTable.td} max-w-xs`}>{log.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Exibindo {data.logs.length} de {data.total} eventos.
          </p>
        </>
      )}
    </section>
  );
}
