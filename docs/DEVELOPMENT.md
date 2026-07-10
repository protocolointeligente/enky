# ENKY OS — Guia de Desenvolvimento

## Fluxo de branches

- `main` é protegida e sempre deployável.
- Trabalho novo acontece em branches de feature: `feat/<escopo>`, `fix/<escopo>`, `chore/<escopo>`, `refactor/<escopo>`.
- Pull requests pequenos e focados em uma fase/módulo por vez, seguindo o roadmap oficial (ENKY 23) — não misturar módulos não relacionados no mesmo PR.

## Commits

Conventional Commits, seguindo o padrão já definido em ENKY 24 — Prompt Master §24:

```
fix(auth): protect admin and role-based routes
feat(trainer): add athlete management flow
refactor(routes): remove duplicated empty routes
chore(deploy): stabilize production build
```

## Decisões estruturais exigem ADR

Mudanças de arquitetura, autenticação, modelo de dados ou toolchain que não decorrem diretamente de um dos 5 documentos canônicos devem ser registradas em `docs/adr/ADR-NNN-<slug>.md` antes de implementadas — nunca decididas silenciosamente dentro de um PR. Ver `docs/adr/` para as decisões já tomadas (multi-tenancy, autenticação, toolchain de qualidade).

## Antes de commitar

Rode a suíte de validação completa:

```bash
npm run validate   # lint + typecheck + test + build
npx prisma format
npx prisma validate
```

Todos precisam passar. Nenhum PR é aberto com lint, typecheck, teste ou build quebrado.

## Proibição de segredos

- Nunca commitar `.env` (já ignorado em `.gitignore`). Documentar toda variável nova em `.env.example`, sem valor real.
- Nunca promover um usuário a admin via variável de ambiente ou lista de e-mails fixa (`ADMIN_EMAILS` e equivalentes são proibidos — ver ENKY 24 §22).
- Antes de commitar, revisar o diff em busca de chaves, tokens ou credenciais coladas por engano — inclusive em arquivos de teste e fixtures.

## Banco de dados local

Duas opções, ambas apontando para um Postgres **de desenvolvimento, nunca produção**:

1. **Docker Compose (padrão recomendado):**
   ```bash
   docker compose up -d
   # DATABASE_URL="postgresql://enky:enky@localhost:5433/enky_dev?schema=public"
   # DIRECT_URL pode repetir o mesmo valor — não há split pooled/direto local.
   ```
2. **Provedor gerenciado com split pooled/direto (Neon, Supabase, PgBouncer):** preencha `DATABASE_URL` (endpoint pooled) e `DIRECT_URL` (endpoint direto) em `.env` — `prisma/schema.prisma` já usa `directUrl` para migrations. Foi o caminho usado para validar a Fase 02A neste ambiente (sem Docker disponível).

Depois de configurado:
```bash
npx prisma migrate dev   # aplica migrations pendentes
npm run test:integration # testes de persistência contra o banco real
```

`npm run test` (unitário) nunca precisa de banco — usa `tests/setup.ts` com valores falsos. `npm run test:integration` sempre precisa de um `DATABASE_URL` real e válido.

## Testes E2E (Playwright)

Navegadores não vêm pré-instalados — rode uma vez por máquina:

```bash
npx playwright install chromium
```

`npm run test:e2e` sobe o servidor de dev automaticamente (`webServer` em `playwright.config.ts`, reaproveitado se já estiver rodando) e precisa do mesmo `DATABASE_URL`/`AUTH_SECRET` reais usados pelos testes de integração (`tests/e2e/global-setup.ts` carrega o `.env`).

Specs semeiam estado (ex.: treinador + atleta) com `prisma` direto, não chamando `modules/identity/register-trainer.ts`/`modules/athletes/invite-athlete.ts`. Dois motivos: (1) não existe caixa de e-mail real neste ambiente para receber o link de convite que `DevInvitationMailer` apenas loga no console; (2) esses módulos importam `lib/env.ts`, que importa `server-only` — um pacote cujo comportamento real (no-op no servidor, `throw` no cliente) só funciona através do alias de webpack do Next. O Vitest contorna isso com um alias no próprio `vitest.config.ts`; o Playwright não tem um hook equivalente que não exija tocar o `tsconfig.json` raiz — o que enfraqueceria essa proteção no build de produção inteiro, não só nos testes. Por isso os specs recriam as mesmas linhas via Prisma direto + `bcryptjs`/`node:crypto` (sem dependência de `server-only`), e a partir daí o fluxo é 100% navegador real.

## Regras para migrations

Seguem a Política de Migrations em Produção do Data Model Specification v1.2.1 §12:

**Proibido em produção:**
- `prisma migrate reset`
- `prisma db push --force-reset`
- rename por drop + create sem plano de transição
- seeds destrutivos

**Pipeline obrigatório:** auditoria do schema existente → backup integral → migration aditiva → backfill controlado → validação de integridade → ativação gradual → plano de rollback documentado.

O histórico de migrations vive em `prisma/migrations/` — nunca editar uma migration já aplicada em qualquer ambiente compartilhado; crie uma nova.

## Critérios mínimos de conclusão de uma tarefa

Uma entrega só está pronta quando (ENKY 24 — Prompt Master §21):

- resolve o problema pedido sem quebrar fluxo existente;
- usa dados reais e persistidos — nenhum mock como solução final;
- respeita permissões (validadas no servidor, nunca só no frontend);
- trata estado vazio, loading e erro;
- tem log (`AuditLog`) quando a ação é sensível;
- foi testada manualmente e coberta por teste automatizado quando fizer sentido;
- está documentada no relatório final da tarefa (ver ENKY 24 §23 para o formato).
