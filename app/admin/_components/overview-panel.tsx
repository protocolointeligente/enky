"use client";

import { uiClasses } from "@/app/_lib/ui";
import { StatCard } from "@/components/ui/stat-card";
import { UsersIcon, DumbbellIcon, CheckIcon, ClockIcon, LayersIcon, AlertIcon } from "@/components/ui/icons";
import { useAdminList } from "../_lib/use-admin-list";
import type { PlatformStats } from "../_lib/types";

// Métricas básicas da plataforma (item 11 da Fase 9). Agrupadas por pergunta,
// não por tabela: "quem está usando", "o que está sendo produzido", "o que
// precisa de atenção".
export function OverviewPanel() {
  const { data, loading, error } = useAdminList<{ stats: PlatformStats }>("/api/admin/stats");

  if (loading) return <p className="text-sm text-muted">Carregando métricas...</p>;
  if (error) return <p className={uiClasses.error}>{error}</p>;
  if (!data) return null;

  const s = data.stats;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className={uiClasses.subheading}>Quem está usando</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Usuários ativos"
            value={s.activeUsers}
            icon={<UsersIcon />}
            tone="turq"
            hint={`${s.usersActiveLast30Days} com acesso nos últimos 30 dias`}
          />
          <StatCard
            label="Usuários bloqueados"
            value={s.blockedUsers}
            icon={<AlertIcon />}
            tone={s.blockedUsers > 0 ? "orange" : "default"}
            hint={`${s.users} no total`}
          />
          <StatCard
            label="Treinadores"
            value={s.trainers}
            icon={<UsersIcon />}
            hint={`${s.athletesPerTrainerAvg} atletas em média (máx. ${s.athletesPerTrainerMax})`}
          />
          <StatCard
            label="Atletas"
            value={s.athletes}
            icon={<UsersIcon />}
            hint={`${s.organizations} organizações (${s.activeOrganizations} ativas)`}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={uiClasses.subheading}>O que está sendo produzido</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Treinos criados" value={s.workouts} icon={<DumbbellIcon />} tone="electric" />
          <StatCard
            label="Treinos concluídos"
            value={s.workoutsCompleted}
            icon={<CheckIcon />}
            tone="turq"
            hint={
              s.workouts === 0
                ? "sem treinos ainda"
                : `${Math.round((s.workoutsCompleted / s.workouts) * 100)}% do total`
            }
          />
          <StatCard label="Relatórios" value={s.reports} icon={<LayersIcon />} />
          <StatCard
            label="Convites pendentes"
            value={s.pendingInvitations}
            icon={<ClockIcon />}
            tone={s.pendingInvitations > 0 ? "orange" : "default"}
            hint="não aceitos, não revogados, não expirados"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={uiClasses.subheading}>Rastreabilidade</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Eventos de auditoria" value={s.auditEvents} icon={<LayersIcon />} />
        </div>
      </section>
    </div>
  );
}
