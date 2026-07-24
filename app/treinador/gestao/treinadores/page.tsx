"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { ORG_ROLE_LABELS, ORG_ROLES } from "@/modules/organizations/org-roles";
import { Field, Overlay } from "../_components";

// Gestão de treinadores e carteiras (Etapa 4 §18–19). Lista membros existentes
// (papel/status/carteira) + atribuir/transferir atletas. Convite de treinador
// NOVO fica para o trabalho de multi-org (ADR-001) — ver módulo coach-team.

const ASSIGNABLE_ROLES = ORG_ROLES.filter((r) => r !== "OWNER");
const CARTEIRA_ROLE_LABELS: Record<string, string> = {
  PRIMARY: "Titular",
  ASSISTANT: "Assistente",
  TEMPORARY: "Temporário",
  VIEW_ONLY: "Somente leitura",
};

interface Trainer {
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  trainerProfileId: string | null;
  activeAthletes: number;
}
interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
}

export default function TrainersPage() {
  const { checked } = useRequireRole("TRAINER");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<"assign" | "transfer" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ trainers: Trainer[] }>("/api/trainer/team")
      .then((d) => setTrainers(d.trainers))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!checked) return;
    load();
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster")
      .then((d) => setRoster(d.athletes))
      .catch(() => {});
  }, [checked, load]);

  async function changeRole(userId: string, role: string) {
    setBusy(userId);
    setError(null);
    try {
      await apiFetch("/api/trainer/team/role", { method: "PATCH", body: JSON.stringify({ userId, role }) });
      load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(t: Trainer) {
    setBusy(t.userId);
    setError(null);
    try {
      await apiFetch("/api/trainer/team/active", {
        method: "PATCH",
        body: JSON.stringify({ userId: t.userId, isActive: !t.isActive }),
      });
      load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const withProfile = trainers.filter((t) => t.trainerProfileId);

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão · Treinadores</p>
            <h1 className={uiClasses.heading}>Treinadores</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" className={uiClasses.buttonSecondary} onClick={() => setModal("assign")}>
              Atribuir atleta
            </button>
            <button type="button" className={uiClasses.buttonSecondary} onClick={() => setModal("transfer")}>
              Transferir atleta
            </button>
          </div>
        </header>

        <p className={uiClasses.hint}>
          Convidar um treinador novo depende do suporte a múltiplas organizações (em desenvolvimento).
          Aqui você gerencia os membros atuais e as carteiras.
        </p>

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : (
          <div className={`${uiClasses.panel} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-faint">
                  <th className="px-4 py-2 font-medium">Membro</th>
                  <th className="px-4 py-2 font-medium">Papel</th>
                  <th className="px-4 py-2 font-medium">Carteira</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {trainers.map((t) => {
                  const isOwner = t.role === "OWNER";
                  return (
                    <tr key={t.userId} className="border-b border-line/50">
                      <td className="px-4 py-2">
                        <span className="font-medium text-ink">{t.name}</span>
                        <span className="block text-xs text-faint">{t.email}</span>
                      </td>
                      <td className="px-4 py-2">
                        {isOwner ? (
                          <span className={`${uiClasses.badge} bg-electric/15 text-electric-hi`}>Proprietário</span>
                        ) : (
                          <select
                            className={uiClasses.select}
                            value={t.role}
                            disabled={busy === t.userId}
                            onChange={(e) => changeRole(t.userId, e.target.value)}
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ORG_ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted">{t.activeAthletes} atleta(s)</td>
                      <td className="px-4 py-2">
                        <span className={`${uiClasses.badge} ${t.isActive ? "bg-turq/15 text-turq" : "bg-surface text-faint"}`}>
                          {t.isActive ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isOwner ? null : (
                          <button
                            type="button"
                            className="text-xs text-muted hover:text-ink"
                            disabled={busy === t.userId}
                            onClick={() => toggleActive(t)}
                          >
                            {t.isActive ? "Desativar" : "Ativar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "assign" ? (
        <AssignModal trainers={withProfile} roster={roster} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      ) : null}
      {modal === "transfer" ? (
        <TransferModal trainers={withProfile} roster={roster} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />
      ) : null}
    </main>
  );
}

function AssignModal({
  trainers,
  roster,
  onClose,
  onDone,
}: {
  trainers: Trainer[];
  roster: RosterEntry[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [trainerId, setTrainerId] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [role, setRole] = useState("PRIMARY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/team/assign", {
        method: "POST",
        body: JSON.stringify({ trainerId, athleteId, role }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao atribuir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Atribuir atleta</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Treinador">
          <select className={uiClasses.select} value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
            <option value="">Selecione…</option>
            {trainers.map((t) => (
              <option key={t.trainerProfileId!} value={t.trainerProfileId!}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Atleta">
          <select className={uiClasses.select} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">Selecione…</option>
            {roster.map((a) => (
              <option key={a.athleteProfileId} value={a.athleteProfileId}>
                {a.name ?? "Atleta"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Papel na carteira">
          <select className={uiClasses.select} value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(CARTEIRA_ROLE_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={uiClasses.button} disabled={busy || !trainerId || !athleteId} onClick={submit}>
          {busy ? "Atribuindo…" : "Atribuir"}
        </button>
      </div>
    </Overlay>
  );
}

function TransferModal({
  trainers,
  roster,
  onClose,
  onDone,
}: {
  trainers: Trainer[];
  roster: RosterEntry[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [athleteId, setAthleteId] = useState("");
  const [fromTrainerId, setFromTrainerId] = useState("");
  const [toTrainerId, setToTrainerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/trainer/team/transfer", {
        method: "POST",
        body: JSON.stringify({ athleteId, fromTrainerId, toTrainerId }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao transferir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>Transferir atleta</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Atleta">
          <select className={uiClasses.select} value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">Selecione…</option>
            {roster.map((a) => (
              <option key={a.athleteProfileId} value={a.athleteProfileId}>
                {a.name ?? "Atleta"}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De">
            <select className={uiClasses.select} value={fromTrainerId} onChange={(e) => setFromTrainerId(e.target.value)}>
              <option value="">…</option>
              {trainers.map((t) => (
                <option key={t.trainerProfileId!} value={t.trainerProfileId!}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Para">
            <select className={uiClasses.select} value={toTrainerId} onChange={(e) => setToTrainerId(e.target.value)}>
              <option value="">…</option>
              {trainers.map((t) => (
                <option key={t.trainerProfileId!} value={t.trainerProfileId!}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className={uiClasses.button}
          disabled={busy || !athleteId || !fromTrainerId || !toTrainerId}
          onClick={submit}
        >
          {busy ? "Transferindo…" : "Transferir"}
        </button>
      </div>
    </Overlay>
  );
}
