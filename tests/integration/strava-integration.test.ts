import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { createWorkoutDraft } from "@/modules/workouts/create-workout-draft";
import { publishWorkout } from "@/modules/workouts/publish-workout";
import type {
  ActivityProvider,
  ActivityWebhookEvent,
  NormalizedActivity,
  OAuthTokens,
} from "@/modules/integrations/activity-provider";
import { ProviderAuthorizationError } from "@/modules/integrations/activity-provider";
import {
  connectProvider,
  disconnectProvider,
  getConnection,
} from "@/modules/integrations/external-connection";
import { importActivity, importRecentActivities } from "@/modules/integrations/import-activities";
import { getPlannedVsActual } from "@/modules/integrations/planned-vs-actual";
import { handleStravaWebhook } from "@/modules/integrations/strava-webhook-service";
import { uniqueEmail } from "./helpers";

// Fase 11 — Integração Strava, contra o banco real.
//
// O provedor é um DUPLO: o Strava real não é chamado. O que está sob teste é o
// que nós construímos — deduplicação, vínculo, cifra dos tokens, revogação,
// idempotência do webhook. Bater na API deles tornaria a suíte dependente de
// rede, cota e de um atleta de verdade com atividades de verdade.

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];
const createdWebhookEventIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

// Cada cenário usa uma conta Strava PRÓPRIA. Não é detalhe de fixture: o índice
// `uq_active_external_connection_provider_athlete` só permite uma conexão ativa
// por conta do provedor, e dois atletas de teste compartilhando "98765"
// colidiriam — corretamente. Na vida real, duas pessoas têm duas contas.
let stravaAccountSeq = 0;
function nextStravaAthleteId(): string {
  stravaAccountSeq += 1;
  return String(90000000 + stravaAccountSeq);
}

// Duplo do provedor. Guarda o que foi pedido para as asserções e devolve o que
// o cenário mandar.
class FakeStravaProvider implements ActivityProvider {
  readonly name = "strava";
  readonly providerEnum = "STRAVA" as const;

  activities: NormalizedActivity[] = [];
  deauthorizeCalls = 0;
  refreshCalls = 0;
  deauthorizeShouldFail = false;
  refreshShouldFail = false;
  // Conta Strava que este duplo representa — atribuída pelo cenário.
  providerAthleteId = "0";

  buildAuthorizationUrl(state: string): string {
    return `https://www.strava.com/oauth/authorize?state=${state}`;
  }
  async exchangeCode(): Promise<OAuthTokens> {
    return tokens(this.providerAthleteId);
  }
  async refreshTokens(): Promise<OAuthTokens> {
    this.refreshCalls += 1;
    if (this.refreshShouldFail) throw new ProviderAuthorizationError("token revogado");
    return tokens(this.providerAthleteId);
  }
  async listActivities(): Promise<NormalizedActivity[]> {
    return this.activities;
  }
  async getActivity(_token: string, id: string): Promise<NormalizedActivity | null> {
    return this.activities.find((a) => a.providerActivityId === id) ?? null;
  }
  async deauthorize(): Promise<void> {
    this.deauthorizeCalls += 1;
    if (this.deauthorizeShouldFail) throw new Error("Strava fora do ar");
  }
  verifySubscription(): string | null {
    return null;
  }
  parseWebhookEvent(rawBody: string): ActivityWebhookEvent | null {
    return JSON.parse(rawBody) as ActivityWebhookEvent;
  }
}

function tokens(providerAthleteId: string, overrides: Partial<OAuthTokens> = {}): OAuthTokens {
  return {
    accessToken: "access-token-do-strava-abc123",
    refreshToken: "refresh-token-do-strava-xyz789",
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    scope: "read,activity:read_all",
    providerAthleteId,
    ...overrides,
  };
}

interface Scope {
  uid: string;
  connectionId: string;
  organizationId: string;
  athleteProfileId: string;
  providerAthleteId: string;
}

