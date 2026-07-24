# Plano de Integração — CRM ↔ Marketplace

**Data:** 2026-07-24
**Branch de integração:** `feat/integrate-crm-marketplace` (criada a partir de `feat/marketplace-mvp`)
**Branches de origem:**
- `feat/marketplace-mvp` (estável / rumo à produção) — alvo do merge
- `feat/coach-crm-business-management` (a integrar)
- **merge-base:** `70b05ff`

> Status: **auditoria concluída, merge NÃO iniciado.** Existe **1 decisão bloqueante** (§B) que precisa de aprovação antes do merge dos módulos de avaliação.

---

## 1. Números da divergência

| Métrica | Valor |
|---|---|
| Arquivos alterados em `marketplace` desde a base | 116 |
| Arquivos alterados em `crm` desde a base | 222 |
| **Arquivos alterados nas DUAS branches (candidatos a conflito)** | **12** |
| Dependências novas/removidas (qualquer lado) | **0** (package.json de deps idêntico à base nos dois) |
| Modelos Prisma só no CRM | 12 |
| Modelos Prisma só no Marketplace | 21 |
| Modelos Prisma compartilhados alterados nos dois lados | **3** (`User`, `Organization`, `AthleteProfile`) |

**Leitura:** a superfície de conflito é pequena (12 arquivos). O grosso das 222 mudanças do CRM são **arquivos novos** que não colidem. O risco concentra-se em 3 clusters (§A–§C) + migrations (§D).

---

## 2. Matriz de conflitos (os 12 arquivos que colidem)

| Arquivo | mkt (+/−) | crm (+/−) | Cluster | Risco | Estratégia |
|---|---|---|---|---|---|
| `prisma/schema.prisma` | grande | grande | A | **Médio** | União de adições (ver §A) |
| `modules/assessments/assessment-schema.ts` | 16/0 | 188/0 | **B** | **ALTO — bloqueante** | Decisão de produto (§B) |
| `modules/assessments/assessment-service.ts` | 120/0 | 157/0 | **B** | **ALTO — bloqueante** | Decisão de produto (§B) |
| `app/api/trainer/athletes/[athleteId]/assessments/route.ts` | 69/0 | 73/0 | **B** | **ALTO — bloqueante** | Decisão de produto (§B) |
| `app/treinador/page.tsx` | 170/68 | 1/0 | C | Médio | Base = marketplace; enxertar item de nav do CRM |
| `components/app-sidebar.tsx` | 130/126 | 9/3 | C | Médio | Base = redesign marketplace; enxertar seção "Negócio" |
| `app/treinador/layout.tsx` | 14/11 | 6/1 | C | Baixo | União |
| `app/treinador/atletas/[id]/page.tsx` | 42/19 | 7/9 | C | Baixo | União (abas) |
| `domain/audit.ts` | 8/1 | 45/1 | D | Baixo | União de tipos de evento |
| `server/security/rate-limit.ts` | 1/0 | 2/0 | D | Baixo | União de buckets |
| `modules/intelligence/load-state.ts` | 27/0 | 6/3 | D | Baixo | União |
| `scripts/migrate-on-deploy.cjs` | 1/0 | 1/0 | D | Trivial | União (ajuste de lint) |

---

## Cluster A — `prisma/schema.prisma` (Risco: Médio, mecânico)

**Modelos novos (disjuntos, sem colisão de nomes):**
- **CRM (12):** `Lead`, `LeadInteraction`, `Client`, `CoachServicePlan`, `CoachClientContract`, `CoachInvoice`, `CoachPayment`, `CoachGroup`, `CoachGroupMember`, `CommunicationLog`, `FeatureFlag`, `Assessment`.
- **Marketplace (21):** família `Marketplace*` (Product/Order/Cart/Entitlement/LedgerEntry/SellerProfile/SellerBalance/CommissionRule/Coupon/Review…), `WorkoutExecution`, `WorkoutExecutionEvent`.

**Modelos compartilhados alterados nos dois lados — os únicos pontos de merge cirúrgico:**
`User`, `Organization`, `AthleteProfile`. Verificado: **as duas branches só ADICIONAM back-relations e enums novos** (ex.: CRM adiciona `leads`, `clients`, `contracts`, `assessments`; marketplace adiciona relations de `Marketplace*` e enums de execução). **Nenhuma mudança de tipo de campo, nenhuma remoção.**

