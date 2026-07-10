# ENKY OS — Matriz de Permissões (Role × OrganizationRole)

**Status:** Aceito — Fase 01.5
**Fonte de verdade para conflitos:** Product & Engineering Specification v1.0 §14 (Permissões e Segurança) e Data Model Specification v1.2.1 (enums `Role`, `OrganizationRole`, §10 invariantes de tenant). Este documento formaliza a matriz que faltava (achado F7 do relatório de Fase 1) — em caso de conflito com os documentos canônicos, eles prevalecem.

## 1. Duas dimensões de papel

A ENKY tem **duas** dimensões de autorização, nunca uma só:

1. **`Role` (global)** — o que a conta *é* na plataforma: `SUPERADMIN`, `ADMIN`, `TRAINER`, `ATHLETE`.
2. **`OrganizationRole` (por organização)** — o que a conta *pode fazer dentro de uma organização específica*: `OWNER`, `COACH`, `ADMIN`, `SUPPORT`. Só se aplica a usuários com `OrganizationMembership` — na prática, hoje, apenas contas `TRAINER` (ver ADR-001; toda conta `TRAINER` é `OWNER` da sua própria organização pessoal no MVP).

**Regra explícita:** `OrganizationRole.ADMIN` **não equivale** a `Role.ADMIN`. Um `OrganizationRole.ADMIN` administra a organização (membros, configurações); um `Role.ADMIN` administra a plataforma inteira, entre organizações. Nenhum dos dois concede o outro automaticamente.

`ATHLETE` nunca tem `OrganizationMembership` — o vínculo do atleta com um treinador/organização é sempre via `CoachAthleteRelationship`, nunca via associação direta à organização.

## 2. Combinações de papel consideradas

| Combinação | Quem é |
|---|---|
| `SUPERADMIN` (global) | Administrador de plataforma com privilégio máximo |
| `ADMIN` (global) | Administrador de plataforma, privilégio padrão |
| `TRAINER` + `OWNER` | Dono da organização — no MVP, todo treinador é dono da sua própria organização pessoal |
| `TRAINER` + `COACH` | Treinador membro de uma organização de terceiros (Fase 6 — assessoria multiusuário) |
| `TRAINER` + `OrganizationRole.ADMIN` | Staff administrativo da organização (Fase 6) — não é necessariamente treinador ativo de nenhum atleta |
| `TRAINER` + `SUPPORT` | Suporte operacional da organização (Fase 6) — acesso mínimo, nunca a dados de saúde |
| `ATHLETE` | Atleta — sempre restrito aos próprios dados, nunca tem `OrganizationRole` |

## 3. Matriz de ações

Legenda: **Sim** = permitido · **Não** = negado · **Vinculado** = apenas para atletas com `CoachAthleteRelationship` ativo com o operador · **Próprio** = apenas o próprio recurso do usuário autenticado · **Log** = ação exige `AuditLog` mesmo quando permitida.

| Ação | SUPERADMIN | ADMIN | OWNER | COACH | Org. ADMIN | SUPPORT | ATHLETE |
|---|---|---|---|---|---|---|---|
| Criar atleta (`AthleteProfile`) | Sim (Log) | Sim (Log) | Sim | Sim | Não | Não | Não |
| Visualizar atleta | Sim (Log) | Sim (Log) | Vinculado | Vinculado | Não¹ | Não | Próprio |
| Prescrever treino | Não | Não | Vinculado | Vinculado | Não | Não | Não |
| Publicar treino | Não | Não | Vinculado (Log) | Vinculado (Log) | Não | Não | Não |
| Editar treino publicado | Não | Não | Vinculado (Log) | Vinculado (Log) | Não | Não | Não |
| Visualizar feedback | Sim (Log) | Sim (Log) | Vinculado | Vinculado | Não | Não | Próprio |
| Emitir relatório | Não | Não | Vinculado | Vinculado | Não | Não | Não² |
| Gerenciar membros da organização | Sim (Log) | Sim (Log) | Sim (Log) | Não | Sim (Log) | Não | — |
| Acessar pagamentos/faturamento | Sim (Log) | Sim (Log) | Sim (Log, próprios) | Não | Sim (Log, próprios) | Somente leitura (Log) | Próprio |
| Alterar feature flags | Sim (Log) | Não³ | Não | Não | Não | Não | Não |
| Acessar logs (`AuditLog`) | Sim | Sim (Log) | Não | Não | Não | Não | Não |
| Acessar dados sensíveis de saúde (dor, sintomas, observações de feedback) | Sim (Log, com justificativa) | Sim (Log, com justificativa) | Vinculado | Vinculado | Não | **Nunca** | Próprio |

¹ Staff administrativo de organização não vê perfil de atleta automaticamente — administrar a organização não implica ser o treinador vinculado.
² Atleta recebe relatório compartilhado pelo treinador (`Report.sharedAt`), mas não "emite" um relatório.
³ Feature flags críticas são restritas a `SUPERADMIN` (Interface Architecture v1.4 §9).

## 4. Regras mínimas (não negociáveis)

- Nenhum papel administrativo deriva de e-mail, variável de ambiente ou lista fixa — sempre atribuído explicitamente e registrado em `AuditLog` (Constitution, Decisões que devem ser recusadas; ENKY 24 §22).
- Autorização é sempre validada no backend (`server/auth/guards.ts`) — o frontend pode ocultar controles de UI, mas isso nunca é a proteção real.
- `SUPPORT` nunca acessa dados de saúde (dor, sintomas, observações de feedback, prontuário), mesmo com justificativa — a única exceção da tabela sem caminho de acesso algum.
- Acesso de `ADMIN`/`SUPERADMIN` a dados sensíveis de saúde de um atleta exige justificativa explícita e gera `AuditLog` (Interface Architecture v1.4 §9) — nunca é acesso silencioso.
- `COACH` e `OWNER` só agem sobre atletas com `CoachAthleteRelationship.isActive = true` no momento da ação — um vínculo encerrado (`endedAt` preenchido) revoga o acesso imediatamente, mesmo que o histórico permaneça no banco.
- `OrganizationRole.ADMIN` nunca herda `Role.ADMIN`, e vice-versa — são namespaces de permissão independentes.
