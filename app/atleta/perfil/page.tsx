"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import {
  DATE_FORMATS,
  LANGUAGES,
  NOTIFICATION_CATEGORIES,
  UNIT_SYSTEMS,
  type Preferences,
} from "@/modules/profile/profile-schema";

interface Profile {
  name: string;
  email: string;
  birthDate: string | null;
  gender: string | null;
  weightKg: number | null;
  heightCm: number | null;
  preferences: Preferences;
}

const TABS = [
  "Dados pessoais",
  "Preferências",
  "Notificações",
  "Privacidade",
  "Segurança",
  "Integrações",
  "App",
] as const;
type Tab = (typeof TABS)[number];

const SPORTS = ["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"] as const;
const SPORT_LABEL: Record<string, string> = {
  RUNNING: "Corrida",
  STRENGTH: "Força",
  FUNCTIONAL: "Funcional",
  CYCLING: "Ciclismo",
  SWIMMING: "Natação",
  TRIATHLON: "Triatlo",
};
const NOTIF_LABEL: Record<string, string> = {
  workoutPublished: "Treino publicado",
  workoutChanged: "Treino alterado",
  workoutReminder: "Lembrete de treino",
  coachMessage: "Mensagem do treinador",
  readinessCheckin: "Check-in de prontidão",
  feedbackPending: "Feedback pendente",
  payment: "Pagamento",
  contract: "Contrato",
  accountAlert: "Alerta da conta",
};

export default function AthleteProfilePage() {
  const { checked } = useRequireRole("ATHLETE");
  const [tab, setTab] = useState<Tab>("Dados pessoais");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ profile: Profile }>("/api/athlete/profile")
      .then((r) => setProfile(r.profile))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Sua conta</span>
          <h1 className={uiClasses.heading}>Perfil e configurações</h1>
        </header>

        <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Seções do perfil">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={tab === t}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "border-line-strong bg-surface text-ink"
                  : "border-line bg-petrol/70 text-muted hover:border-line-strong"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        {error && <p className={uiClasses.error}>{error}</p>}
        {loading || !profile ? (
          <p className="text-muted">Carregando...</p>
        ) : (
          <>
            {tab === "Dados pessoais" && <PersonalTab profile={profile} onSaved={setProfile} />}
            {tab === "Preferências" && <PreferencesTab profile={profile} onSaved={setProfile} />}
            {tab === "Notificações" && <NotificationsTab profile={profile} onSaved={setProfile} />}
            {tab === "Privacidade" && <PrivacyTab />}
            {tab === "Segurança" && <SecurityTab />}
            {tab === "Integrações" && <IntegrationsTab />}
            {tab === "App" && <InstallTab />}
          </>
        )}
      </div>
    </main>
  );
}

function useSaver(onSaved: (p: Profile) => void) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function save(body: unknown) {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const { profile } = await apiFetch<{ profile: Profile }>("/api/athlete/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved(profile);
      setMsg("Salvo.");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }
  return { save, saving, msg, err };
}

