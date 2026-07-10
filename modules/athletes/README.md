# modules/athletes

**Responsabilidade:** perfil esportivo do atleta (`AthleteProfile`) e pipeline de convite (`AthleteInvitation`) — inclusive o caso em que o treinador cadastra o atleta antes de existir um `User` vinculado.

**Fonte de verdade:** Data Model Specification v1.2.1 §2; Interface Architecture v1.4 §11 (Pipeline de Convite de Atleta); Product & Engineering Specification v1.0 §5.

**Status (Fase 02B):** pipeline de convite completo.

- `invite-athlete.ts` — `inviteAthlete()`: cria `AthleteProfile` sem `User`, `CoachAthleteRelationship`, `AthleteInvitation` com token opaco (só o hash é persistido).
- `activate-invitation.ts` — `activateAthleteInvitation()`: valida expiração/consumo/revogação, cria `User` ATHLETE, vincula `AthleteProfile.userId`, consome o convite via compare-and-swap atômico (`updateMany` condicional) — seguro contra duas ativações concorrentes do mesmo token.
- `resend-invitation.ts` / `revoke-invitation.ts` — ambos escopados por organização (convite de outra organização retorna 404, nunca 403, para não vazar existência).
- `invitation-token.ts` — geração/hash do token, compartilhado pelos três serviços acima.

Rotas em `app/api/athletes/invitations/{route,activate/route,[id]/resend/route,[id]/revoke/route}.ts`. Envio de e-mail via `infrastructure/mail/` (adapter de desenvolvimento apenas — ver seu README).
