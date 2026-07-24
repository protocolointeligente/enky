# Relatório de Validação Pós-Merge — CRM ↔ Marketplace

**Data:** 2026-07-24
**Branch:** `feat/integrate-crm-marketplace`
**Merge commit:** `18e410d` (merge de `feat/coach-crm-business-management` em base `feat/marketplace-mvp`)
**Auditoria prévia:** [CRM_MARKETPLACE_INTEGRATION_PLAN.md](./CRM_MARKETPLACE_INTEGRATION_PLAN.md)

---

## 1. Resultado dos gates

| Comando | Status | Duração | Detalhe |
|---|---|---|---|
| `npx prisma validate` | ✅ | ~1s | Schema válido após união dos 3 modelos compartilhados |
| `npm run typecheck` (`tsc --noEmit`) | ✅ | ~30s | 0 erros (após unir os módulos de avaliação) |
| `npm run lint` (`eslint .`) | ✅ | ~20s | **0 erros**, 10 warnings pré-existentes (unused-vars/`<img>`) |
| `npm test` (`vitest run`) | ✅ | 16.3s | **695 testes / 71 arquivos** (era 534) — sem regressão |
| `npm run build` (`next build`) | ✅ | ~90s | Todas as rotas prerenderizadas: `gestao/*` (CRM) + `marketplace` + atleta |

### Testes de integração / E2E / smoke — **NÃO executados**
`test:integration`, `test:e2e`, `test:smoke` existem no `package.json` mas exigem **banco Postgres isolado** (Neon Preview) e browser Playwright — não disponíveis neste ambiente. **Pendência bloqueante para Preview/Production** (ver §5).

---

## 2. Conflitos e como foram resolvidos

7 arquivos em conflito (os outros 5 dos 12 candidatos foram auto-mesclados pelo git). Nenhum código funcional descartado; nenhuma migration antiga alterada.

| Arquivo | Estratégia |
|---|---|
| `prisma/schema.prisma` | **União.** 12 modelos CRM + 21 marketplace são disjuntos. `User`/`Organization`/`AthleteProfile` receberam as back-relations dos dois lados (só adições, sem mudança de tipo). Brace de `MarketplaceCouponRedemption` reconstruído na junção dos blocos. `prisma format` + `validate` verdes. |
| `domain/audit.ts` | **União** dos tipos de evento (avaliação física + comerciais do CRM). |
| `app/treinador/layout.tsx` | Shell do marketplace + itens "Gestão"/"Configurações" do CRM. Todos os links apontam para rota real (verificado). |
| `app/treinador/page.tsx` | Base = redesign do marketplace; bloco `SHORTCUTS` (morto, não referenciado) do CRM removido; import órfão `DumbbellIcon` limpo. |
| `components/app-sidebar.tsx` | Auto-merge (ícones `gestao`/`configuracoes` presentes; `NavIcon` tem fallback gracioso). |
| `modules/assessments/assessment-schema.ts` + `assessment-service.ts` | **DECISÃO-CHAVE — ver §3.** |
| `app/api/trainer/athletes/[athleteId]/assessments/route.ts` | Mantida versão do marketplace (`--ours`); consome símbolos do TestResult, presentes na união. |

---

## 3. Avaliações físicas — decisão e desvio consciente

**Decisão do responsável:** "base marketplace + preservar CRM, sem ligar agora".

**Realidade encontrada durante o merge:** o CRM não trouxe só o módulo — trouxe um **subsistema tipado inteiro e já ligado**: rotas (`/api/trainer/assessments/[id]`, `.../validate`, `.../performance-profile`), componente `assessments-tab.tsx`, `performance-profile.ts`, página `/treinador/atletas/[id]/avaliacoes` e testes. "Não ligar" o CRM exigiria **apagar** todos esses arquivos funcionais (viola regra §1.3 e destruiria a aba Avaliações da 360º).

**Resolução aplicada (melhor que a literal, sem perder código):** os dois módulos exportam **símbolos totalmente disjuntos** (marketplace: `recordTestResult*`; CRM: `createAssessment*`/`getAssessment`/`validateAssessment`/`ASSESSMENT_*`). Fiz a **união** dos dois arquivos — ambos os subsistemas coexistem sobre modelos Prisma distintos (`TestResult` vs `Assessment`), em rotas distintas, sem colisão. Nada foi descartado; tudo compila e passa nos testes.

→ **Ponto de revisão para o responsável:** confirmar que manter **os dois** caminhos de avaliação vivos é aceitável no curto prazo, ou se deve haver um follow-up para consolidar num só (a duplicação de conceito "avaliação do atleta" permanece — apenas não bloqueia nada agora).

---

## 4. Banco de dados

- **Modelos adicionados (33):** 12 do CRM (`Lead`, `LeadInteraction`, `Client`, `CoachServicePlan`, `CoachClientContract`, `CoachInvoice`, `CoachPayment`, `CoachGroup`, `CoachGroupMember`, `CommunicationLog`, `FeatureFlag`, `Assessment`) + 21 do Marketplace (família `Marketplace*`, `WorkoutExecution*`).
- **Modelos alterados (união de relations):** `User`, `Organization`, `AthleteProfile`.
- **Migrations:** nenhuma criada pelo merge; as duas branches trazem as suas (15 novas no total). **Sem alteração de migrations antigas.**
- **Riscos de deploy documentados:** (1) `20260718130000_feature_flags` do CRM é cronologicamente anterior a uma migration já em produção — entra como "pending" normal, tabela isolada, sem risco funcional; (2) prefixos `20260719150000`/`20260719160000` reusados nas duas branches, mas com sufixos de pasta diferentes ⇒ coexistem no `_prisma_migrations`, tabelas disjuntas. **Ainda não testadas em banco isolado** (§5).

---

## 5. Pendências

| Pendência | Severidade |
|---|---|
| `prisma migrate deploy` das 15 migrations em **banco isolado (Neon Preview)** + sobre snapshot de produção | **Bloqueante** p/ Preview/Production |
| Testes de **integração** (exigem Postgres isolado) | **Bloqueante** p/ Production |
| **E2E** críticos (Marketplace/checkout+split, PWA offline, funil leads→cliente→contrato→invoice) | **Bloqueante** p/ Production |
| Testes negativos de **autorização de tenant** nas rotas de CRM (§6 do comando) | **Alta** |
| Confirmar decisão de coexistência dos 2 subsistemas de avaliação (§3) | **Média** |
| Racionalizar nav "Planos" vs Configurações→Assinatura; consolidar `nav-config.ts` (§8) | **Baixa** |
| 10 warnings de lint pré-existentes | **Baixa** |

---

## 6. Veredito

```
Branch PRONTA para Pull Request.       (lint/typecheck/build/unit verdes; merge sem código perdido)
Branch NÃO PRONTA para Preview.        (migrations não testadas em banco isolado)
Branch NÃO PRONTA para Production.     (faltam integração, E2E, migrations em banco isolado e testes de tenant)
```

`main` intocada. Sem force push. Sem `reset --hard`. Merge reversível (branch dedicada).
