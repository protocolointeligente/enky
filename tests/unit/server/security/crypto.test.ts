import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  DecryptionError,
  encryptSecret,
  equalsSecret,
} from "@/server/security/crypto";

// Token realista do Strava.
const TOKEN = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";

describe("encryptSecret / decryptSecret", () => {
  it("faz o round-trip do token", () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
  });

  // A garantia que justifica cifrar: um dump da tabela não entrega o token.
  it("não deixa o texto claro aparecer no envelope", () => {
    expect(encryptSecret(TOKEN)).not.toContain(TOKEN);
  });

  // IV aleatório: dois atletas com o mesmo token não produzem o mesmo
  // ciphertext, o que revelaria a igualdade a quem lê o banco.
  it("produz envelopes diferentes para o mesmo texto", () => {
    expect(encryptSecret(TOKEN)).not.toBe(encryptSecret(TOKEN));
  });

  it("decifra corretamente apesar do IV aleatório", () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
  });

  it("preserva caracteres não-ASCII", () => {
    expect(decryptSecret(encryptSecret("acentuação-日本語-🏃"))).toBe("acentuação-日本語-🏃");
  });

  it("marca a versão do envelope", () => {
    expect(encryptSecret(TOKEN).startsWith("v1.")).toBe(true);
  });

  // GCM é cifra AUTENTICADA: adulterar o banco não faz mandarmos lixo ao
  // provedor — falha ruidosamente.
  it("recusa envelope com ciphertext adulterado", () => {
    const [version, iv, tag] = encryptSecret(TOKEN).split(".");
    const tampered = `${version}.${iv}.${tag}.${Buffer.from("outro-token").toString("base64url")}`;
    expect(() => decryptSecret(tampered)).toThrow(DecryptionError);
  });

  it("recusa envelope com tag de autenticação adulterada", () => {
    const [version, iv, , ciphertext] = encryptSecret(TOKEN).split(".");
    const fakeTag = Buffer.alloc(16).toString("base64url");
    expect(() => decryptSecret(`${version}.${iv}.${fakeTag}.${ciphertext}`)).toThrow(
      DecryptionError,
    );
  });

  it.each([
    ["texto qualquer", "nao-e-um-envelope"],
    ["partes de menos", "v1.abc.def"],
    ["versão desconhecida", "v2.abc.def.ghi"],
    ["vazio", ""],
  ])("recusa envelope malformado (%s)", (_label, envelope) => {
    expect(() => decryptSecret(envelope)).toThrow(DecryptionError);
  });
});

describe("equalsSecret", () => {
  const SECRET = "verify-token-do-strava-para-teste";

  it("aceita o segredo correto", () => {
    expect(equalsSecret(SECRET, SECRET)).toBe(true);
  });

  it.each([
    ["ausente", null],
    ["indefinido", undefined],
    ["vazio", ""],
    ["errado", "outro-segredo-qualquer"],
    ["truncado", SECRET.slice(0, 10)],
    ["com sufixo", `${SECRET}x`],
    ["diferença de caixa", SECRET.toUpperCase()],
  ])("recusa segredo %s", (_label, received) => {
    expect(equalsSecret(received, SECRET)).toBe(false);
  });

  it("recusa quando o esperado está vazio — sem segredo, nada passa", () => {
    expect(equalsSecret("qualquer-coisa", "")).toBe(false);
  });
});
