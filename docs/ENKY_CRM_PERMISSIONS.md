# ENKY — Matriz de Permissões da Gestão

> Etapa 4 §4/§28. Recurso × papel organizacional. Fonte de verdade da
> **intenção**; a imposição real é `requireOrgRole` em cada rota
> ([server/auth/guards.ts](../server/auth/guards.ts)). Papéis definidos em
> [ENKY_ORGANIZATION_ROLES.md](./ENKY_ORGANIZATION_ROLES.md).

Legenda: **F** = total (criar/editar/excluir) · **L** = leitura · **—** = sem acesso.
`OWNER` = **F** em tudo (passa sempre no `requireOrgRole`) e é omitido das colunas.
`ADMIN` (legado) = igual a `MANAGER`.

| Recurso | MANAGER | HEAD_COACH | COACH | ASSIST_COACH | FINANCE | SUPPORT | VIEWER |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Visão geral (Gestão) | L | L | L¹ | L¹ | L² | L¹ | L |
| Leads | F | L | — | — | — | F | L |
| Clientes | F | L | L¹ | L¹ | L² | F | L |
| Atletas (vínculo/carteira) | F | F | L¹ | L¹ | — | L | L |
| Planos e serviços | F | L | — | — | L | L | L |
| Contratos | F | L | — | — | L | F³ | L |
| Mensalidades / Faturas | F | — | — | — | F | L | L |
| Pagamentos | F | — | — | — | F | — | L |
| Inadimplência | F | L | — | — | F | L | L |
| Indicadores financeiros | L | — | — | — | F | — | — |
| Treinadores (equipe) | F | L | — | — | — | L | L |
| Grupos | F | F | L¹ | L¹ | — | L | L |
| Comunicação | F | F | L¹ | L¹ | L² | F | L |
| Dados fisiológicos / saúde | L | F | F¹ | F¹ | **—** | **—** | L |
| Configurações da assessoria | F | — | — | — | — | — | — |
| Trocar papéis / dono | — | — | — | — | — | — | — |

Notas:
1. **COACH/ASSISTANT_COACH/HEAD_COACH** só enxergam os **atletas atribuídos** a
   eles (a carteira já é filtrada por `CoachAthleteRelationship`); "L¹" é sempre
   escopado à carteira, nunca à organização inteira.
2. **FINANCE** vê o cliente/leitura **comercial** para cobrar, mas **nunca** dado
   fisiológico/de saúde ("L²" = só campos comerciais).
3. **SUPPORT** monta/edita o contrato administrativamente ("F³"), mas **não**
   altera preço travado nem registra pagamento.

## Ações que exigem auditoria (§32)

Independente do papel, registrar em `AuditLog` (via `domain/audit.ts`): alteração
de preço, desconto, cancelamento, pagamento, exclusão, anonimização,
transferência de atleta, mudança de papel, acesso financeiro.

## Como aplicar numa rota

```ts
const identity = await requireAuthenticatedUser();
requireGlobalRole(identity, ["TRAINER"]);
const active = await resolveActiveOrganization(identity.userId);
requireOrgRole(active, ["MANAGER", "FINANCE"]); // OWNER passa sozinho
```

> Esta matriz é a especificação; cada linha vira uma chamada `requireOrgRole` na
> fatia que criar o recurso correspondente. Enquanto o recurso não existe, a
> linha é intenção documentada — não há rota para impor ainda.
