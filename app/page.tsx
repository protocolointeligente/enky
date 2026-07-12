"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/_lib/api-client";
import { panelPathForRole } from "@/app/_lib/role-routes";
import type { SessionUser } from "@/app/_lib/use-session";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Landing pública. Renderiza imediatamente (sem bloquear no /session); se houver
// sessão, redireciona o usuário para o painel do seu papel em segundo plano.
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ authenticated: boolean; user: SessionUser | null }>("/api/auth/session")
      .then((s) => {
        if (!cancelled && s.authenticated && s.user) {
          router.replace(panelPathForRole(s.user.globalRole));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-deep text-ink">
      <SiteNav />
      <Hero />
      <MethodologyStrip />
      <RoleSplit />
      <Pillars />
      <HowItWorks />
      <Pricing />
      <FinalCta />
      <SiteFooter />
    </div>
  );
}

/* ---------------------------------------------------------------- nav ---- */

function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-deep/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
        <Link href="/" aria-label="ENKY — início">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#recursos" className="transition-colors hover:text-ink">
            Recursos
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-ink">
            Como funciona
          </a>
          <a href="#planos" className="transition-colors hover:text-ink">
            Planos
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Entrar
          </Link>
          <Link
            href="/registrar"
            className="rounded-lg bg-orange px-4 py-2 text-sm font-semibold text-onbrand transition-colors hover:bg-orange-hi"
          >
            Criar conta grátis
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------- hero ---- */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* brilho sutil de fundo (profundidade, não gamer) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 78% 8%, rgba(0,102,255,0.14), transparent 60%), radial-gradient(50% 45% at 12% 20%, rgba(255,101,0,0.10), transparent 62%)",
        }}
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-petrol/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-turq" />
            Plataforma de performance humana
          </span>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Menos planilha.
            <br />
            <span className="text-orange">Mais decisão.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">
            A ENKY reúne prescrição, calendário e leitura de carga do atleta num só lugar — e
            transforma dados em contexto claro para você decidir o próximo treino com segurança.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/registrar"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange px-6 py-3 font-semibold text-onbrand transition-colors hover:bg-orange-hi"
            >
              Começar grátis
              <ArrowIcon />
            </Link>
            <a
              href="#planos"
              className="inline-flex items-center justify-center rounded-lg border border-line-strong px-6 py-3 font-semibold text-ink transition-colors hover:border-electric hover:text-electric-hi"
            >
              Ver planos
            </a>
          </div>
          <p className="text-sm text-faint">
            Grátis para começar — 1 atleta, sem cartão de crédito.
          </p>
        </div>

        <HeroMock />
      </div>
    </section>
  );
}

