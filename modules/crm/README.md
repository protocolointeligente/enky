# modules/crm

**Responsabilidade:** CRM de leads da assessoria (Etapa 4 §5–7) — `Lead` e
`LeadInteraction`. Funil `assessoria → prospect`, isolado por `organizationId`.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §5–7; matriz de permissões em
[`docs/ENKY_CRM_PERMISSIONS.md`](../../docs/ENKY_CRM_PERMISSIONS.md).

## Escopo desta fatia

- **Entregue:** modelos + migração `20260719130000_crm_leads`; serviço
  (`lead-service.ts`) com criar/editar/listar/detalhar, mudança de etapa com
  efeito colateral, e interações; Zod (`lead-schemas.ts`); rotas
  `app/api/trainer/leads/*`.
- **Ciclo do lead:** `NEW → CONTACTED → QUALIFIED → TRIAL → PROPOSAL →
  NEGOTIATION → WON | LOST | ARCHIVED`. Etapas livres entre si (sem máquina de
  estados rígida); `WON/LOST/ARCHIVED` derivam timestamps consistentes via
  `resolveStatusFields` (função pura, testada).
- **Rastro:** toda mudança de etapa gera uma `LeadInteraction` `STATUS_CHANGE`.
  O histórico do funil mora aqui, **não** em `AuditLog` (esse é para ações
  sensíveis da plataforma — §32 não lista operações de lead).

## Fora desta fatia (deferido)

- **Conversão lead → cliente (§7):** depende de `Client` (§8),
  `CoachServicePlan` (§9) e `CoachClientContract` (§10), que ainda não existem.
  Fazer agora forçaria o atalho `cliente = atleta` que o §8 proíbe. Por
  enquanto `WON` só marca o desfecho do funil (`convertedAt`); a criação
  transacional/idempotente de cliente/atleta/contrato/cobrança entra na fatia de
  conversão.
- `interestedServiceId` (§5) — sem `CoachServicePlan` para apontar; só
  `interestedModality` por ora.
- Eventos de domínio `LeadCreated`/`LeadConverted` (§31) — quando houver barramento.

## Segurança

Toda rota valida os dois eixos: `requireGlobalRole(["TRAINER"])` +
`requireOrgRole`. Escrita: MANAGER/SUPPORT (OWNER passa sozinho); leitura:
+ HEAD_COACH/VIEWER. Tenant isolation: leads de outra organização são NotFound.
Responsável (`assignedToUserId`) é validado como membro da organização.
