import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

// bcrypt roda com 12 rounds de propósito (server/auth/password.ts): cada hash
// custa ~1,5s aqui e passa de 5s quando a máquina está sob carga — o timeout
// padrão do Vitest transformava isso em falha intermitente. O custo é a defesa,
// não um teste lento por acidente, então a folga fica só neste arquivo.
describe("server/auth/password", { timeout: 30_000 }, () => {
  it("hashes a password and verifies the correct plaintext against it", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toBe("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password on each call (random salt)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);

    expect(a).not.toBe(b);
  });
});
