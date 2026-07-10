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

## Regras para migrations

Seguem a Política de Migrations em Produção do Data Model Specification v1.2.1 §12:

**Proibido em produção:**
- `prisma migrate reset`
- `prisma db push --force-reset`
- rename por drop + create sem plano de transição
- seeds destrutivos

**Pipeline obrigatório:** auditoria do schema existente → backup integral → migration aditiva → backfill controlado → validação de integridade → ativação gradual → plano de rollback documentado.

Nesta fase de fundação nenhuma migration foi executada — o schema em `prisma/schema.prisma` é intencionalmente mínimo (ver `prisma/schema.prisma`, comentário de topo).

## Critérios mínimos de conclusão de uma tarefa

Uma entrega só está pronta quando (ENKY 24 — Prompt Master §21):

- resolve o problema pedido sem quebrar fluxo existente;
- usa dados reais e persistidos — nenhum mock como solução final;
- respeita permissões (validadas no servidor, nunca só no frontend);
- trata estado vazio, loading e erro;
- tem log (`AuditLog`) quando a ação é sensível;
- foi testada manualmente e coberta por teste automatizado quando fizer sentido;
- está documentada no relatório final da tarefa (ver ENKY 24 §23 para o formato).
