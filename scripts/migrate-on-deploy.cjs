#!/usr/bin/env node
/* eslint-disable */
// Aplica as migrações no deploy (Vercel `vercel-build`), de forma resiliente.
//
// Por que existe: o schema exige `directUrl` (conexão direta/unpooled) para
// migrar. No Vercel esse valor pode vir de nomes diferentes conforme a
// integração (DIRECT_URL, ou o DATABASE_URL_UNPOOLED que o Neon popula) e pode
// estar VAZIO em ambientes onde as variáveis de banco não foram escopadas
// (ex.: Preview). Um `prisma migrate deploy` cru falha o build inteiro nesse
// caso — pior que não migrar.
//
// Estratégia: resolve a primeira URL não-vazia entre DIRECT_URL,
// DATABASE_URL_UNPOOLED e DATABASE_URL. Se NENHUMA existir, PULA a migração e
// deixa o build seguir (o ambiente sem banco não tem o que migrar). Se existir,
// migra passando a URL explicitamente como url E directUrl — e aí sim uma
// falha REAL de migração derruba o deploy (não se deve subir código que
// depende de colunas ainda ausentes).

const { execSync } = require("node:child_process");

const url =
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "";

if (!url) {
  console.warn(
    "[migrate-on-deploy] Nenhuma URL de banco encontrada " +
      "(DIRECT_URL / DATABASE_URL_UNPOOLED / DATABASE_URL vazias). " +
      "Pulando migração neste ambiente — o build segue.",
  );
  process.exit(0);
}

const source = process.env.DIRECT_URL?.trim()
  ? "DIRECT_URL"
  : process.env.DATABASE_URL_UNPOOLED?.trim()
    ? "DATABASE_URL_UNPOOLED"
    : "DATABASE_URL";
console.log(`[migrate-on-deploy] Aplicando migrações usando ${source}.`);

try {
  execSync("prisma migrate deploy", {
    stdio: "inherit",
    // Garante que o schema valide (url e directUrl não-vazias) e que a conexão
    // use a URL direta resolvida, seja qual for o nome de origem.
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
} catch {
  console.error("[migrate-on-deploy] Falha ao aplicar migrações — abortando o build.");
  process.exit(1);
}