**Estratégia:** resolução por **união** — manter as adições dos dois lados nos 3 modelos e concatenar os blocos de modelos/enums novos. Conflitos serão apenas textuais (linhas inseridas na mesma região do arquivo), não semânticos.

**Regras respeitadas:** nenhum campo usado pela branch estável é removido; sem `float` para dinheiro (validar que `Coach*`/`Marketplace*` usam `Decimal`/inteiro em centavos — checar no §5 da execução); IDs imutáveis; `organizationId`/`coachId` presentes nas entidades de CRM.

---

## Cluster B — Módulo de avaliações (Risco: **ALTO — DECISÃO BLOQUEANTE**)

Os 3 arquivos de `modules/assessments/` + a rota são **add/add**: não existiam na base; **cada branch construiu sua própria implementação de "avaliação física do atleta"**. São o **mesmo conceito de domínio, com arquiteturas diferentes:**

| | Marketplace (`feat/marketplace-mvp`) | CRM (`feat/coach-crm-business-management`) |
|---|---|---|
| Modelo Prisma | Reusa **`TestResult`** (já existia na base) | Cria **`Assessment`** novo |
| Forma dos dados | `testType` texto livre + `resultValue`+`unit` + `calculatedMetrics` (JSON) | Medições **tipadas por modalidade** (HEART_RATE/RUNNING/CYCLING/SWIMMING/STRENGTH/BODY_COMPOSITION), Zod `.strict()`, unidades declaradas, `source`/`confidence` |
| Zonas | Coggan (FTP) / Friel (LTHR) / pace / CSS — **entregue e em produção** | "Motor puro de zonas" (fatia C) sobre o `Assessment` tipado |
| Maturidade | **Produção-proven** (branch estável, é a fundação do PMC/§10) | Mais rica e tipada, **não validada em produção** |

**Por que é bloqueante:** escolher uma implementação e descartar a outra viola a regra §1.3 ("não apague código funcional") e §1.13 ("não substitua módulos maduros por simplificados"). As duas são funcionais. A escolha tem consequência de schema (manter ou não o modelo `Assessment`) e de qual motor de zonas alimenta o PMC.

**Recomendação (a confirmar com o responsável):**
1. **Base = implementação do marketplace** (`TestResult` + zonas Coggan/Friel/pace/CSS), por ser a fundação **em produção** e o alvo do merge (prioridade §1: estabilidade/banco acima de CRM).
2. **Preservar** a implementação tipada do CRM **sem apagá-la** — manter o modelo `Assessment` no schema e o código do CRM sob caminho paralelo (ex.: `modules/assessments/typed/`), como candidato a evolução, **sem** ligá-lo à mesma rota agora. Nenhum código funcional é perdido.
3. Follow-up dedicado decide se o motor tipado do CRM substitui/estende o do marketplace — fora do escopo deste merge.

→ **Aguardando decisão antes de resolver estes 3 arquivos.**

---

## Cluster C — Navegação do treinador (Risco: Médio)

Marketplace fez o **redesign responsivo completo** (`page.tsx` 170/68, `app-sidebar.tsx` 130/126: Command Center, bottom nav, drawer, sidebar md). CRM fez reorg mais leve + adicionou a seção **"Gestão/Negócio"** (Leads, Clientes, Contratos, Cobranças, Grupos, Importações, Relatórios).

**Estratégia:** base = shell redesenhado do marketplace (é o mais novo e é a UX de produção); **enxertar** os itens de nav "Negócio" do CRM dentro dele. Alinha com a estrutura de nav pedida no §8 do comando. Sem duplicar páginas.

---

## Cluster D — Infra transversal (Risco: Baixo, aditivo)

- `domain/audit.ts` — CRM adiciona ~45 linhas (novos tipos de evento de auditoria de CRM). **União.**
- `server/security/rate-limit.ts` — os dois adicionam buckets (+1/+2). **União** — não enfraquecer limites existentes (§1.10).
- `modules/intelligence/load-state.ts` — marketplace +27 (série PMC), CRM +6/−3. **União**, revisar as 3 linhas removidas pelo CRM.
- `scripts/migrate-on-deploy.cjs` — ajuste de convenção de lint idêntico. **União trivial.**

---

## Cluster D-mig — Migrations (Risco: Médio — atenção no deploy)

Base comum até `20260718140000_workout_roster_index`. Depois divergem (nenhuma migration antiga é alterada — §1.6/§1.7 respeitadas):