// Atividade pertencente ao dono da conexão do cenário.
//
// O `uid` no id da atividade não é decoração: `uq_external_activity_provider_
// activity` é global por provedor e a suíte compartilha o banco — dois cenários
// usando "14204512345" fariam um enxergar a atividade do outro. Chamar duas
// vezes com o mesmo `providerActivityId` lógico produz o MESMO id (é assim que
// os testes de deduplicação reimportam a mesma atividade).
function activityFor(
  scope: Scope,
  overrides: Partial<NormalizedActivity> = {},
): NormalizedActivity {
  const { providerActivityId, providerAthleteId, ...rest } = overrides;
  return {
    providerActivityId: `${scope.uid}-${providerActivityId ?? "principal"}`,
    providerAthleteId: providerAthleteId ?? scope.providerAthleteId,
    name: "Rodagem matinal",
    rawType: "Run",
    modality: "RUNNING",
    startedAt: new Date("2026-07-16T09:30:00Z"),
    localDate: "2026-07-16",
    timezone: "(GMT-03:00) America/Sao_Paulo",
    distanceMeters: 10000,
    movingSeconds: 3000,
    elapsedSeconds: 3120,
    elevationGainMeters: 85,
    paceSecondsPerKm: 300,
    ...rest,
  };
}

async function newTrainer(prefix: string) {
  const result = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(result.userId);
  createdOrganizationIds.push(result.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: result.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);
  return { ...result, trainerProfileId: trainerProfile.id };
}

async function newActiveAthlete(trainer: {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
}) {
  const invitation = await inviteAthlete(
    { email: uniqueEmail("strava-athlete") },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: "Atleta Strava",
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);
  return { athleteProfileId: invitation.athleteProfileId, userId: activation.userId };
}

async function newPublishedWorkout(
  trainer: { userId: string; organizationId: string; trainerProfileId: string },
  athleteProfileId: string,
  overrides: { title?: string; modality?: "RUNNING" | "SWIMMING"; plannedDate?: string } = {},
) {
  const actor = {
    userId: trainer.userId,
    trainerProfileId: trainer.trainerProfileId,
    organizationId: trainer.organizationId,
  };
  const draft = await createWorkoutDraft(
    {
      athleteId: athleteProfileId,
      title: overrides.title ?? "Rodagem 10km",
      modality: overrides.modality ?? "RUNNING",
      plannedDate: overrides.plannedDate ?? "2026-07-16",
      timezone: "America/Sao_Paulo",
      // Publicar exige conteúdo (regra da 02C) — o vínculo é por data e
      // modalidade, então o bloco em si é irrelevante aqui, mas precisa existir.
      blocks: [
        {
          repetitions: 1,
          steps: [{ stepType: "RODAGEM" as const, durationSeconds: 3000, distanceMeters: 10000 }],
          exercises: [],
        },
      ],
    },
    actor,
  );
  await publishWorkout(draft.id, actor);
  return draft;
}

async function connectedScope(prefix: string, provider: FakeStravaProvider) {
  const trainer = await newTrainer(prefix);
  const athlete = await newActiveAthlete(trainer);
  const providerAthleteId = nextStravaAthleteId();
  provider.providerAthleteId = providerAthleteId;
  const context = {
    userId: athlete.userId,
    organizationId: trainer.organizationId,
    athleteProfileId: athlete.athleteProfileId,
  };
  await connectProvider(provider, tokens(providerAthleteId), context);
  const connection = await prisma.externalConnection.findUniqueOrThrow({
    where: { athleteId_provider: { athleteId: athlete.athleteProfileId, provider: "STRAVA" } },
  });
  const scope: Scope = {
    uid: randomUUID(),
    connectionId: connection.id,
    organizationId: trainer.organizationId,
    athleteProfileId: athlete.athleteProfileId,
    providerAthleteId,
  };
  return { trainer, athlete, context, providerAthleteId, scope };
}

