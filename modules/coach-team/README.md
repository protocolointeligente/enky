# modules/coach-team

**Responsabilidade:** gestão de equipe e carteiras da assessoria (Etapa 4 §18–19).
Membros existentes da organização (papel/ativação) e atribuição de atletas aos
treinadores, com papel na carteira.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §18–19; auditoria §32.

## Escopo desta fatia

- **Entregue:** `listTrainers` (membros + papel + status + carteira ativa),
  `setMemberRole` / `setMemberActive` (com guardas), `assignAthlete` (upsert com
  papel `PRIMARY/ASSISTANT/TEMPORARY/VIEW_ONLY`), `unassignAthlete` (soft, preserva
  histórico), `transferAthlete` (atômico). Rotas `app/api/trainer/team/*`; UI
  `/treinador/gestao/treinadores`.
- **Guardas:** não altera o `OWNER` nem o próprio vínculo (evita se trancar fora);
  papéis atribuíveis = `ORG_ROLES` sem OWNER.
- **Auditoria (§32):** `CHANGE_MEMBER_ROLE`, `SET_MEMBER_ACTIVE`, `ASSIGN_ATHLETE`,
  `UNASSIGN_ATHLETE`, `TRANSFER_ATHLETE`.

## Bloqueio arquitetural — convite de treinador NOVO (deferido)

Convidar um treinador que ainda não existe (e-mail → registro → entrar na org)
esbarra em **ADR-001**: hoje cada treinador tem uma organização pessoal e
`resolveActiveOrganization` resolve pela primeira membership. Suportar um usuário
em **múltiplas** organizações (a base de uma assessoria multi-treinador real) é o
trabalho de multi-org da Fase 6. Até lá, esta gestão opera sobre membros já
existentes; o convite de treinador novo fica documentado como pendência de
infraestrutura.

## Segurança

`requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Papel/ativação de membro:
MANAGER (OWNER passa sozinho). Carteira (atribuir/transferir): MANAGER/HEAD_COACH.
Leitura: + SUPPORT/VIEWER. Tenant isolation em toda query.
