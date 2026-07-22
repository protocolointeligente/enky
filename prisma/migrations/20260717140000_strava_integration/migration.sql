-- Fase 11 — Integração Strava v1: importar o REALIZADO para confrontar com o
-- PLANEJADO.
--
-- Inteiramente ADITIVA: duas tabelas novas, três enums novos e nenhuma coluna
-- alterada em tabela existente. Um banco que rode esta migração e nunca
-- conecte um Strava fica byte a byte equivalente ao anterior — que é a mesma
-- regra da fase no código: integração é periférico, treino manual não depende
-- dela.

CREATE TYPE "ExternalProvider" AS ENUM ('STRAVA');
CREATE TYPE "ExternalConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "ActivityMatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'AMBIGUOUS');

-- ---------------------------------------------------------------------------
-- 1. ExternalConnection — conexão OAuth do atleta com o provedor
-- ---------------------------------------------------------------------------
-- "accessToken"/"refreshToken" guardam TEXTO CIFRADO (AES-256-GCM, envelope
-- `v1.<iv>.<tag>.<ct>` de server/security/crypto.ts), nunca o token em claro.
-- São NULOS quando a conexão está REVOKED: revogar não guarda credencial
-- "por via das dúvidas" — o que não existe não vaza.
CREATE TABLE "ExternalConnection" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "athleteId"         TEXT NOT NULL,
  "provider"          "ExternalProvider" NOT NULL,
  "providerAthleteId" TEXT NOT NULL,
  "status"            "ExternalConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "scope"             TEXT,
  "accessToken"       TEXT,
  "refreshToken"      TEXT,
  "tokenExpiresAt"    TIMESTAMPTZ,
  "connectedAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSyncedAt"      TIMESTAMPTZ,
  "revokedAt"         TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockVersion"       INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT "ExternalConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalConnection_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalConnection_athleteId_fkey" FOREIGN KEY ("athleteId")
    REFERENCES "AthleteProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Um atleta, uma conexão por provedor. Reconectar depois de revogar faz UPSERT
-- desta linha (volta a ACTIVE com tokens novos) em vez de acumular linha morta.
CREATE UNIQUE INDEX "uq_external_connection_athlete_provider"
  ON "ExternalConnection" ("athleteId", "provider");

-- Uma conta do provedor só pode estar ACTIVE em um atleta por vez: o webhook
-- resolve `owner_id` → conexão, e duas conexões ativas com o mesmo
-- `providerAthleteId` tornariam essa resolução ambígua (a atividade seria
-- atribuída a um atleta escolhido de forma não-determinística).
--
-- PARCIAL, e não UNIQUE cheio, de propósito: linhas REVOKED guardam o
-- histórico e não podem bloquear para sempre a reconexão daquela conta Strava
-- — inclusive por OUTRO AthleteProfile (a mesma pessoa recomeçando com conta
-- nova na ENKY). Mesmo padrão de `uq_active_subscription_per_organization`.
CREATE UNIQUE INDEX "uq_active_external_connection_provider_athlete"
  ON "ExternalConnection" ("provider", "providerAthleteId") WHERE "status" = 'ACTIVE';

CREATE INDEX "ExternalConnection_provider_providerAthleteId_idx"
  ON "ExternalConnection" ("provider", "providerAthleteId");
CREATE INDEX "ExternalConnection_organizationId_idx"
  ON "ExternalConnection" ("organizationId");

-- ---------------------------------------------------------------------------
-- 2. ExternalActivity — atividade realizada, normalizada
-- ---------------------------------------------------------------------------
CREATE TABLE "ExternalActivity" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "athleteId"           TEXT NOT NULL,
  "connectionId"        TEXT NOT NULL,
  "provider"            "ExternalProvider" NOT NULL,
  "providerActivityId"  TEXT NOT NULL,
  "name"                TEXT,
  "rawType"             TEXT NOT NULL,
  "modality"            "Modality",
  "startedAt"           TIMESTAMPTZ NOT NULL,
  "localDate"           DATE NOT NULL,
  "timezone"            TEXT,
  "distanceMeters"      INTEGER,
  "movingSeconds"       INTEGER,
  "elapsedSeconds"      INTEGER,
  "elevationGainMeters" INTEGER,
  "paceSecondsPerKm"    INTEGER,
  "workoutId"           TEXT,
  "matchStatus"         "ActivityMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedAt"           TIMESTAMPTZ,
  "importedAt"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExternalActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalActivity_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalActivity_athleteId_fkey" FOREIGN KEY ("athleteId")
    REFERENCES "AthleteProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalActivity_connectionId_fkey" FOREIGN KEY ("connectionId")
    REFERENCES "ExternalConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- SET NULL: apagar o treino planejado não apaga o que o atleta correu.
  CONSTRAINT "ExternalActivity_workoutId_fkey" FOREIGN KEY ("workoutId")
    REFERENCES "Workout" ("id") ON DELETE SET NULL ON UPDATE CASCADE,

  -- Grandezas físicas nunca negativas. Um provedor com bug não contamina
  -- silenciosamente a comparação planejado × realizado.
  CONSTRAINT "chk_external_activity_distance" CHECK ("distanceMeters" IS NULL OR "distanceMeters" >= 0),
  CONSTRAINT "chk_external_activity_moving" CHECK ("movingSeconds" IS NULL OR "movingSeconds" >= 0),
  CONSTRAINT "chk_external_activity_elapsed" CHECK ("elapsedSeconds" IS NULL OR "elapsedSeconds" >= 0),
  CONSTRAINT "chk_external_activity_pace" CHECK ("paceSecondsPerKm" IS NULL OR "paceSecondsPerKm" > 0)
);

-- A TRAVA DE DEDUPLICAÇÃO da fase. O webhook e a importação manual são duas
-- vias que trazem a mesma atividade, e podem correr ao mesmo tempo: quem
-- garante "importação duplicada não duplica atividade" é este índice, no
-- banco — não uma checagem prévia em código, que teria janela de corrida.
CREATE UNIQUE INDEX "uq_external_activity_provider_activity"
  ON "ExternalActivity" ("provider", "providerActivityId");

-- Um treino planejado recebe no máximo UMA atividade realizada.
CREATE UNIQUE INDEX "ExternalActivity_workoutId_key"
  ON "ExternalActivity" ("workoutId");

CREATE INDEX "ExternalActivity_organizationId_athleteId_localDate_idx"
  ON "ExternalActivity" ("organizationId", "athleteId", "localDate");
CREATE INDEX "ExternalActivity_connectionId_idx"
  ON "ExternalActivity" ("connectionId");
