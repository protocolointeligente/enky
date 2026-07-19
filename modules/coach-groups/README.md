# modules/coach-groups

**Responsabilidade:** grupos/turmas de atletas da assessoria (Etapa 4 §20) —
`CoachGroup` + `CoachGroupMember`. Escopado por `organizationId`.

## Escopo desta fatia

- **Entregue:** CRUD de grupo (nome, descrição, modalidade, nível, treinador,
  status ACTIVE/ARCHIVED); composição (adicionar/remover atletas); treinador do
  grupo. Rotas `app/api/trainer/groups/*`; UI `/treinador/gestao/grupos`.
- **Validações:** treinador do grupo precisa ser membro da org; atleta precisa
  pertencer à org (via `CoachAthleteRelationship`); `addMembers` é idempotente
  (`@@unique([groupId, athleteId])` + skipDuplicates).
- **Deferido (cross-domínio de treino):** aplicar template ao grupo, criar
  treino/periodização para o grupo, filtrar o calendário por grupo. O grupo já
  entrega a base de composição para essas features.

## Segurança

`requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Escrita: MANAGER/HEAD_COACH
(OWNER passa sozinho); leitura: + COACH/ASSISTANT_COACH/SUPPORT/VIEWER. Tenant
isolation em toda query.
