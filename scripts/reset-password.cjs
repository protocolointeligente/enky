/* eslint-disable */
// Utilitário administrativo de reset de senha (uso local, contra o banco do .env).
//
//   node scripts/reset-password.cjs <email>                 # só verifica se existe
//   node scripts/reset-password.cjs <email> "<novaSenha>"   # redefine a senha
//
// A senha nunca é fixada no código — vem por argumento. Regra: mín. 10
// caracteres, com letras e números (modules/identity/password-policy.ts).
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const email = process.argv[2];
const newPassword = process.argv[3];

async function main() {
  if (!email) {
    console.error('Uso: node scripts/reset-password.cjs <email> ["<novaSenha>"]');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, globalRole: true, createdAt: true },
  });

  if (!user) {
    console.log("Usuário NÃO encontrado:", email);
    return;
  }

  console.log("Usuário encontrado:");
  console.log("  email :", user.email);
  console.log("  nome  :", user.name);
  console.log("  papel :", user.globalRole);
  console.log("  criado:", user.createdAt.toISOString());

  if (!newPassword) {
    console.log("");
    console.log('Para redefinir: node scripts/reset-password.cjs "' + email + '" "<novaSenha>"');
    console.log("(mín. 10 caracteres, com letras e números)");
    return;
  }

  const valid =
    newPassword.length >= 10 &&
    newPassword.length <= 128 &&
    /[a-zA-Z]/.test(newPassword) &&
    /[0-9]/.test(newPassword);
  if (!valid) {
    console.error("Senha inválida: mín. 10 caracteres (máx. 128), com letras e números.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  console.log("");
  console.log("✅ Senha redefinida para", user.email);
}

main()
  .catch((error) => {
    console.error("Falhou:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