**Marketplace adiciona:** `20260719150000_marketplace_public_commerce`, `20260719160000_athlete_workout_execution`, `20260722120000_marketplace_seller_asaas_wallet`.

**CRM adiciona:** `20260718130000_feature_flags`, `20260718150000_athlete_assessments`, `20260718160000_workout_exercise_metadata`, `20260718170000_periodization_strategy_rationale`, `20260719120000_org_foundation_roles`, `20260719130000_crm_leads`, `20260719140000_clients`, `20260719150000_coach_service_plans`, `20260719160000_coach_contracts`, `20260719170000_coach_invoices_payments`, `20260719180000_coach_team_groups`, `20260719190000_communications`.

**Achados:**
1. **Colisão de timestamp (não de pasta):** `20260719150000` e `20260719160000` existem nos dois lados com **sufixos diferentes** (`coach_service_plans`/`marketplace_public_commerce` e `coach_contracts`/`athlete_workout_execution`). Como o Prisma rastreia por **nome completo da pasta**, não há colisão real no `_prisma_migrations` — as quatro pastas coexistem. Ordem de aplicação é lexicográfica pelo nome completo (`coach_*` antes de `marketplace_*`/`athlete_*`). Tabelas disjuntas ⇒ sem dependência ⇒ ordem irrelevante.
2. **Migration fora de ordem cronológica:** `20260718130000_feature_flags` (CRM) tem timestamp **anterior** a `20260718140000_workout_roster_index` (já na base/produção). O Prisma aplica qualquer pasta ausente do `_prisma_migrations` independentemente da ordem cronológica — então em produção ela entra como "pending" normal. Sem risco funcional (tabela `FeatureFlag` isolada), mas **documentar**.
3. **Ação:** confirmar o conjunto já aplicado em produção (`main`) antes do deploy. Testar `prisma migrate deploy` em **banco isolado** (Neon Preview) — nunca produção (§1.9). Nenhuma migration nova precisa ser criada pelo merge em si (as duas trazem as suas); migration nova só se o §5 da execução exigir constraint/índice composto adicional.

---

## 3. Ordem de integração recomendada

1. **[BLOQUEIO]** Decidir Cluster B (avaliações). ← *estamos aqui*
2. `git merge --no-commit --no-ff feat/coach-crm-business-management`.
3. Resolver Cluster A (schema, união) → `prisma validate` + `prisma format`.
4. Resolver Cluster D + D-mig (infra/migrations, união).
5. Resolver Cluster C (navegação).
6. Resolver Cluster B conforme decisão.
7. `npm install && npm run lint && npm run typecheck && npm test && npm run build`.
8. Testar migrations em Neon Preview isolado.
9. Testes negativos de tenant nas rotas de CRM (§6 do comando).
10. Commits pequenos por cluster (`feat(db): unify…`, `fix(security): enforce tenant…`, etc.).

---

## 4. Testes necessários (pós-merge)

- Schema: `prisma validate` verde.
- Unit: suíte atual (marketplace tinha 534) **sem regressão** + testes do CRM que só existiam na outra branch.
- Tenant negativo: treinador A × dados de B; org A × org B; atleta × CRM; treinador sem permissão financeira × invoice; não-autenticado × rota protegida; ID válido de outro tenant.
- Integração de migrations em banco isolado.
- Smoke/E2E críticos: Marketplace (checkout + split 90/10), PWA offline, fluxo de leads→cliente→contrato→invoice.

## 5. Critérios de aceite do merge

- [ ] Nenhum código funcional perdido (Cluster B resolvido sem deletar implementação).
- [ ] `prisma validate` verde; 3 modelos compartilhados com união das relations.
- [ ] lint / typecheck / build / unit verdes, sem regressão vs. 534.
- [ ] Migrations aplicam em banco isolado limpo e sobre snapshot de produção.
- [ ] Split Asaas 90/10 e PWA offline intactos.
- [ ] Rotas de CRM com autorização de tenant no servidor + testes negativos.

## 6. Plano de rollback

- Merge em branch dedicada (`feat/integrate-crm-marketplace`); `main` intocada (§1.1).
- Merge com `--no-commit` → se a resolução ficar inconsistente, `git merge --abort` volta ao estado limpo.
- Sem force push (§1.2), sem `reset --hard` (§1.5).
- Migrations testadas em Neon Preview antes de qualquer deploy; produção não é tocada nesta etapa.
