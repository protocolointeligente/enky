"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { MODALITY_LABELS, modalityLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Field, Overlay } from "../_components";

// Grupos/turmas da assessoria (Etapa 4 §20). Cards + criar/editar + drawer de
// composição (adicionar/remover atletas). Treino/periodização para o grupo: futuro.

interface Coach {
  id: string;
  user: { name: string } | null;
}
interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  modality: string | null;
  level: string | null;
  status: string;
  coach: Coach | null;
  _count: { members: number };
}
interface Member {
  id: string;
  athlete: { id: string; user: { name: string } | null };
}
interface GroupDetail extends Omit<GroupRow, "_count"> {
  coachId: string | null;
  members: Member[];
}
interface TrainerOpt {
  trainerProfileId: string | null;
  name: string;
}
interface RosterEntry {
  athleteProfileId: string;
  name: string | null;
}

export default function GroupsPage() {
  const { checked } = useRequireRole("TRAINER");
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<GroupDetail | "new" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ groups: GroupRow[] }>("/api/trainer/groups")
      .then((d) => setGroups(d.groups))
      .catch((e: ApiClientError) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (checked) load();
  }, [checked, load]);

  if (!checked) return null;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className={uiClasses.eyebrow}>Gestão · Grupos</p>
            <h1 className={uiClasses.heading}>Grupos</h1>
          </div>
          <button type="button" className={uiClasses.button} onClick={() => setEditing("new")}>
            Novo grupo
          </button>
        </header>

        <ErrorNotice error={error} />
        {loading ? (
          <p className={uiClasses.hint}>Carregando…</p>
        ) : groups.length === 0 ? (
          <p className={uiClasses.hint}>Nenhum grupo ainda. Crie a primeira turma.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <section
                key={g.id}
                className={`${uiClasses.card} flex cursor-pointer flex-col gap-2 hover:border-line-strong ${
                  g.status === "ARCHIVED" ? "opacity-60" : ""
                }`}
                onClick={() => setOpenId(g.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className={uiClasses.subheading}>{g.name}</h2>
                  {g.status === "ARCHIVED" ? (
                    <span className={`${uiClasses.badge} bg-surface text-faint`}>Arquivado</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1 text-xs">
                  {g.modality ? <span className={`${uiClasses.badge} bg-surface`}>{modalityLabel(g.modality)}</span> : null}
                  {g.level ? <span className={`${uiClasses.badge} bg-surface`}>{g.level}</span> : null}
                </div>
                <p className={uiClasses.hint}>
                  {g._count.members} atleta(s)
                  {g.coach?.user ? ` · ${g.coach.user.name}` : ""}
                </p>
              </section>
            ))}
          </div>
        )}
      </div>

      {editing ? (
        <GroupForm
          group={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {openId ? (
        <GroupDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onEdit={(g) => {
            setOpenId(null);
            setEditing(g);
          }}
          onChanged={load}
        />
      ) : null}
    </main>
  );
}

function GroupForm({ group, onClose, onSaved }: { group?: GroupDetail; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [modality, setModality] = useState(group?.modality ?? "");
  const [level, setLevel] = useState(group?.level ?? "");
  const [coachId, setCoachId] = useState(group?.coachId ?? "");
  const [status, setStatus] = useState(group?.status ?? "ACTIVE");
  const [trainers, setTrainers] = useState<TrainerOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ trainers: TrainerOpt[] }>("/api/trainer/team")
      .then((d) => setTrainers(d.trainers.filter((t) => t.trainerProfileId)))
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    const body = JSON.stringify({
      name,
      description: description.trim() || null,
      modality: modality || null,
      level: level.trim() || null,
      coachId: coachId || null,
      ...(group ? { status } : {}),
    });
    try {
      if (group) await apiFetch(`/api/trainer/groups/${group.id}`, { method: "PATCH", body });
      else await apiFetch("/api/trainer/groups", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao salvar grupo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className={uiClasses.subheading}>{group ? "Editar grupo" : "Novo grupo"}</h2>
      {error ? <p className={uiClasses.error}>{error}</p> : null}
      <div className="flex flex-col gap-3">
        <Field label="Nome *">
          <input className={uiClasses.input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descrição">
          <textarea className={uiClasses.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modalidade">
            <select className={uiClasses.select} value={modality} onChange={(e) => setModality(e.target.value)}>
              <option value="">—</option>
              {Object.entries(MODALITY_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nível">
            <input className={uiClasses.input} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Iniciante, Avançado…" />
          </Field>
        </div>
        <Field label="Treinador responsável">
          <select className={uiClasses.select} value={coachId} onChange={(e) => setCoachId(e.target.value)}>
            <option value="">—</option>
            {trainers.map((t) => (
              <option key={t.trainerProfileId!} value={t.trainerProfileId!}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        {group ? (
          <Field label="Status">
            <select className={uiClasses.select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Ativo</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
          </Field>
        ) : null}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={uiClasses.buttonSecondary} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className={uiClasses.button} disabled={busy || !name.trim()} onClick={submit}>
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Overlay>
  );
}

function GroupDrawer({
  id,
  onClose,
  onEdit,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onEdit: (g: GroupDetail) => void;
  onChanged: () => void;
}) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [toAdd, setToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ group: GroupDetail }>(`/api/trainer/groups/${id}`)
      .then((d) => setGroup(d.group))
      .catch((e: ApiClientError) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
    apiFetch<{ athletes: RosterEntry[] }>("/api/trainer/athletes/roster")
      .then((d) => setRoster(d.athletes))
      .catch(() => {});
  }, [load]);

  async function addMember() {
    if (!toAdd) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/trainer/groups/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ athleteIds: [toAdd] }),
      });
      setToAdd("");
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(athleteId: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/trainer/groups/${id}/members/${athleteId}`, { method: "DELETE" });
      load();
      onChanged();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Erro ao remover.");
    } finally {
      setBusy(false);
    }
  }

  const memberIds = new Set(group?.members.map((m) => m.athlete.id));
  const available = roster.filter((r) => !memberIds.has(r.athleteProfileId));

  return (
    <Overlay onClose={onClose} side>
      {!group ? (
        <p className={uiClasses.hint}>Carregando…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className={uiClasses.subheading}>{group.name}</h2>
            <button type="button" className={uiClasses.buttonSecondary} onClick={() => onEdit(group)}>
              Editar
            </button>
          </div>
          {group.description ? <p className="text-sm text-muted">{group.description}</p> : null}
          {error ? <p className={uiClasses.error}>{error}</p> : null}

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Adicionar atleta</span>
            <div className="flex gap-2">
              <select className={uiClasses.select} value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                <option value="">Selecione…</option>
                {available.map((a) => (
                  <option key={a.athleteProfileId} value={a.athleteProfileId}>
                    {a.name ?? "Atleta"}
                  </option>
                ))}
              </select>
              <button type="button" className={uiClasses.button} disabled={busy || !toAdd} onClick={addMember}>
                Adicionar
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <span className={uiClasses.label}>Atletas ({group.members.length})</span>
            {group.members.length === 0 ? (
              <p className={uiClasses.hint}>Nenhum atleta no grupo.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {group.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <span className="text-ink">{m.athlete.user?.name ?? "Atleta"}</span>
                    <button
                      type="button"
                      className="text-xs text-danger hover:underline"
                      disabled={busy}
                      onClick={() => removeMember(m.athlete.id)}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}
