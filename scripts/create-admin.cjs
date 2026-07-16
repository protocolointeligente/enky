/* eslint-disable */
// Cria (ou promove) o usuário ADMIN da plataforma. Idempotente.
//
//   ADMIN_EMAIL=admin@enky.com.br ADMIN_PASSWORD='...' node scripts/create-admin.cjs
//
// A senha vem do ambiente de propósito: senha em arquivo versionado é
// vazamento. O hash usa os mesmos 12 rounds de server/auth/password.ts, então
// o login trata este usuário como qualquer outro.
//
// ADMIN é papel global (fronteira de autorização é o papel, não a organização),
// por isso não cria TrainerProfile/Organization/Membership — só o User.

try {
  process.loadEnvFile(".env");
} catch {
  /* .env opcional se as variáveis já estiverem no ambiente */
}

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const NAME = (process.env.ADMIN_NAME ?? "Admin ENKY").trim();
const MIN_PASSWORD = 12;

async function main() {
  if (!EMAIL || !EMAIL.includes("@")) {
    throw new Error("ADMIN_EMAIL é obrigatório (e-mail válido).");
  }
  if (PASSWORD.length < MIN_PASSWORD) {
    throw new Error(`ADMIN_PASSWORD é obrigatório (mínimo ${MIN_PASSWORD} caracteres).`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, globalRole: "ADMIN", isActive: true, name: NAME },
    create: { email: EMAIL, name: NAME, passwordHash, globalRole: "ADMIN", isActive: true },
    select: { id: true, email: true, globalRole: true, isActive: true },
  });

  console.log(`Admin pronto: ${user.email} · papel ${user.globalRole} · ativo=${user.isActive}`);
}

main()
  .catch((error) => {
    console.error("FALHOU:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
