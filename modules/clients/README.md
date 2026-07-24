# modules/clients

**Responsabilidade:** cliente comercial da assessoria (Etapa 4 §8) — modelo
`Client`. Registro de quem tem a **relação comercial**, isolado por
`organizationId`.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §8; matriz em
[`docs/ENKY_CRM_PERMISSIONS.md`](../../docs/ENKY_CRM_PERMISSIONS.md).

## A separação que importa (§8)

`Cliente ≠ Atleta ≠ Pagador`. São papéis distintos que costumam coincidir mas
nem sempre:

- **Cliente** (`Client`, aqui) — quem contrata.
- **Atleta** (`AthleteProfile`) — quem treina.
- **Pagador** — quem paga.

Por isso `Client` **não** tem `athleteProfileId`: o vínculo
cliente↔atleta↔pagador é **por contrato** e mora no `CoachClientContract` (§10:
`clientId` / `athleteId` / `payerClientId`), onde pode ser 1→N (equipe paga,
vários treinam). Colocar o atleta direto no cliente cravaria `cliente = atleta`,
que o §8 proíbe.

## Escopo desta fatia

- **Entregue:** modelo `Client` + `ClientStatus`; migração `20260719140000_clients`;
  serviço CRUD (`client-service.ts`) + Zod (`client-schemas.ts`); rotas
  `app/api/trainer/clients/*`; UI `/treinador/gestao/clientes`.
- **Deferido:** conversão lead→cliente (§7 — transacional, junto de
  atleta/contrato); `Client.userId`/`sourceLeadId` existem no schema mas nada os
  popula ainda (portal do cliente e conversão são fatias posteriores).

## Segurança

Dois eixos: `requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Escrita:
MANAGER/SUPPORT (OWNER passa sozinho); leitura: + HEAD_COACH/FINANCE/VIEWER.
COACH/ASSISTANT_COACH ficam de fora até o vínculo com atleta (§10) permitir
escopar a carteira. Tenant isolation: cliente de outra org é NotFound.
