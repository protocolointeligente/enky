# ENKY — Papéis Organizacionais da Assessoria

> Etapa 4 §4. Papéis do usuário **dentro de uma organização** (assessoria),
> distintos do papel **global** (`Role`: SUPERADMIN/ADMIN/TRAINER/ATHLETE).
>
> - Enum: `OrganizationRole` em [prisma/schema.prisma](../prisma/schema.prisma).
> - Fonte única de lista/rótulos: [modules/organizations/org-roles.ts](../modules/organizations/org-roles.ts).
> - Imposição em runtime: `requireOrgRole` em [server/auth/guards.ts](../server/auth/guards.ts).
> - Matriz recurso × papel: [ENKY_CRM_PERMISSIONS.md](./ENKY_CRM_PERMISSIONS.md).

## Dois eixos de autorização

Toda rota de Gestão valida **os dois**, nunca um só:

1. **Papel global** (`requireGlobalRole(identity, ["TRAINER"])`) — o usuário é um treinador da plataforma.
2. **Papel organizacional** (`requireOrgRole(active, [...])`) — o que ele pode fazer *nesta* organização.

`resolveActiveOrganization(userId)` devolve `{ organizationId, organizationRole }`
e já barra organização suspensa (`isActive=false`). `requireOrgRole` decide o
resto.

## Regras do `requireOrgRole`

- **OWNER passa sempre** — acesso total à organização (§4); nunca precisa ser listado.
- **ADMIN é legado** → tratado como **MANAGER**. Nunca é atribuído a vínculos
  novos (o cadastro cria OWNER) e não aparece na lista atribuível `ORG_ROLES`.
- Todos os demais são **allow-list explícita** por rota.

## Papéis (autoridade decrescente)

| Papel | Rótulo | Responsabilidade |
| --- | --- | --- |
| `OWNER` | Proprietário | Acesso total: financeiro, planos, contratos, equipe, configurações. |
| `MANAGER` | Gestor | Gestão operacional e comercial: atletas, planos, contratos, equipe, relatórios gerenciais. Sem trocar o dono. |
| `HEAD_COACH` | Treinador-chefe | Coordena a equipe técnica; carteira ampla; sem acesso financeiro irrestrito. |
| `COACH` | Treinador | Apenas atletas atribuídos: prescrição, avaliações, métricas, feedbacks, calendário. Sem plano comercial nem financeiro. |
| `ASSISTANT_COACH` | Treinador assistente | Como COACH, porém escopo auxiliar (apoio ao titular). |
| `FINANCE` | Financeiro | Mensalidades, pagamentos, inadimplência, relatórios financeiros. **Sem** dados de saúde/fisiológicos. |
| `SUPPORT` | Suporte | Cadastro, atendimento, convites, contratos. **Sem** métricas clínicas/fisiológicas detalhadas e **sem** alterar pagamento. |
| `VIEWER` | Visualizador | Somente leitura do que lhe for permitido. |

`ADMIN` (legado) = "Administrador (legado)", equivalente a `MANAGER`.

## Fronteiras de dados (LGPD, §29)

- **FINANCE** não vê dado fisiológico/de saúde.
- **COACH/ASSISTANT_COACH** não veem plano comercial nem financeiro.
- **SUPPORT** não altera pagamento nem vê métrica clínica detalhada.
- Separação obrigatória: dados comerciais × esportivos × de saúde × financeiros.

## Estado de implementação

- **Feito nesta fatia:** enum estendido (migração aditiva `20260719120000_org_foundation_roles`),
  `requireOrgRole`, `org-roles.ts`, esta matriz.
- **Pendente (fatias seguintes):** UI de atribuição de papel, fluxo de convite de
  treinador com papel, e a aplicação de `requireOrgRole` em cada rota de Gestão
  conforme ela for criada.