function PersonalTab({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const { save, saving, msg, err } = useSaver(onSaved);
  const [name, setName] = useState(profile.name);
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? "");
  const [gender, setGender] = useState(profile.gender ?? "");
  const [weightKg, setWeightKg] = useState(profile.weightKg != null ? String(profile.weightKg) : "");
  const [heightCm, setHeightCm] = useState(profile.heightCm != null ? String(profile.heightCm) : "");

  return (
    <section className="flex flex-col gap-3">
      <Field label="Nome">
        <input className={uiClasses.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </Field>
      <Field label="E-mail">
        <input className={uiClasses.input} value={profile.email} disabled />
      </Field>
      <p className="text-[11px] text-faint">
        Dados corporais abaixo são privados (só você e seu treinador vinculado). Não aparecem em perfil público.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nascimento">
          <input type="date" className={uiClasses.input} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Gênero">
          <input className={uiClasses.input} value={gender} onChange={(e) => setGender(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Peso (kg)">
          <input type="number" step="0.1" className={uiClasses.input} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </Field>
        <Field label="Altura (cm)">
          <input type="number" step="0.1" className={uiClasses.input} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
        </Field>
      </div>
      <p className="text-[11px] text-faint">Foto de perfil: em breve (depende de armazenamento de imagens).</p>
      <SaveBar
        saving={saving}
        msg={msg}
        err={err}
        onSave={() =>
          save({
            name,
            birthDate: birthDate || null,
            gender: gender || null,
            weightKg: weightKg ? Number(weightKg) : null,
            heightCm: heightCm ? Number(heightCm) : null,
          })
        }
      />
    </section>
  );
}

function PreferencesTab({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const { save, saving, msg, err } = useSaver(onSaved);
  const p = profile.preferences;
  const [units, setUnits] = useState(p.units ?? "METRIC");
  const [language, setLanguage] = useState(p.language ?? "pt-BR");
  const [dateFormat, setDateFormat] = useState(p.dateFormat ?? "DMY");
  const [timezone, setTimezone] = useState(p.timezone ?? "America/Sao_Paulo");
  const [sports, setSports] = useState<string[]>(p.sports ?? []);

  function toggleSport(s: string) {
    setSports((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unidades">
          <select className={uiClasses.select} value={units} onChange={(e) => setUnits(e.target.value as typeof units)}>
            {UNIT_SYSTEMS.map((u) => (
              <option key={u} value={u}>
                {u === "METRIC" ? "Métrico (kg, km)" : "Imperial (lb, mi)"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Idioma">
          <select className={uiClasses.select} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Formato de data">
          <select className={uiClasses.select} value={dateFormat} onChange={(e) => setDateFormat(e.target.value as typeof dateFormat)}>
            {DATE_FORMATS.map((d) => (
              <option key={d} value={d}>
                {d === "DMY" ? "DD/MM/AAAA" : d === "MDY" ? "MM/DD/AAAA" : "AAAA-MM-DD"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fuso horário">
          <input className={uiClasses.input} value={timezone} onChange={(e) => setTimezone(e.target.value)} maxLength={64} />
        </Field>
      </div>
      <Field label="Esportes de interesse">
        <div className="flex flex-wrap gap-1.5">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSport(s)}
              aria-pressed={sports.includes(s)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                sports.includes(s) ? "border-line-strong bg-surface text-ink" : "border-line text-muted"
              }`}
            >
              {SPORT_LABEL[s]}
            </button>
          ))}
        </div>
      </Field>
      <SaveBar
        saving={saving}
        msg={msg}
        err={err}
        onSave={() => save({ preferences: { ...p, units, language, dateFormat, timezone, sports } })}
      />
    </section>
  );
}

function NotificationsTab({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const { save, saving, msg, err } = useSaver(onSaved);
  const initial = profile.preferences.notifications ?? {};
  const [notifs, setNotifs] = useState<Record<string, boolean>>(initial);

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted">Escolha o que você quer receber. Alertas críticos da conta são sempre enviados.</p>
      {NOTIFICATION_CATEGORIES.map((c) => (
        <label key={c} className="flex items-center justify-between rounded-lg border border-line bg-petrol/70 px-3 py-2">
          <span className="text-sm text-ink">{NOTIF_LABEL[c]}</span>
          <input
            type="checkbox"
            checked={notifs[c] ?? c === "accountAlert"}
            disabled={c === "accountAlert"}
            onChange={(e) => setNotifs((n) => ({ ...n, [c]: e.target.checked }))}
          />
        </label>
      ))}
      <SaveBar
        saving={saving}
        msg={msg}
        err={err}
        onSave={() => save({ preferences: { ...profile.preferences, notifications: notifs } })}
      />
    </section>
  );
}

function PrivacyTab() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(kind: "EXPORT" | "DELETE") {
    if (kind === "DELETE" && !confirm("Solicitar exclusão da conta? Um operador processará o pedido. Esta ação é irreversível após confirmada.")) {
      return;
    }
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const body = kind === "DELETE" ? { kind, confirm: true } : { kind };
      await apiFetch("/api/athlete/privacy", { method: "POST", body: JSON.stringify(body) });
      setMsg(kind === "EXPORT" ? "Solicitação de exportação registrada." : "Solicitação de exclusão registrada.");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Erro ao solicitar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {msg && <p className="text-sm text-turq">{msg}</p>}
      {err && <p className={uiClasses.error}>{err}</p>}
      <div className="rounded-xl border border-line bg-petrol/70 p-4">
        <p className="font-medium text-ink">Exportar meus dados</p>
        <p className="mb-3 text-xs text-muted">Receba uma cópia dos seus dados (LGPD). Processado pela equipe.</p>
        <button type="button" className={uiClasses.buttonSecondary} disabled={busy} onClick={() => request("EXPORT")}>
          Solicitar exportação
        </button>
      </div>
      <div className="rounded-xl border border-danger/40 bg-petrol/70 p-4">
        <p className="font-medium text-ink">Excluir minha conta</p>
        <p className="mb-3 text-xs text-muted">Solicita a remoção da sua conta e dados pessoais. Irreversível após processada.</p>
        <button type="button" className={uiClasses.buttonDanger} disabled={busy} onClick={() => request("DELETE")}>
          Solicitar exclusão
        </button>
      </div>
    </section>
  );
}

interface SessionItem {
  id: string;
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

function SecurityTab() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const { sessions } = await apiFetch<{ sessions: SessionItem[] }>("/api/auth/sessions");
      setSessions(sessions);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Erro ao carregar sessões.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function revokeOthers() {
    if (!confirm("Encerrar todas as outras sessões? Você continuará conectado neste dispositivo.")) return;
    setMsg(null);
    setErr(null);
    try {
      const { revoked } = await apiFetch<{ revoked: number }>("/api/auth/sessions", { method: "DELETE" });
      setMsg(`${revoked} sessão(ões) encerrada(s).`);
      void load();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Erro ao encerrar sessões.");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {msg && <p className="text-sm text-turq">{msg}</p>}
      {err && <p className={uiClasses.error}>{err}</p>}
      <div className="flex flex-col gap-2">
        <p className={uiClasses.label}>Sessões ativas</p>
        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-line bg-petrol/70 px-3 py-2 text-xs">
              <span className="truncate text-ink">{s.userAgent ?? "Dispositivo desconhecido"}</span>
              {s.current ? (
                <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-turq">este</span>
              ) : (
                <span className="shrink-0 text-faint">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
          ))
        )}
      </div>
      <button type="button" className={uiClasses.buttonSecondary} onClick={revokeOthers}>
        Encerrar outras sessões
      </button>
      <div className="rounded-xl border border-line bg-petrol/70 p-4">
        <p className="font-medium text-ink">Senha</p>
        <p className="mb-3 text-xs text-muted">A troca de senha é feita pelo fluxo de redefinição por e-mail.</p>
        <Link href="/recuperar-senha" className={uiClasses.buttonSecondary}>
          Redefinir senha
        </Link>
      </div>
    </section>
  );
}

function IntegrationsTab() {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted">Conecte seus dispositivos e apps de treino.</p>
      <Link
        href="/atleta/integracoes"
        className="flex items-center justify-between rounded-xl border border-line bg-petrol/70 p-4 hover:border-line-strong"
      >
        <div>
          <p className="font-medium text-ink">Strava e wearables</p>
          <p className="text-xs text-muted">Conectar, importar atividades e desconectar</p>
        </div>
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

function InstallTab() {
  return (
    <section className="flex flex-col gap-3 text-sm text-muted">
      <p className="text-ink">Instale o ENKY na tela inicial para acesso rápido e uso offline.</p>
      <div className="rounded-xl border border-line bg-petrol/70 p-4">
        <p className="font-medium text-ink">iPhone / iPad (Safari)</p>
        <p className="text-xs">Toque em Compartilhar → “Adicionar à Tela de Início”.</p>
      </div>
      <div className="rounded-xl border border-line bg-petrol/70 p-4">
        <p className="font-medium text-ink">Android (Chrome)</p>
        <p className="text-xs">Menu ⋮ → “Instalar aplicativo” ou “Adicionar à tela inicial”.</p>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={uiClasses.label}>{label}</span>
      {children}
    </label>
  );
}

function SaveBar({
  saving,
  msg,
  err,
  onSave,
}: {
  saving: boolean;
  msg: string | null;
  err: string | null;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={uiClasses.button} onClick={onSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
      {msg && <span className="text-sm text-turq">{msg}</span>}
      {err && <span className={uiClasses.error}>{err}</span>}
    </div>
  );
}
