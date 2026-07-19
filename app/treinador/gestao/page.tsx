"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";

interface Alert {
  key: string;
  label: string;
  count: number;
  severity: "info" | "warn" | "danger";
}
const ALERT_TONE: Record<string, string> = {
  info: "border-electric/40 text-electric-hi",
  warn: "border-orange/40 text-orange-hi",
  danger: "border-danger/40 text-danger",
};

// Alertas internos (§23) — computados on-read, sem métrica falsa. Some quando não
// há permissão (papéis sem acesso financeiro) ou quando não há nada pendente.
function AlertsStrip() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    apiFetch<{ alerts: Alert[] }>("/api/trainer/alerts")
      .then((d) => setAlerts(d.alerts))
      .catch(() => setAlerts([]));
  }, []);
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((a) => (
        <span
          key={a.key}
          className={`inline-flex items-center gap-2 rounded-lg border bg-petrol/60 px-3 py-1.5 text-sm ${ALERT_TONE[a.severity] ?? ""}`}
        >
          <strong>{a.count}</strong>
          <span className="text-muted">{a.label}</span>
        </span>
      ))}
    </div>
  );
}

// Visão geral da Gestão (Etapa 4 §2/§36). Nesta fatia é só o mapa das subáreas
// comerciais da assessoria — sem cards de métrica, porque os dados (leads,
// contratos, receita) ainda não existem e o brief proíbe métrica financeira
// falsa. Cada subárea vira link quando sua fatia for entregue; até lá é `href:
// null` e aparece como "Em breve" (nunca um link morto).
const SUBAREAS: { label: string; desc: string; href: string | null }[] = [
  { label: "Leads", desc: "Funil de captação e conversão.", href: "/treinador/gestao/leads" },
  { label: "Clientes", desc: "Base de clientes, atletas e pagadores.", href: "/treinador/gestao/clientes" },
  { label: "Planos e serviços", desc: "Produtos comerciais da assessoria.", href: "/treinador/gestao/servicos" },
  { label: "Contratos", desc: "Contratos, renovações e cancelamentos.", href: "/treinador/gestao/contratos" },
  { label: "Mensalidades", desc: "Cobranças, vencimentos e pagamentos.", href: "/treinador/gestao/mensalidades" },
  { label: "Financeiro", desc: "Receitas, inadimplência e indicadores.", href: "/treinador/gestao/financeiro" },
  { label: "Treinadores", desc: "Equipe, papéis e carteiras.", href: "/treinador/gestao/treinadores" },
  { label: "Grupos", desc: "Turmas e coletivos de atletas.", href: "/treinador/gestao/grupos" },
  { label: "Comunicação", desc: "Avisos, lembretes e mensagens.", href: "/treinador/gestao/comunicacao" },
  { label: "Configurações da assessoria", desc: "Dados da organização e políticas.", href: null },
];

export default function TrainerManagementPage() {
  const { checked } = useRequireRole("TRAINER");
  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão</p>
            <h1 className={uiClasses.heading}>Gestão da assessoria</h1>
            <p className={uiClasses.hint}>
              O lado comercial do seu negócio: leads, clientes, contratos e financeiro.
            </p>
          </div>
          <Link href="/treinador/gestao/busca" className={uiClasses.buttonSecondary}>
            Busca global
          </Link>
        </header>

        <AlertsStrip />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUBAREAS.map((area) => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className={uiClasses.subheading}>{area.label}</h2>
                  {area.href ? null : (
                    <span className={`${uiClasses.badge} bg-surface text-faint`}>Em breve</span>
                  )}
                </div>
                <p className={uiClasses.hint}>{area.desc}</p>
              </>
            );
            return area.href ? (
              <Link
                key={area.label}
                href={area.href}
                className={`${uiClasses.card} flex flex-col gap-1 transition-colors hover:border-line-strong`}
              >
                {inner}
              </Link>
            ) : (
              <div
                key={area.label}
                className={`${uiClasses.card} flex flex-col gap-1 opacity-70`}
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
