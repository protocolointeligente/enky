import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "@/modules/integrations/oauth-state";

const USER = "user-uuid-do-atleta";
const NOW = new Date("2026-07-16T12:00:00Z");

describe("OAuth state — CSRF do handshake", () => {
  it("verifica um state que acabou de ser emitido", () => {
    const payload = verifyOAuthState(createOAuthState(USER, NOW), NOW);
    expect(payload?.userId).toBe(USER);
  });

  // O ATAQUE que o state impede: o atacante inicia o OAuth com a própria conta
  // Strava e induz a vítima a abrir o callback com o code dele. Sem esta
  // amarração, a conta Strava DO ATACANTE seria ligada ao atleta vítima.
  it("devolve o userId de quem iniciou, para a rota confrontar com a sessão", () => {
    const attackerState = createOAuthState("user-do-atacante", NOW);
    const payload = verifyOAuthState(attackerState, NOW);
    // O state é válido (é um state real, do atacante) — quem o rejeita é a
    // rota, ao ver que não é do usuário da sessão. Ver o callback.
    expect(payload?.userId).not.toBe(USER);
  });

  it("recusa state com assinatura adulterada", () => {
    const state = createOAuthState(USER, NOW);
    const [body] = state.split(".");
    expect(verifyOAuthState(`${body}.assinatura-forjada`, NOW)).toBeNull();
  });

  // Trocar o userId dentro do corpo exige reassinar — e a chave é o AUTH_SECRET.
  it("recusa state cujo corpo foi trocado", () => {
    const state = createOAuthState(USER, NOW);
    const signature = state.split(".")[1];
    const forgedBody = Buffer.from(
      JSON.stringify({ userId: "outro-usuario", issuedAt: NOW.getTime(), nonce: "x" }),
      "utf8",
    ).toString("base64url");
    expect(verifyOAuthState(`${forgedBody}.${signature}`, NOW)).toBeNull();
  });

  it("aceita dentro da janela de 10 minutos", () => {
    const state = createOAuthState(USER, NOW);
    const later = new Date(NOW.getTime() + 9 * 60 * 1000);
    expect(verifyOAuthState(state, later)?.userId).toBe(USER);
  });

  it("recusa state expirado", () => {
    const state = createOAuthState(USER, NOW);
    const tooLate = new Date(NOW.getTime() + 11 * 60 * 1000);
    expect(verifyOAuthState(state, tooLate)).toBeNull();
  });

  // Payload forjado com timestamp futuro (ou relógio adulterado).
  it("recusa state emitido no futuro", () => {
    const state = createOAuthState(USER, new Date(NOW.getTime() + 60 * 1000));
    expect(verifyOAuthState(state, NOW)).toBeNull();
  });

  it.each([
    ["nulo", null],
    ["vazio", ""],
    ["sem separador", "semseparador"],
    ["só o separador", "."],
    ["corpo não-base64", "!!!.assinatura"],
  ])("recusa state %s sem lançar", (_label, state) => {
    expect(verifyOAuthState(state, NOW)).toBeNull();
  });

  // Nonce: dois states do mesmo usuário no mesmo instante são distintos.
  it("emite states distintos para o mesmo usuário", () => {
    expect(createOAuthState(USER, NOW)).not.toBe(createOAuthState(USER, NOW));
  });
});
