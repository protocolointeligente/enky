# ADR-001 — Multi-tenancy: organização pessoal implícita e resolução de tenant no servidor

**Status:** Aceito
**Data:** Fase 01.5 — Reconciliação e Hardening da Fundação
**Contexto de decisão:** achado F4 do relatório de Fase 1. O Data Model Specification v1.2.1 exige `organizationId` em praticamente toda entidade operacional desde a primeira linha do schema, mas o Product & Engineering Specification v1.0 (§9, "Fora do MVP") e o Roadmap (ENKY 23, Fase 6) tratam organizações multiusuário como recurso avançado, não do MVP. Sem uma decisão explícita, a Fase 0/1 não conseguiria criar um único `Workout` sem antes construir a funcionalidade completa de assessoria da Fase 6.

## 1. Decisão

Todo cadastro de treinador cria **atomicamente**, na mesma transação:

1. `User` (papel global `TRAINER`);
2. `TrainerProfile`;
3. `Organization` pessoal (nome derivado do treinador, ex.: "Treinador(a) — {nome}");
4. `OrganizationMembership` vinculando o `User` à `Organization` com `OrganizationRole.OWNER`.

A organização pessoal:

- existe desde o MVP — todo dado operacional (`Workout`, `CalendarEvent`, `Periodization` etc.) nasce corretamente isolado por `organizationId` desde o primeiro registro criado, sem exceção e sem retrabalho de migração quando a Fase 6 chegar;
- **não implica nenhuma interface de assessoria/multiusuário** — o treinador nunca vê conceito de "organização" na UI do MVP; para ele, é transparente;
- pode evoluir posteriormente para uma assessoria real, quando outros treinadores forem convidados como membros adicionais (Fase 6) — a mesma linha de `Organization`, sem migração de dados;
- nunca tem seu `organizationId` aceito como vindo do frontend como autoridade — é sempre resolvido no servidor a partir da sessão autenticada (`OrganizationMembership` do usuário atual), nunca de um campo de formulário ou parâmetro de rota.

## 2. Mecanismo de aplicação das invariantes de tenant (achado F8)

Resolvido nesta ADR, não deixado em aberto:

- **Tenant resolvido no servidor:** todo route handler/server action que acesse dado protegido chama `requireIdentity()` (ver ADR-002) e deriva o `organizationId` ativo a partir das `OrganizationMembership` do usuário — nunca de um parâmetro recebido do cliente.
- **Filtro obrigatório por `organizationId`:** todo serviço de domínio em `modules/<domínio>/` que consulte uma entidade com `organizationId` deve incluir esse filtro na cláusula `where` — sem exceção, mesmo quando o `id` do registro já parece suficiente (um atacante que adivinhe/enumere um UUID de outra organização não deve conseguir lê-lo).
- **Invariantes validadas em serviços de domínio:** as equações de linhagem de tenant do Data Model Specification v1.2.1 §10 (ex.: `periodization.organizationId == workout.organizationId`) são responsabilidade do serviço de domínio que cria/atualiza a entidade — validadas antes de qualquer escrita, dentro da mesma transação.
- **Row-Level Security do PostgreSQL — adiada como defesa em profundidade.** RLS nativo do Postgres é mais forte (protege mesmo contra um bug de aplicação que esqueça o filtro), mas adiciona uma segunda superfície de configuração (políticas SQL) que duplicaria a lógica de autorização já resolvida na aplicação. Reavaliar quando: (a) existir mais de um serviço/processo acessando o mesmo banco diretamente, ou (b) uma revisão de segurança externa recomendar defesa em profundidade adicional antes de dados de saúde reais estarem em produção.

## 3. Consequências

- Todo fluxo de cadastro de treinador (Fase 02) implementa as 4 escritas atômicas da seção 1 numa única transação Prisma (`$transaction`) — nunca em passos separados que possam deixar um `User` sem `Organization`.
- A UI nunca precisa (nem deve) perguntar "qual organização?" no MVP — resolvido implicitamente.
- Quando a Fase 6 chegar, o trabalho é **aditivo** (convidar membros extras para uma `Organization` já existente), não uma migração de dados de "sem tenant" para "com tenant".

## 4. Implementação (Fase 02B)

`modules/identity/register-trainer.ts` (`registerTrainer()`) implementa exatamente as 4 escritas atômicas desta ADR. `server/auth/guards.ts` (`resolveActiveOrganization()`) implementa a resolução de tenant no servidor — nenhuma rota aceita `organizationId` do cliente. Testado contra PostgreSQL real, incluindo uma corrida de dois cadastros simultâneos com o mesmo e-mail (nenhum dado parcial sobrevive) — ver `tests/integration/identity-auth.test.ts`.
