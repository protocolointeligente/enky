"use client";

import { useState } from "react";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { AthletesPanel } from "./_components/athletes-panel";
import { AuditPanel } from "./_components/audit-panel";
import { OrganizationsPanel } from "./_components/organizations-panel";
import { OverviewPanel } from "./_components/overview-panel";
import { TrainersPanel } from "./_components/trainers-panel";
import { UsersPanel } from "./_components/users-panel";

// Fase 9 — Admin Operacional.
//
// O gate de papel aqui é conveniência de UI (não pisca uma tela que o usuário
// não pode usar); a autorização real é `requireGlobalRole` + `assertAdmin` em
// cada rota/serviço. Treinador e atleta que digitarem /admin são redirecionados
// e, mesmo que não fossem, as APIs devolveriam 403.
const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"] as const;

const TABS = [
  { id: "overview", label: "Visão geral" },
  { id: "users", label: "Usuários" },
  { id: "organizations", label: "Organizações" },
  { id: "trainers", label: "Treinadores" },
  { id: "athletes", label: "Atletas" },
  { id: "audit", label: "Auditoria" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const { user, checked } = useRequireRole(ADMIN_ROLES);
  const [tab, setTab] = useState<TabId>("overview");

  if (!checked) {
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
            Olá, {user?.name?.split(" ")[0] ?? "admin"}. Visão transversal de toda a plataforma —
            toda ação aqui fica registrada na auditoria.
          </p>
        </header>

        <div role="tablist" aria-label="Seções do painel" className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`admin-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`admin-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "border-orange text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
          {tab === "overview" && <OverviewPanel />}
          {tab === "users" && <UsersPanel currentUser={user} />}
          {tab === "organizations" && <OrganizationsPanel />}
          {tab === "trainers" && <TrainersPanel />}
          {tab === "athletes" && <AthletesPanel />}
          {tab === "audit" && <AuditPanel />}
        </div>
      </div>
    </main>
  );
}
