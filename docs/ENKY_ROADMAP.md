# ENKY — Roadmap para conclusão

> Estado consolidado em 2026-07-22. Fonte de verdade viva; atualizar ao concluir fases.

## Estado atual (produção, `main`)

**Núcleo sólido:** identidade/auth, organizações + tenant isolation, exercícios,
templates, periodização (motor + UI), treinos (criar/editar/calendário),
feedback/RPE/sRPE, prontidão, inteligência (contexto/insights), relatórios,
assinatura B2B (Asaas), integrações Strava.

**Etapa 6 — app do atleta (parcial ~55%):** shell mobile + bottom nav, PWA
instalável + service worker, home operacional, calendário, detalhe do treino,
execução guiada offline-first (musculação série-a-série + checklist genérico),
timers por timestamp, fila de sync idempotente, snapshot de treino, feedback e
prontidão.

**Etapa 5 — marketplace (MVP + parte da fatia B, branch `feat/marketplace-mvp`,
PR #2 não mergeado):** catálogo público, checkout, webhook, entrega (entitlement),
biblioteca do comprador, painel do vendedor, gateway Asaas split 90/10.

## Gaps confirmados

| Área | Estado |
|---|---|
| Avaliação física do atleta | **Não existe** (sem `modules/assessments`, sem zonas, sem telas) |
| CRM da assessoria | **Não existe em `main`**; código na branch `feat/coach-crm-business-management` (não mergeada) |
| Superadmin | Painéis + ativar/suspender; falta planos/billing, impersonação, moderação, reembolsos, métricas de negócio |
| Periodização | Sem botão voltar na edição de treino |
| App atleta | Faltam: métricas, objetivos, avaliações, mensagens, notificações, biblioteca integrada, perfil, configurações |
| Execução por modalidade | Só musculação tem view própria; corrida/ciclismo/natação/funcional/triatlo no checklist genérico |

## Roadmap (ordem de execução acordada)

### Fase A — fechar fatia B do marketplace ✅ (execução da entrega + biblioteca)
- ✅ Execução da entrega: comprador treinador recebe cópia dos templates comprados; atleta puro fica com o entitlement (read-only). Decisão de modelo tomada.
- ✅ `/atleta/biblioteca` integrada ao shell do atleta.
- Pendente: merge do PR #2 (aguarda decisão de gating). Fora do plano do atleta: payouts, moderação, avaliações de produto, cupons, carrinho, busca, seed, agendamento de plano no calendário.

### Fase B — avaliação física do atleta (em andamento)
- ✅ **Slice 1:** `modules/assessments` sobre o `TestResult` existente — registrar/listar/apagar; `/treinador/atletas/[id]/avaliacoes` + `/atleta/avaliacoes`; auditado; sem migração.
- Pendente: cálculo de zonas (pace/FC/potência) a partir dos testes — **precisa decidir o esquema de zonas**; validade/reavaliação; edição.

### Fase C — completar o app do atleta (Etapa 6)
- Telas: métricas (§25), objetivos (§27), mensagens (§29-30), notificações in-app
  (§31), perfil (§36), configurações (§37).
- Modalidades de execução (corrida/ciclismo/natação/funcional/triatlo, §12).
- Ícones PWA 192/512, Lighthouse, testes de acessibilidade.

### Fase D — CRM da assessoria
- Auditar e recuperar/mergear `feat/coach-crm-business-management` (tem UI de
  gestão/grupos/LGPD) ou reconstruir sobre `main`.

### Fase E — superadmin de verdade
- Gestão de planos/billing, impersonação auditada, moderação do marketplace,
  reembolsos, métricas de negócio.

### Fase F — polimento/UX
- Botão voltar na edição de periodização + navegação; estados vazios; resiliência.

## Regras
- Não mergear em `main` nem promover para produção sem decisão explícita.
- Migrações só aditivas; operador aplica em produção. Staging está defasado do
  schema — não aplicar `migrate diff` cru, só migrações aditivas manuais.
