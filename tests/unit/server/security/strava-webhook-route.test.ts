import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// O serviço é mockado: o que está sob teste aqui é o CONTRATO HTTP da rota do
// webhook, não a importação (essa é coberta pela integração contra o banco).
vi.mock("@/modules/integrations/strava-webhook-service", () => ({
  handleStravaWebhook: vi.fn(),
}));

import { GET as handshake, POST as receiveEvent } from "@/app/api/webhooks/strava/route";
import { handleStravaWebhook } from "@/modules/integrations/strava-webhook-service";
import { setActivityProviderForTests } from "@/modules/integrations/get-activity-provider";
import { StravaProvider } from "@/modules/integrations/strava-provider";

const VERIFY_TOKEN = "verify-token-do-strava-para-teste";

function url(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  return `https://enky.test/api/webhooks/strava?${search.toString()}`;
}

describe("GET /api/webhooks/strava — handshake da inscrição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivityProviderForTests(
      new StravaProvider("client-id", "client-secret", VERIFY_TOKEN),
    );
  });

  // O Strava exige EXATAMENTE este formato — não o envelope {ok,data} do resto
  // da API. Formato diferente faz a criação da inscrição falhar.
  it("ecoa o desafio no formato que o Strava exige", async () => {
    const response = await handshake(
      new NextRequest(
        url({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "abc123" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ "hub.challenge": "abc123" });
  });

  it.each([
    ["token errado", { "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "abc" }],
    ["sem token", { "hub.mode": "subscribe", "hub.challenge": "abc" }],
    ["mode errado", { "hub.mode": "unsubscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "abc" }],
    ["sem parâmetro nenhum", {}],
  ])("responde 403 sem detalhe quando %s", async (_label, params) => {
    const response = await handshake(new NextRequest(url(params)));

    expect(response.status).toBe(403);
    // Nenhuma pista de por que falhou.
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  // Instalação sem Strava configurado: o provedor lança, e a rota não pode
  // vazar isso como 500.
  it("responde 403 quando a instalação não tem Strava configurado", async () => {
    setActivityProviderForTests(null);
    // Sem credencial no ambiente de teste, getActivityProvider lança.
    const response = await handshake(
      new NextRequest(url({ "hub.mode": "subscribe", "hub.verify_token": "x", "hub.challenge": "abc" })),
    );

    expect(response.status).toBe(403);
  });
});

describe("POST /api/webhooks/strava — evento", () => {
  function post(body: string): NextRequest {
    return new NextRequest("https://enky.test/api/webhooks/strava", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setActivityProviderForTests(
      new StravaProvider("client-id", "client-secret", VERIFY_TOKEN),
    );
  });

  it("responde 200 ao evento processado", async () => {
    vi.mocked(handleStravaWebhook).mockResolvedValue({ outcome: "processed" });

    const response = await receiveEvent(post("{}"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { outcome: "processed" } });
  });

  // A regra operacional da rota: o Strava DESATIVA a inscrição depois de falhas
  // repetidas — o que silenciaria a integração de TODOS os atletas por causa do
  // erro de um. "Já processei", "não me interessa" e até "quebrou" são 200.
  it.each([
    ["duplicado", { outcome: "duplicate" as const }],
    ["ignorado", { outcome: "ignored" as const }],
  ])("responde 200 ao evento %s", async (_label, result) => {
    vi.mocked(handleStravaWebhook).mockResolvedValue(result);

    expect((await receiveEvent(post("{}"))).status).toBe(200);
  });

  it("responde 200 mesmo quando o processamento lança", async () => {
    vi.mocked(handleStravaWebhook).mockRejectedValue(new Error("banco fora do ar"));

    const response = await receiveEvent(post("{}"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { outcome: "ignored" } });
  });

  it("responde 200 numa instalação sem Strava configurado", async () => {
    setActivityProviderForTests(null);

    expect((await receiveEvent(post("{}"))).status).toBe(200);
  });
});