describe("Fase 11 — conexão e tokens", () => {
  it("conecta o atleta e NUNCA grava o token em claro", async () => {
    const provider = new FakeStravaProvider();
    const { athlete, providerAthleteId } = await connectedScope("strava-connect", provider);

    const row = await prisma.externalConnection.findUniqueOrThrow({
      where: { athleteId_provider: { athleteId: athlete.athleteProfileId, provider: "STRAVA" } },
    });

    // A garantia que justifica a cifra: um dump da tabela não entrega acesso.
    expect(row.accessToken).not.toBe("access-token-do-strava-abc123");
    expect(row.refreshToken).not.toBe("refresh-token-do-strava-xyz789");
    expect(row.accessToken).toContain("v1.");
    expect(row.status).toBe("ACTIVE");
    expect(row.providerAthleteId).toBe(providerAthleteId);
  });

  it("não expõe token nenhum na visão que sai do módulo", async () => {
    const provider = new FakeStravaProvider();
    const { athlete } = await connectedScope("strava-view", provider);

    const view = await getConnection(athlete.athleteProfileId);
    expect(view).not.toBeNull();
    // O tipo já impede — isto trava contra alguém alargar o ConnectionView.
    expect(JSON.stringify(view)).not.toContain("access-token");
    expect(JSON.stringify(view)).not.toContain("refresh-token");
  });

  it("reconectar reaproveita a linha em vez de acumular conexões", async () => {
    const provider = new FakeStravaProvider();
    const { context, athlete, providerAthleteId } = await connectedScope("strava-recon", provider);

    await disconnectProvider("STRAVA", provider, context);
    await connectProvider(provider, tokens(providerAthleteId), context);

    const rows = await prisma.externalConnection.findMany({
      where: { athleteId: athlete.athleteProfileId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("ACTIVE");
    expect(rows[0]!.revokedAt).toBeNull();
  });

  it("recusa conectar a mesma conta Strava a um segundo atleta", async () => {
    const provider = new FakeStravaProvider();
    const first = await connectedScope("strava-dup-a", provider);

    // Segundo atleta em OUTRA organização: o plano grátis permite 1 atleta por
    // treinador, e o que está sob teste aqui é a conta do provedor, não o
    // limite do plano. Também é o caso mais forte — a colisão precisa valer
    // entre tenants, não só dentro de um.
    const otherTrainer = await newTrainer("strava-dup-b");
    const otherAthlete = await newActiveAthlete(otherTrainer);

    // Mesma conta do Strava (mesmo providerAthleteId): resolver o `owner_id` de
    // um webhook viraria ambíguo, então a segunda conexão é recusada.
    await expect(
      connectProvider(provider, tokens(first.providerAthleteId), {
        userId: otherAthlete.userId,
        organizationId: otherTrainer.organizationId,
        athleteProfileId: otherAthlete.athleteProfileId,
      }),
    ).rejects.toThrow(/já está conectada a outro atleta/i);
  });
});

describe("Fase 11 — revogação (atleta pode revogar acesso)", () => {
  it("desconecta, apaga os tokens e revoga no provedor", async () => {
    const provider = new FakeStravaProvider();
    const { context, athlete } = await connectedScope("strava-disc", provider);

    await disconnectProvider("STRAVA", provider, context);

    const row = await prisma.externalConnection.findUniqueOrThrow({
      where: { athleteId_provider: { athleteId: athlete.athleteProfileId, provider: "STRAVA" } },
    });
    expect(row.status).toBe("REVOKED");
    expect(row.accessToken).toBeNull();
    expect(row.refreshToken).toBeNull();
    expect(row.revokedAt).not.toBeNull();
    expect(provider.deauthorizeCalls).toBe(1);
    expect(await getConnection(athlete.athleteProfileId)).toBeNull();
  });

  // A regra: a revogação local NÃO pode depender de um terceiro estar no ar.
  // Se dependesse, o atleta ficaria preso a uma integração que ele pediu para
  // encerrar.
  it("desconecta localmente mesmo quando o Strava falha ao revogar", async () => {
    const provider = new FakeStravaProvider();
    provider.deauthorizeShouldFail = true;
    const { context, athlete } = await connectedScope("strava-disc-fail", provider);

    await expect(disconnectProvider("STRAVA", provider, context)).resolves.toBeUndefined();

    const row = await prisma.externalConnection.findUniqueOrThrow({
      where: { athleteId_provider: { athleteId: athlete.athleteProfileId, provider: "STRAVA" } },
    });
    expect(row.status).toBe("REVOKED");
    expect(row.accessToken).toBeNull();
  });

  // Revogar é direito do atleta e não pode depender de uma variável de ambiente
  // do servidor: se a instalação perdeu a credencial do Strava (rotação de um
  // segredo vazado, por exemplo), o atleta ficaria preso a uma integração que
  // mandou encerrar.
  it("desconecta mesmo sem credencial do provedor configurada", async () => {
    const provider = new FakeStravaProvider();
    const { context, athlete } = await connectedScope("strava-disc-semcred", provider);

    await disconnectProvider("STRAVA", null, context);

    const row = await prisma.externalConnection.findUniqueOrThrow({
      where: { athleteId_provider: { athleteId: athlete.athleteProfileId, provider: "STRAVA" } },
    });
    expect(row.status).toBe("REVOKED");
    expect(row.accessToken).toBeNull();
    expect(row.refreshToken).toBeNull();
    // Sem provedor não há a quem pedir revogação remota — e tudo bem.
    expect(provider.deauthorizeCalls).toBe(0);
  });

  // Atividades são histórico de treino, não "dados do Strava".
  it("preserva as atividades já importadas ao desconectar", async () => {
    const provider = new FakeStravaProvider();
    const { context, scope, athlete } = await connectedScope("strava-disc-keep", provider);

    await importActivity(scope, activityFor(scope));
    await disconnectProvider("STRAVA", provider, context);

    const kept = await prisma.externalActivity.findMany({
      where: { athleteId: athlete.athleteProfileId },
    });
    expect(kept).toHaveLength(1);
  });
});

describe("Fase 11 — importação e deduplicação", () => {
  it("importa uma atividade normalizada", async () => {
    const provider = new FakeStravaProvider();
    const { scope } = await connectedScope("strava-imp", provider);

    const result = await importActivity(scope, activityFor(scope));
    expect(result.outcome).toBe("imported");

    const row = await prisma.externalActivity.findUniqueOrThrow({
      where: { id: result.activityId! },
    });
    expect(row.distanceMeters).toBe(10000);
    expect(row.movingSeconds).toBe(3000);
    expect(row.elevationGainMeters).toBe(85);
    expect(row.paceSecondsPerKm).toBe(300);
    expect(row.modality).toBe("RUNNING");
    expect(row.localDate.toISOString().slice(0, 10)).toBe("2026-07-16");
  });

  // A regra da fase: "importação duplicada não duplica atividade".
  it("importar a mesma atividade duas vezes não duplica", async () => {
    const provider = new FakeStravaProvider();
    const { scope, athlete } = await connectedScope("strava-dedup", provider);

    await importActivity(scope, activityFor(scope));
    const second = await importActivity(scope, activityFor(scope));

    expect(second.outcome).toBe("updated");
    const rows = await prisma.externalActivity.findMany({
      where: { athleteId: athlete.athleteProfileId },
    });
    expect(rows).toHaveLength(1);
  });

  // O caso real: o webhook e o botão de importar trazem a mesma atividade ao
  // mesmo tempo. Quem garante a linha única é o índice, não um SELECT prévio.
  it("não duplica sob importação concorrente da mesma atividade", async () => {
    const provider = new FakeStravaProvider();
    const { scope, athlete } = await connectedScope("strava-race", provider);

    await Promise.all([
      importActivity(scope, activityFor(scope)),
      importActivity(scope, activityFor(scope)),
      importActivity(scope, activityFor(scope)),
    ]);

    const rows = await prisma.externalActivity.findMany({
      where: { athleteId: athlete.athleteProfileId },
    });
    expect(rows).toHaveLength(1);
  });

  it("atualiza os dados quando o atleta corrige a atividade no Strava", async () => {
    const provider = new FakeStravaProvider();
    const { scope } = await connectedScope("strava-upd", provider);

    await importActivity(scope, activityFor(scope));
    const updated = await importActivity(
      scope,
      activityFor(scope, { name: "Título corrigido", distanceMeters: 12000 }),
    );

    const row = await prisma.externalActivity.findUniqueOrThrow({
      where: { id: updated.activityId! },
    });
    expect(row.name).toBe("Título corrigido");
    expect(row.distanceMeters).toBe(12000);
  });

  // Sem isso, um provedor confuso (ou um evento forjado) enxertaria atividade
  // de um estranho no histórico do atleta.
  it("recusa atividade cujo dono no provedor não é o dono da conexão", async () => {
    const provider = new FakeStravaProvider();
    const { scope, athlete } = await connectedScope("strava-owner", provider);

    const result = await importActivity(scope, activityFor(scope, { providerAthleteId: "999999" }));

    expect(result.outcome).toBe("skipped");
    expect(
      await prisma.externalActivity.count({ where: { athleteId: athlete.athleteProfileId } }),
    ).toBe(0);
  });

  it("importa em lote e marca a última sincronização", async () => {
    const provider = new FakeStravaProvider();
    const { scope } = await connectedScope("strava-lote", provider);
    provider.activities = [
      activityFor(scope, { providerActivityId: "1" }),
      activityFor(scope, { providerActivityId: "2", localDate: "2026-07-15" }),
      activityFor(scope, { providerActivityId: "3", localDate: "2026-07-14" }),
    ];

    const summary = await importRecentActivities(provider, scope);

    expect(summary.imported).toBe(3);
    const connection = await prisma.externalConnection.findUniqueOrThrow({
      where: { id: scope.connectionId },
    });
    expect(connection.lastSyncedAt).not.toBeNull();
  });

  // Um item ruim não pode derrubar o lote inteiro.
  it("importa o que dá quando uma atividade do lote é inválida", async () => {
    const provider = new FakeStravaProvider();
    const { scope } = await connectedScope("strava-lote-erro", provider);
    provider.activities = [
      activityFor(scope, { providerActivityId: "10" }),
      // Dono errado: será recusada, o resto continua.
      activityFor(scope, { providerActivityId: "11", providerAthleteId: "impostor" }),
      activityFor(scope, { providerActivityId: "12" }),
    ];

    const summary = await importRecentActivities(provider, scope);

    expect(summary.imported).toBe(2);
    expect(summary.skipped).toBe(1);
  });

  // Token vencido → renova antes de usar, e grava o par novo (o Strava rotaciona
  // o refresh token).
  it("renova o token vencido antes de importar", async () => {
    const provider = new FakeStravaProvider();
    const { context, providerAthleteId } = await connectedScope("strava-refresh", provider);
    await connectProvider(
      provider,
      tokens(providerAthleteId, { expiresAt: new Date(Date.now() - 1000) }),
      context,
    );
    const connection = await prisma.externalConnection.findFirstOrThrow({
      where: { athleteId: context.athleteProfileId },
    });

    await importRecentActivities(provider, {
      connectionId: connection.id,
      organizationId: context.organizationId,
      athleteProfileId: context.athleteProfileId,
      providerAthleteId,
    });

    expect(provider.refreshCalls).toBe(1);
    const updated = await prisma.externalConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });
    expect(updated.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  // O atleta revogou pelo site do Strava: a conexão precisa parar de se
  // anunciar como conectada, senão toda importação falharia mostrando uma
  // integração "ativa" que não funciona.
  it("marca a conexão como revogada quando o Strava recusa o refresh", async () => {
    const provider = new FakeStravaProvider();
    const { context, providerAthleteId } = await connectedScope("strava-revogado", provider);
    await connectProvider(
      provider,
      tokens(providerAthleteId, { expiresAt: new Date(Date.now() - 1000) }),
      context,
    );
    const connection = await prisma.externalConnection.findFirstOrThrow({
      where: { athleteId: context.athleteProfileId },
    });
    provider.refreshShouldFail = true;

    await expect(
      importRecentActivities(provider, {
        connectionId: connection.id,
        organizationId: context.organizationId,
        athleteProfileId: context.athleteProfileId,
        providerAthleteId,
      }),
    ).rejects.toThrow(/precisa ser refeita/i);

    expect(await getConnection(context.athleteProfileId)).toBeNull();
  });
});

describe("Fase 11 — vínculo planejado × realizado", () => {
  it("vincula a atividade ao treino planejado do dia e da modalidade", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-match", provider);
    const workout = await newPublishedWorkout(trainer, athlete.athleteProfileId);

    const result = await importActivity(scope, activityFor(scope));

    expect(result.matched).toBe(true);
    const row = await prisma.externalActivity.findUniqueOrThrow({
      where: { id: result.activityId! },
    });
    expect(row.workoutId).toBe(workout.id);
    expect(row.matchStatus).toBe("MATCHED");
    expect(row.matchedAt).not.toBeNull();
  });

  it("não vincula quando a modalidade não bate", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-mod", provider);
    await newPublishedWorkout(trainer, athlete.athleteProfileId, { modality: "SWIMMING" });

    const result = await importActivity(scope, activityFor(scope)); // corrida

    expect(result.matched).toBe(false);
    const row = await prisma.externalActivity.findUniqueOrThrow({
      where: { id: result.activityId! },
    });
    expect(row.workoutId).toBeNull();
    expect(row.matchStatus).toBe("UNMATCHED");
  });

  it("não vincula quando a data não bate", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-data", provider);
    await newPublishedWorkout(trainer, athlete.athleteProfileId, { plannedDate: "2026-07-10" });

    const result = await importActivity(scope, activityFor(scope, { localDate: "2026-07-16" }));

    expect(result.matched).toBe(false);
  });

  // A decisão conservadora da fase, provada no banco: dois treinos iguais no
  // dia → nenhum vínculo, e o treinador decide.
  it("marca AMBIGUOUS e não escolhe quando há dois treinos candidatos", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-ambig", provider);
    await newPublishedWorkout(trainer, athlete.athleteProfileId, { title: "Corrida manhã" });
    await newPublishedWorkout(trainer, athlete.athleteProfileId, { title: "Corrida tarde" });

    const result = await importActivity(scope, activityFor(scope));

    const row = await prisma.externalActivity.findUniqueOrThrow({
      where: { id: result.activityId! },
    });
    expect(row.matchStatus).toBe("AMBIGUOUS");
    expect(row.workoutId).toBeNull();
  });

  // Um treino recebe UM realizado (a coluna é UNIQUE). A segunda corrida do dia
  // fica avulsa em vez de roubar o vínculo.
  it("não vincula uma segunda atividade ao treino já vinculado", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-1a1", provider);
    const workout = await newPublishedWorkout(trainer, athlete.athleteProfileId);

    const first = await importActivity(scope, activityFor(scope, { providerActivityId: "A1" }));
    const second = await importActivity(scope, activityFor(scope, { providerActivityId: "A2" }));

    expect(first.matched).toBe(true);
    expect(second.matched).toBe(false);
    const rows = await prisma.externalActivity.findMany({
      where: { athleteId: athlete.athleteProfileId },
      orderBy: { providerActivityId: "asc" },
    });
    expect(rows.map((r) => r.workoutId)).toEqual([workout.id, null]);
  });

  it("nunca vincula atividade sem modalidade mapeada (ex.: Yoga)", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-yoga", provider);
    await newPublishedWorkout(trainer, athlete.athleteProfileId, { modality: "RUNNING" });

    const result = await importActivity(scope, activityFor(scope, { rawType: "Yoga", modality: null }));

    expect(result.matched).toBe(false);
    // Mas foi importada: é volume real do atleta.
    expect(result.outcome).toBe("imported");
  });

  // O critério de aceite da fase.
  it("entrega ao treinador a visão planejado × realizado", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-pxr", provider);
    const workout = await newPublishedWorkout(trainer, athlete.athleteProfileId);
    // Um treino sem realizado.
    await newPublishedWorkout(trainer, athlete.athleteProfileId, {
      title: "Longão",
      plannedDate: "2026-07-18",
    });
    await importActivity(scope, activityFor(scope));
    // Uma atividade fora do plano.
    await importActivity(
      scope,
      activityFor(scope, { providerActivityId: "avulsa", localDate: "2026-07-17", rawType: "Ride", modality: "CYCLING" }),
    );

    const view = await getPlannedVsActual(
      trainer.organizationId,
      athlete.athleteProfileId,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-31T00:00:00.000Z"),
    );

    expect(view.rows).toHaveLength(2);
    const matched = view.rows.find((r) => r.workout.id === workout.id);
    expect(matched?.actual?.distanceMeters).toBe(10000);
    expect(matched?.actual?.paceSecondsPerKm).toBe(300);
    const unmatched = view.rows.find((r) => r.workout.title === "Longão");
    expect(unmatched?.actual).toBeNull();
    // O realizado fora do plano aparece — não é ruído a esconder.
    expect(view.unplanned).toHaveLength(1);
    expect(view.unplanned[0]!.modality).toBe("CYCLING");
  });

  // Isolamento por tenant, como o resto do sistema.
  it("não vaza atividade de atleta de outra organização", async () => {
    const provider = new FakeStravaProvider();
    const mine = await connectedScope("strava-tenant-a", provider);
    await importActivity(mine.scope, activityFor(mine.scope));

    const other = await newTrainer("strava-tenant-b");

    const view = await getPlannedVsActual(
      other.organizationId,
      mine.athlete.athleteProfileId,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-07-31T00:00:00.000Z"),
    );

    expect(view.rows).toHaveLength(0);
    expect(view.unplanned).toHaveLength(0);
  });
});

