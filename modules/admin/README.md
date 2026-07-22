# modules/admin

**Responsabilidade:** superfície operacional do ADMIN/SUPERADMIN (Fase 9) — diagnosticar e agir sobre usuários e organizações **sem abrir o banco**. Leitura cross-tenant (usuários, organizações, treinadores, atletas, trilha de auditoria, métricas) e as duas ações de estado da plataforma: bloquear/desbloquear usuário e suspender/reativar organização.

**Fonte de verdade:** Product & Engineering Specification v1.0 §14–§15 (papéis e ações que exigem log); Data Model Specification v1.2.1 §9 e §11 (soft delete, lifecycle, LGPD).

## Regras que este módulo materializa

- **ADMIN/SUPERADMIN são cross-tenant.** Não existe escopo de organização aqui — o papel é a **única** fronteira. Por isso ela é verificada dentro de cada função (`assertAdmin`), e não apenas no guard da rota: os outros módulos têm o tenant como segunda barreira, este não tem nenhuma.
- **Treinador e atleta nunca acessam.** `requireGlobalRole(identity, ["ADMIN","SUPERADMIN"])` nas rotas `/api/admin/*` + `assertAdmin` no serviço.
- **Nada é apagado.** Bloqueio e suspensão são flags reversíveis (`User.isActive`, `Organization.isActive`). Não há delete físico nesta superfície.
- **Toda ação admin é auditada** — inclusive `ADMIN_VIEW_ORGANIZATION`, a leitura do detalhe de um tenant (accountability de privacidade). Listagens não são auditadas: não têm sujeito e afogariam a trilha.
- **Motivo obrigatório no destrutivo.** Bloquear/suspender exige `reason` (≥5 caracteres); desbloquear/reativar não. O motivo é o que faz a trilha responder "por quê", e não só "o quê".

## Onde a suspensão é aplicada

Não é aqui. `setOrganizationActive` só vira a flag; quem **aplica** é `server/auth/guards.ts` (`resolveActiveOrganization` e `resolveAthleteOrganization`), o ponto único que resolve tenant para treinador e atleta. Consequências deliberadas:

- vale a partir da requisição seguinte, sem revogar sessão e sem tocar em dado;
- corta treinador **e** atleta do tenant (senão seria meia-suspensão);
- reativar devolve o acesso exatamente como estava.

Bloqueio de usuário é diferente: além da flag (já honrada por `getCurrentSession`), `setUserActive` **revoga as sessões vivas na mesma transação** — sem isso o bloqueado continuaria navegando até o token expirar.

## Rails contra auto-sabotagem

- Um admin não bloqueia a própria conta (trancaria a si mesmo para fora do painel).
- Um `ADMIN` não altera o estado de contas `ADMIN`/`SUPERADMIN` — só o `SUPERADMIN`. Sem isso, um admin comprometido bloquearia todos os outros e sequestraria a plataforma.

## Superfície

`admin-service.ts`: `getPlatformStats`, `listUsers`, `listOrganizations`, `getOrganizationDetail`, `listTrainers`, `listAthletes`, `listAuditTrail`, `setUserActive`, `setOrganizationActive`.
`admin-schema.ts`: parsers de filtro que **nunca lançam** (valor inválido = sem filtro, não 500) e schemas zod das ações de estado.

Rotas: `GET /api/admin/{stats,users,organizations,organizations/[id],trainers,athletes,audit}`, `PATCH /api/admin/users/[id]/status`, `PATCH /api/admin/organizations/[id]/status`. UI: `/admin` e `/admin/organizacoes/[id]`.
