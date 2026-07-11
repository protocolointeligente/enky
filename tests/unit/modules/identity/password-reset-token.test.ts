import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  parsePasswordResetToken,
  PASSWORD_RESET_TTL_MS,
  verifyPasswordResetToken,
} from "@/modules/identity/password-reset-token";

const NOW = 1_700_000_000_000;
const USER = "user-123";
const HASH = "$2a$12$abcdefghijklmnopqrstuv";

function parse(token: string) {
  const parsed = parsePasswordResetToken(token);
  if (!parsed) throw new Error("token não parseou");
  return parsed;
}

describe("password reset token (stateless, hash-bound)", () => {
  it("verifica um token novo vinculado ao hash atual", () => {
    const parsed = parse(createPasswordResetToken(USER, HASH, NOW));
    expect(parsed.userId).toBe(USER);
    expect(verifyPasswordResetToken(parsed, HASH, NOW + 1000)).toBe(true);
  });

  it("rejeita após expirar", () => {
    const parsed = parse(createPasswordResetToken(USER, HASH, NOW));
    expect(verifyPasswordResetToken(parsed, HASH, NOW + PASSWORD_RESET_TTL_MS + 1)).toBe(false);
  });

  it("torna-se inválido quando o hash da senha muda (single-use)", () => {
    const parsed = parse(createPasswordResetToken(USER, HASH, NOW));
    expect(verifyPasswordResetToken(parsed, "$2a$12$OUTROHASHdiferente", NOW + 1000)).toBe(false);
  });

  it("rejeita assinatura adulterada", () => {
    const parsed = parse(createPasswordResetToken(USER, HASH, NOW));
    const tampered = { ...parsed, signature: `${parsed.signature.slice(0, -2)}xy` };
    expect(verifyPasswordResetToken(tampered, HASH, NOW + 1000)).toBe(false);
  });

  it("retorna null para tokens malformados", () => {
    expect(parsePasswordResetToken("garbage")).toBeNull();
    expect(parsePasswordResetToken("a.b")).toBeNull();
    expect(parsePasswordResetToken("a.notanumber.c")).toBeNull();
  });
});