describe("Fase 11 — webhook", () => {
  // O evento aponta para uma atividade do cenário. O duplo do provedor devolve
  // o corpo já traduzido (o parsing cru é coberto pelos testes unitários).
  function webhookBody(
    scope: Scope,
    overrides: { activity?: string; aspect?: string; type?: string; providerAthleteId?: string } = {},
  ) {
    const providerActivityId = `${scope.uid}-${overrides.activity ?? "principal"}`;
    const aspect = overrides.aspect ?? "create";
    const event: ActivityWebhookEvent = {
      eventId: `${providerActivityId}:${aspect}:1784200000`,
      type: (overrides.type ?? "ACTIVITY_CREATED") as ActivityWebhookEvent["type"],
      providerActivityId,
      providerAthleteId: overrides.providerAthleteId ?? scope.providerAthleteId,
      rawType: `activity.${aspect}`,
    };
    createdWebhookEventIds.push(event.eventId);
    return JSON.stringify(event);
  }

  it("importa a atividade avisada pelo evento", async () => {
    const provider = new FakeStravaProvider();
    const { athlete, scope } = await connectedScope("strava-wh", provider);
    provider.activities = [activityFor(scope)];

    const result = await handleStravaWebhook(provider, webhookBody(scope));

    expect(result.outcome).toBe("processed");
    expect(
      await prisma.externalActivity.count({ where: { athleteId: athlete.athleteProfileId } }),
    ).toBe(1);
  });

  // O Strava reenvia eventos. A trava é o livro-razão.
  it("descarta a reentrega do mesmo evento", async () => {
    const provider = new FakeStravaProvider();
    const { athlete, scope } = await connectedScope("strava-wh-dup", provider);
    provider.activities = [activityFor(scope)];
    const body = webhookBody(scope);

    const first = await handleStravaWebhook(provider, body);
    const second = await handleStravaWebhook(provider, body);

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");
    expect(
      await prisma.externalActivity.count({ where: { athleteId: athlete.athleteProfileId } }),
    ).toBe(1);
  });

  // O que torna inofensivo o POST não assinado: o dado vem da API do Strava, e
  // se ele não confirma a atividade, NADA é gravado. É o teste do evento
  // forjado — o pior que um atacante consegue é nos fazer buscar um fantasma.
  it("não grava nada quando o provedor não confirma a atividade (evento forjado)", async () => {
    const provider = new FakeStravaProvider();
    const { athlete, scope } = await connectedScope("strava-wh-forj", provider);
    provider.activities = []; // o Strava não conhece essa atividade

    const result = await handleStravaWebhook(provider, webhookBody(scope, { activity: "forjada" }));

    expect(result.outcome).toBe("ignored");
    expect(
      await prisma.externalActivity.count({ where: { athleteId: athlete.athleteProfileId } }),
    ).toBe(0);
  });

  it("descarta evento de dono desconhecido", async () => {
    const provider = new FakeStravaProvider();
    const { athlete, scope } = await connectedScope("strava-wh-owner", provider);
    provider.activities = [activityFor(scope)];

    const result = await handleStravaWebhook(
      provider,
      webhookBody(scope, { providerAthleteId: "77777777" }),
    );

    expect(result.outcome).toBe("ignored");
    expect(
      await prisma.externalActivity.count({ where: { athleteId: athlete.athleteProfileId } }),
    ).toBe(0);
  });

  // O atleta apagou no Strava: manter o realizado faria o treinador comparar o
  // planejado com um fantasma.
  it("apaga o realizado quando a atividade é removida no Strava", async () => {
    const provider = new FakeStravaProvider();
    const { trainer, athlete, scope } = await connectedScope("strava-wh-del", provider);
    const workout = await newPublishedWorkout(trainer, athlete.athleteProfileId);
    await importActivity(scope, activityFor(scope));

    const result = await handleStravaWebhook(
      provider,
      webhookBody(scope, { aspect: "delete", type: "ACTIVITY_DELETED" }),
    );

    expect(result.outcome).toBe("processed");
    expect(
      await prisma.externalActivity.count({ where: { athleteId: athlete.athleteProfileId } }),
    ).toBe(0);
    // O treino planejado sobrevive — só volta a estar sem realizado.
    expect(await prisma.workout.findUnique({ where: { id: workout.id } })).not.toBeNull();
  });
});

