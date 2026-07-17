"use client";

import { use, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/_lib/api-client";
import {
  billingCycleLabel,
  organizationRoleLabel,
  roleLabel,
  subscriptionStatusLabel,
} from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ConfirmActionDialog, type ConfirmActionTarget } from "@/components/admin/confirm-action-dialog";
import { StatCard } from "@/components/ui/stat-card";
import { AuditPanel } from "../../_components/audit-panel";
import { adminTable, fmtDate, StateBadge } from "../../_lib/ui-bits";
import { useAdminList } from "../../_lib/use-admin-list";
import type { OrganizationDetail } from "../../_lib/types";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"] as const;

// Detalhe de uma organização: a tela onde o admin diagnostica um tenant —
// quem é o time, qual o plano, o que já foi produzido e o que aconteceu ali.
// Abrir esta página grava ADMIN_VIEW_ORGANIZATION na trilha (ver
// modules/admin/README.md), o que é intencional: acesso cross-tenant é
// rastreável por princípio.
export default function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole(ADMIN_ROLES);
  const [confirming, setConfirming] = useState(false);

  const { data, loading, error, reload } = useAdminList<OrganizationDetail>(
    `/api/admin/organizations/${id}`,
  );

  async function applyStatus(reason: string) {
    if (!data) return;
    await apiFetch(`/api/admin/organizations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        isActive: !data.organization.isActive,
        reason: reason || undefined,
      }),
    });
    setConfirming(false);
    reload();
  }

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando organização...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className={uiClasses.page}>
        <div className={uiClasses.wide}>
          <p className={uiClasses.error}>{error ?? "Organização não encontrada."}</p>
          <Link href="/admin" className={uiClasses.link}>
            ← Voltar ao painel
          </Link>
        </div>
      </main>
    );
  }

  const { organization, subscription, counts, members, athletes } = data;

  const confirmTarget: ConfirmActionTarget | null = confirming
    ? organization.isActive
      ? {
          title: "Suspender organização",
          description:
            "Treinadores e atletas desta organização perdem o acesso às operações do tenant na próxima requisição. Nenhum dado é apagado e reativar devolve tudo como estava.",
          targetName: `${organization.name} — ${counts.trainers} treinador(es), ${counts.athletes} atleta(s)`,
          confirmLabel: "Suspender organização",
          destructive: true,
        }
      : {
          title: "Reativar organização",
          description: "A organização volta a operar normalmente.",
          targetName: organization.name,
          confirmLabel: "Reativar",
          destructive: false,
        }
    : null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <Link href="/admin" className={`${uiClasses.link} text-sm`}>
          ← Voltar ao painel
        </Link>

        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className={uiClasses.eyebrow}>Organização</span>
            <h1 className={uiClasses.heading}>{organization.name}</h1>
            <p className={uiClasses.hint}>
              {organization.slug} · {organization.timezone} · desde{" "}
              {fmtDate(organization.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StateBadge
              active={organization.isActive}
              activeLabel="Ativa"
              inactiveLabel="Suspensa"
            />
            <button
              type="button"
              className={organization.isActive ? uiClasses.buttonDanger : uiClasses.button}
              onClick={() => setConfirming(true)}
            >
              {organization.isActive ? "Suspender" : "Reativar"}
            </button>
          </div>
        </header>

        {!organization.isActive && (
          <p className={uiClasses.error}>
            Organização suspensa — treinadores e atletas deste tenant estão sem acesso às operações.
          </p>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatCard label="Treinadores" value={counts.trainers} />
          <StatCard label="Atletas" value={counts.athletes} />
          <StatCard label="Treinos" value={counts.workouts} />
          <StatCard label="Concluídos" value={counts.workoutsCompleted} tone="turq" />
          <StatCard label="Relatórios" value={counts.reports} />
          <StatCard
            label="Convites pendentes"
            value={counts.pendingInvitations}
            tone={counts.pendingInvitations > 0 ? "orange" : "default"}
          />
        </section>

        <section className={`${uiClasses.card} flex flex-col gap-3`}>
          <h2 className={uiClasses.subheading}>Assinatura</h2>
          {subscription ? (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wider text-faint">Plano</dt>
                <dd className="text-ink">{subscription.planName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-faint">Situação</dt>
                <dd className="text-ink">{subscriptionStatusLabel(subscription.status)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-faint">Valor</dt>
                <dd className="tabular text-ink">
                  {subscription.planPrice.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}{" "}
                  <span className="text-muted">
                    / {billingCycleLabel(subscription.billingCycle).toLowerCase()}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-faint">Período atual</dt>
                <dd className="text-ink">
                  {subscription.currentPeriodEnd
                    ? `até ${fmtDate(subscription.currentPeriodEnd)}`
                    : "—"}
                  {subscription.cancelAtPeriodEnd && (
                    <span className="block text-xs text-orange-hi">
                      cancela ao fim do período
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className={uiClasses.hint}>
              Nenhuma assinatura registrada para esta organização.
            </p>
          )}
        </section>

        <section className={uiClasses.panel}>
          <h2 className={`${uiClasses.subheading} border-b border-line px-5 py-4`}>
            Membros ({members.length})
          </h2>
          {members.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nenhum membro.</p>
          ) : (
            <div className={adminTable.wrap}>
              <table className={adminTable.table}>
                <thead>
                  <tr className={adminTable.headRow}>
                    <th className={adminTable.th}>Nome</th>
                    <th className={adminTable.th}>Papel na organização</th>
                    <th className={adminTable.th}>Papel global</th>
                    <th className={adminTable.th}>Situação</th>
                  </tr>
                </thead>
                <tbody className={adminTable.body}>
                  {members.map((member) => (
                    <tr key={member.userId}>
                      <td className={adminTable.tdStrong}>
                        <div className="flex flex-col">
                          <span>{member.name}</span>
                          <span className="text-xs text-muted">{member.email}</span>
                        </div>
                      </td>
                      <td className={adminTable.td}>
                        {organizationRoleLabel(member.organizationRole)}
                      </td>
                      <td className={adminTable.td}>{roleLabel(member.globalRole)}</td>
                      <td className="px-5 py-3">
                        <StateBadge
                          active={member.isActive}
                          activeLabel="Ativo"
                          inactiveLabel="Bloqueado"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={uiClasses.panel}>
          <h2 className={`${uiClasses.subheading} border-b border-line px-5 py-4`}>
            Atletas ativos ({athletes.length})
          </h2>
          {athletes.length === 0 ? (
            <p className="p-5 text-sm text-muted">Nenhum atleta com vínculo ativo.</p>
          ) : (
            <div className={adminTable.wrap}>
              <table className={adminTable.table}>
                <thead>
                  <tr className={adminTable.headRow}>
                    <th className={adminTable.th}>Atleta</th>
                    <th className={adminTable.th}>Treinador</th>
                    <th className={adminTable.th}>Situação</th>
                  </tr>
                </thead>
                <tbody className={adminTable.body}>
                  {athletes.map((athlete) => (
                    <tr key={athlete.id}>
                      <td className={adminTable.tdStrong}>
                        <div className="flex flex-col">
                          <span>{athlete.name}</span>
                          <span className="text-xs text-muted">{athlete.email ?? "—"}</span>
                        </div>
                      </td>
                      <td className={adminTable.td}>{athlete.trainerName}</td>
                      <td className="px-5 py-3">
                        <StateBadge
                          active={athlete.isActive}
                          activeLabel="Ativo"
                          inactiveLabel="Sem acesso"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={uiClasses.subheading}>Auditoria desta organização</h2>
          <AuditPanel organizationId={id} />
        </section>

        <ConfirmActionDialog
          target={confirmTarget}
          onCancel={() => setConfirming(false)}
          onConfirm={applyStatus}
        />
      </div>
    </main>
  );
}