// Mock do produto — parece a tela real (não é stock). Divs com os tokens da marca.
function HeroMock() {
  const bars = [42, 55, 48, 63, 70, 58, 66, 74, 61, 80, 72, 88];
  return (
    <div className="relative">
      <div className="rounded-2xl border border-line bg-petrol/80 p-5 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface font-display text-sm font-bold text-orange">
              MC
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Marina Costa</p>
              <p className="text-xs text-faint">Meia maratona · 8 semanas</p>
            </div>
          </div>
          <span className="rounded-full bg-turq/15 px-2.5 py-0.5 text-xs font-semibold text-turq">
            Prontidão boa
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-line bg-deep/60 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">
              Carga de treino
            </p>
            <p className="text-xs text-muted">últimas 12 semanas</p>
          </div>
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-electric/70"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3">
            <Metric label="CTL" value="48" tone="text-electric-hi" />
            <Metric label="ATL" value="52" tone="text-ink" />
            <Metric label="ACWR" value="1.08" tone="text-turq" />
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange/25 bg-orange/[0.06] p-3.5">
          <span className="mt-0.5 shrink-0 text-orange">
            <SignalIcon />
          </span>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink">Atenção:</span> carga subindo há 3 semanas.
            Considere uma semana de recuperação antes do próximo bloco.
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</span>
      <span className={`tabular font-display text-xl font-bold ${tone}`}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------ methodology ---- */

function MethodologyStrip() {
  const items = ["CTL · ATL · TSB", "ACWR", "sRPE", "Prontidão diária", "Aderência", "Periodização"];
  return (
    <section className="border-y border-line/60 bg-petrol/40">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-faint">
          Construída sobre a ciência do treinamento
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {items.map((m) => (
            <span
              key={m}
              className="font-display text-sm font-semibold tracking-tight text-muted sm:text-base"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- role split ---- */
// Clareza de papéis (padrão TrainingPeaks/FinalSurge/Treinus): o que cada lado
// ganha, lado a lado. Treinador comanda; atleta executa com clareza.

function RoleSplit() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
      <div className="max-w-2xl">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Feito para os dois lados do treino.
        </h2>
        <p className="mt-4 text-lg text-muted">
          Uma plataforma só — o treinador comanda a operação, o atleta treina com clareza. Cada um
          na sua tela, conectados pelo mesmo plano.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <RoleCard
          eyebrow="Para o treinador"
          tone="orange"
          icon={<WhistleGlyph />}
          title="Comande sua operação"
          points={[
            "Cadastre e organize seus atletas",
            "Prescreva no calendário e publique num toque",
            "Veja quem precisa de atenção antes de virar problema",
            "Gere relatórios e compartilhe evolução",
          ]}
          cta={{ label: "Criar conta grátis", href: "/registrar" }}
        />
        <RoleCard
          eyebrow="Para o atleta"
          tone="electric"
          icon={<RunnerGlyph />}
          title="Treine com clareza"
          points={[
            "O treino do dia, organizado, no celular",
            "Execute e devolva o feedback na hora",
            "Registre prontidão e acompanhe sua evolução",
            "Sem planilha, sem grupo de WhatsApp perdido",
          ]}
          note="Seu treinador te convida — a conta do atleta é criada pelo convite."
        />
      </div>
    </section>
  );
}

function RoleCard({
  eyebrow,
  title,
  points,
  icon,
  tone,
  cta,
  note,
}: {
  eyebrow: string;
  title: string;
  points: string[];
  icon: React.ReactNode;
  tone: "orange" | "electric";
  cta?: { label: string; href: string };
  note?: string;
}) {
  const accent = tone === "orange" ? "text-orange bg-orange/10" : "text-electric-hi bg-electric/10";
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-petrol/50 p-8 sm:p-10">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">{eyebrow}</span>
      </div>
      <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">{title}</h3>
      <ul className="mt-5 flex flex-1 flex-col gap-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-3 text-muted">
            <span className="mt-0.5 shrink-0 text-turq">
              <CheckGlyph />
            </span>
            <span className="text-sm leading-relaxed">{p}</span>
          </li>
        ))}
      </ul>
      {cta && (
        <Link
          href={cta.href}
          className="mt-7 inline-flex w-fit items-center gap-2 rounded-lg bg-orange px-5 py-2.5 font-semibold text-onbrand transition-colors hover:bg-orange-hi"
        >
          {cta.label}
          <ArrowIcon />
        </Link>
      )}
      {note && <p className="mt-7 text-xs leading-relaxed text-faint">{note}</p>}
    </div>
  );
}

/* ----------------------------------------------------------- pillars ---- */

function Pillars() {
  return (
    <section id="recursos" className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
      <div className="max-w-2xl">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Tudo que o treino precisa. Nada que atrapalhe.
        </h2>
        <p className="mt-4 text-lg text-muted">
          Do planejamento à execução do atleta — com inteligência que explica, nunca diagnostica.
        </p>
      </div>

      <div className="mt-14 flex flex-col gap-6">
        <Pillar
          icon={<CalendarGlyph />}
          tone="electric"
          title="Prescrição e calendário"
          body="Monte o treino com blocos e séries, publique no calendário do atleta e acompanhe o status — planejado, realizado, parcial. O atleta executa pelo celular e devolve o feedback na hora."
          points={["Calendário semanal e mensal", "Templates reutilizáveis", "Feedback pós-treino (sRPE)"]}
        />
        <Pillar
          icon={<BrainGlyph />}
          tone="turq"
          title="ENKY Intelligence"
          reverse
          body="A leitura de carga (CTL/ATL/TSB, ACWR), a prontidão diária e a lista de atletas que precisam de atenção — traduzidas em linguagem de contexto para apoiar a sua decisão, com a sua palavra final sempre."
          points={["Estado de carga e risco", "Prontidão e recuperação", "Atenção da carteira"]}
        />
        <Pillar
          icon={<ReportGlyph />}
          tone="orange"
          title="Relatórios e evolução"
          body="Fotografe o período — aderência, carga e prontidão — num relatório claro que você revisa e compartilha com o atleta. A conversa deixa de ser achismo e passa a ser evidência."
          points={["Relatório de período", "Compartilhável com o atleta", "Histórico que vira insight"]}
        />
      </div>
    </section>
  );
}

function Pillar({
  icon,
  title,
  body,
  points,
  tone,
  reverse,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  points: string[];
  tone: "electric" | "turq" | "orange";
  reverse?: boolean;
}) {
  const toneRing = {
    electric: "text-electric-hi bg-electric/10",
    turq: "text-turq bg-turq/10",
    orange: "text-orange bg-orange/10",
  }[tone];
  return (
    <article
      className={`grid gap-8 rounded-2xl border border-line bg-petrol/50 p-8 sm:p-10 lg:grid-cols-2 lg:items-center ${
        reverse ? "" : ""
      }`}
    >
      <div className={reverse ? "lg:order-2" : ""}>
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${toneRing}`}>
          {icon}
        </span>
        <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">{title}</h3>
        <p className="mt-3 leading-relaxed text-muted">{body}</p>
      </div>
      <ul className={`flex flex-col gap-3 ${reverse ? "lg:order-1" : ""}`}>
        {points.map((p) => (
          <li
            key={p}
            className="flex items-center gap-3 rounded-xl border border-line bg-deep/50 px-4 py-3.5"
          >
            <span className="shrink-0 text-turq">
              <CheckGlyph />
            </span>
            <span className="text-sm font-medium text-ink">{p}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ----------------------------------------------------- how it works ---- */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Cadastre o atleta",
      body: "Convide por e-mail. Ele ativa a conta e você já tem o perfil pronto para prescrever.",
    },
    {
      n: "02",
      title: "Prescreva no calendário",
      body: "Monte o treino, publique e o atleta recebe tudo organizado, dia a dia, no celular.",
    },
    {
      n: "03",
      title: "Acompanhe com inteligência",
      body: "Feedback, carga e prontidão viram contexto claro para ajustar o próximo treino.",
    },
  ];
  return (
    <section id="como-funciona" className="border-y border-line/60 bg-petrol/30">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Do convite ao ajuste, em três passos.
        </h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-deep/40 p-7">
              <span className="font-display text-4xl font-bold text-orange/80">{s.n}</span>
              <h3 className="mt-4 font-display text-xl font-bold text-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- pricing ---- */

function Pricing() {
  return (
    <section id="planos" className="mx-auto max-w-6xl px-5 py-24 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Comece grátis. Cresça quando fizer sentido.
        </h2>
        <p className="mt-4 text-lg text-muted">
          Um atleta é de graça, para sempre. Os planos maiores chegam em breve — e você ajuda a
          moldá-los.
        </p>
      </div>

      <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
        <PlanCard
          name="Grátis"
          price="R$ 0"
          cadence="para sempre"
          highlight
          description="Tudo que você precisa para treinar 1 atleta com método."
          features={[
            "1 atleta ativo",
            "Calendário e prescrição",
            "Feedback pós-treino",
            "Leitura de carga e prontidão",
            "Relatório de período",
          ]}
          cta={{ label: "Começar grátis", href: "/registrar", primary: true }}
        />
        <PlanCard
          name="Pro"
          price="Em breve"
          cadence="para quem tem carteira"
          description="Para o treinador que gerencia vários atletas e quer a Intelligence completa."
          features={[
            "Vários atletas",
            "ENKY Intelligence completa",
            "Periodização e templates",
            "Relatórios avançados",
          ]}
          cta={{ label: "Quero ser avisado", href: "/registrar", primary: false }}
        />
        <PlanCard
          name="Assessoria"
          price="Em breve"
          cadence="para equipes"
          description="Para assessorias com múltiplos treinadores e operação em escala."
          features={[
            "Múltiplos treinadores",
            "Grupos de atletas",
            "Gestão da equipe",
            "Marketplace de planos",
          ]}
          cta={{ label: "Falar com a gente", href: "/registrar", primary: false }}
        />
      </div>
    </section>
  );
}

function PlanCard({
  name,
  price,
  cadence,
  description,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  cta: { label: string; href: string; primary: boolean };
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-8 ${
        highlight
          ? "border-orange/50 bg-petrol/80 shadow-2xl shadow-orange/5"
          : "border-line bg-petrol/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink">{name}</h3>
        {highlight && (
          <span className="rounded-full bg-orange/15 px-2.5 py-0.5 text-xs font-semibold text-orange">
            Recomendado
          </span>
        )}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold tracking-tight text-ink">{price}</span>
        <span className="text-sm text-faint">{cadence}</span>
      </div>
      <p className="mt-3 min-h-[3rem] text-sm leading-relaxed text-muted">{description}</p>
      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-3 text-sm text-ink">
            <span className="shrink-0 text-turq">
              <CheckGlyph />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`mt-8 inline-flex items-center justify-center rounded-lg px-5 py-3 font-semibold transition-colors ${
          cta.primary
            ? "bg-orange text-onbrand hover:bg-orange-hi"
            : "border border-line-strong text-ink hover:border-electric hover:text-electric-hi"
        }`}
      >
        {cta.label}
      </Link>
    </div>
  );
}

/* -------------------------------------------------------- final cta ---- */

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-petrol/70 px-8 py-16 text-center sm:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(50% 120% at 50% 0%, rgba(255,101,0,0.14), transparent 60%)",
          }}
        />
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Comece com 1 atleta hoje.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          Sem cartão, sem fricção. Leve seu método para uma plataforma feita para decidir.
        </p>
        <Link
          href="/registrar"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-orange px-7 py-3.5 font-semibold text-onbrand transition-colors hover:bg-orange-hi"
        >
          Criar conta grátis
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- footer ---- */

function SiteFooter() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo wordmark={false} />
          <span className="text-sm text-muted">Inteligência para cada decisão.</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted">
          <Link href="/login" className="transition-colors hover:text-ink">
            Entrar
          </Link>
          <Link href="/registrar" className="transition-colors hover:text-ink">
            Criar conta
          </Link>
          <span className="text-faint">© {2026} ENKY</span>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------- icons ---- */
// SVG inline (24x24, stroke) — sem emoji, consistentes com o resto do produto.

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 17l5-6 4 4 4-7 5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CalendarGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BrainGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5a3 3 0 0 0-3 3M12 5a3 3 0 0 1 3 3M9 8a3 3 0 0 0-3 3 3 3 0 0 0 1 5 3 3 0 0 0 5 1M15 8a3 3 0 0 1 3 3 3 3 0 0 1-1 5 3 3 0 0 1-5 1M12 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ReportGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12v4M12 9v7M16 13v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function WhistleGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 11a5 5 0 0 1 5-5h9l2-2v6a6 6 0 1 1-11-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="13" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function RunnerGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="15" cy="5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 20l3-4 3 1 1-4-3-2 4-3 2 3h3M8 12l-1-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