afterEach(async () => {
  // O livro-razão de webhook é global (sem organizationId), então é limpo por
  // id de evento a cada teste.
  if (createdWebhookEventIds.length > 0) {
    await prisma.webhookEvent.deleteMany({
      where: { provider: "strava", eventId: { in: createdWebhookEventIds } },
    });
    createdWebhookEventIds.length = 0;
  }
});

afterAll(async () => {
  if (createdOrganizationIds.length > 0) {
    await prisma.externalActivity.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.externalConnection.deleteMany({
      where: { organizationId: { in: createdOrganizationIds } },
    });
    await prisma.workoutFeedback.deleteMany({
      where: { workout: { organizationId: { in: createdOrganizationIds } } },
    });
    await prisma.workout.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  }
  if (createdUserIds.length > 0 || createdOrganizationIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ userId: { in: createdUserIds } }, { organizationId: { in: createdOrganizationIds } }],
      },
    });
  }
  if (createdOrganizationIds.length > 0) {
    await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  }
  if (createdTrainerProfileIds.length > 0) {
    await prisma.trainerProfile.deleteMany({ where: { id: { in: createdTrainerProfileIds } } });
  }
  if (createdAthleteProfileIds.length > 0) {
    await prisma.athleteProfile.deleteMany({ where: { id: { in: createdAthleteProfileIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});
