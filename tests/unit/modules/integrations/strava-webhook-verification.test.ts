import { describe, expect, it } from "vitest";
import { StravaProvider } from "@/modules/integrations/strava-provider";

const VERIFY_TOKEN = "verify-token-secreto-do-strava-para-teste";
const SUBSCRIPTION_ID = "12345";

const provider = new StravaProvider("client-id", "client-secret", VERIFY_TOKEN, SUBSCRIPTION_ID);

function event(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    object_type: "activity",
    object_id: 14204512345,
    aspect_type: "create",
    owner_id: 98765,
    subscription_id: 12345,
    event_time: 1784200000,
    ...overrides,
  });
}

// A regra da fase: "webhook deve validar assinatura/verify token". No Strava, o
// verify token existe SÓ no handshake GET que cria a inscrição — é o único
// ponto com um segredo a conferir, e é o que estes testes travam.
describe("verifySubscription — handshake de criação da inscrição", () => {
  it("devolve o desafio quando o verify token confere", () => {
    expect(provider.verifySubscription("subscribe", VERIFY_TOKEN, "desafio-abc")).toBe(
      "desafio-abc",
    );
  });

  it.each([
    ["token ausente", null],
    ["token vazio", ""],
    ["token errado", "token-errado"],
    ["token truncado", VERIFY_TOKEN.slice(0, 10)],
    ["token com sufixo", `${VERIFY_TOKEN}x`],
  ])("recusa quando o verify token não confere (%s)", (_label, token) => {
    expect(provider.verifySubscription("subscribe", token, "desafio-abc")).toBeNull();
  });

  it("recusa quando o mode não é subscribe", () => {
    expect(provider.verifySubscription("unsubscribe", VERIFY_TOKEN, "desafio-abc")).toBeNull();
  });

  it("recusa quando não há desafio a ecoar", () => {
    expect(provider.verifySubscription("subscribe", VERIFY_TOKEN, null)).toBeNull();
  });

  // Sem verify token configurado, nada passa — o endpoint não vira aberto por
  // uma variável de ambiente esquecida.
  it("recusa o handshake quando a instalação não tem verify token", () => {
    const semToken = new StravaProvider("client-id", "client-secret");
    expect(semToken.verifySubscription("subscribe", "qualquer-coisa", "desafio")).toBeNull();
    expect(semToken.verifySubscription("subscribe", "", "desafio")).toBeNull();
  });
});

// O POST do Strava NÃO é assinado — não há segredo a validar. O que estes
// testes travam é a consequência disso: o corpo é tratado como AVISO, e nenhum
// dado dele é aproveitado. Ver modules/integrations/README.md.
describe("parseWebhookEvent — o corpo é aviso, não dado", () => {
  it("traduz um evento de criação de atividade", () => {
    expect(provider.parseWebhookEvent(event())).toEqual({
      eventId: "14204512345:create:1784200000",
      type: "ACTIVITY_CREATED",
      providerActivityId: "14204512345",
      providerAthleteId: "98765",
      rawType: "activity.create",
    });
  });

  // A prova de que o corpo não vira dado: mesmo com distância, nome e tipo
  // enxertados no payload, o evento traduzido não os carrega — não há campo
  // onde eles caibam.
  it("descarta todo dado de atividade enxertado no corpo", () => {
    const parsed = provider.parseWebhookEvent(
      event({ distance: 999999, name: "Maratona forjada", sport_type: "Run" }),
    );
    expect(parsed).not.toHaveProperty("distance");
    expect(parsed).not.toHaveProperty("name");
    expect(JSON.stringify(parsed)).not.toContain("Maratona forjada");
  });

  it.each([
    ["create", "ACTIVITY_CREATED"],
    ["update", "ACTIVITY_UPDATED"],
    ["delete", "ACTIVITY_DELETED"],
  ])("mapeia aspect_type=%s", (aspect, expected) => {
    expect(provider.parseWebhookEvent(event({ aspect_type: aspect })!)?.type).toBe(expected);
  });

  // Reentrega da MESMA entrega → mesma chave → deduplicada pelo livro-razão.
  it("gera a mesma chave de idempotência para a reentrega do mesmo evento", () => {
    expect(provider.parseWebhookEvent(event())?.eventId).toBe(
      provider.parseWebhookEvent(event())?.eventId,
    );
  });

  // Duas EDIÇÕES distintas precisam de chaves distintas — senão a segunda
  // correção do atleta seria descartada como "duplicada" e nunca chegaria.
  it("gera chaves distintas para duas edições diferentes da mesma atividade", () => {
    const first = provider.parseWebhookEvent(event({ aspect_type: "update", event_time: 1784200000 }));
    const second = provider.parseWebhookEvent(event({ aspect_type: "update", event_time: 1784200500 }));
    expect(first?.eventId).not.toBe(second?.eventId);
  });

  it("distingue create de update da mesma atividade", () => {
    const created = provider.parseWebhookEvent(event({ aspect_type: "create" }));
    const updated = provider.parseWebhookEvent(event({ aspect_type: "update" }));
    expect(created?.eventId).not.toBe(updated?.eventId);
  });

  it.each([
    ["objeto que não é atividade", { object_type: "athlete" }],
    ["aspect_type desconhecido", { aspect_type: "archive" }],
    ["sem object_id", { object_id: undefined }],
    ["sem owner_id", { owner_id: undefined }],
  ])("descarta evento irrelevante (%s)", (_label, override) => {
    expect(provider.parseWebhookEvent(event(override))).toBeNull();
  });

  it("descarta corpo que não é JSON, sem lançar", () => {
    expect(provider.parseWebhookEvent("<html>erro do proxy</html>")).toBeNull();
    expect(provider.parseWebhookEvent("")).toBeNull();
  });

  // Preview e produção compartilham a aplicação Strava; o evento do outro
  // ambiente não é nosso para processar.
  it("descarta evento de outra inscrição", () => {
    expect(provider.parseWebhookEvent(event({ subscription_id: 99999 }))).toBeNull();
  });

  it("aceita qualquer inscrição quando o id não está configurado", () => {
    const semId = new StravaProvider("client-id", "client-secret", VERIFY_TOKEN);
    expect(semId.parseWebhookEvent(event({ subscription_id: 99999 }))).not.toBeNull();
  });
});
