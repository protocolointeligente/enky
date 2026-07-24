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

### Fase B — avaliação física do atleta ✅
- ✅ Registrar/listar/apagar avaliações (`modules/assessments` sobre `TestResult`; sem migração; auditado).
- ✅ **Zonas padrão da indústria:** potência (Coggan %FTP), FC (Friel %LTHR), pace corrida (s/km) e natação/CSS (s/100m, input mm:ss). Derivadas na leitura.
- Pendente (menor): validade/reavaliação, edição de avaliação.

### Fase C — métricas (paridade intervals.icu/TrainingPeaks) + resto do app atleta (em andamento)
- ✅ **Slice 1:** `computePmcSeries` — série CTL/ATL/TSB do PMC (a matemática de carga já existia em `computeLoadState`).
- Pendente: agregar sRPE diário real (feedback/execução/Strava) → série; página `/atleta/metricas` com gráfico do PMC + tiles; TSS/IF, curva de potência, PRs; depois telas objetivos/mensagens/notificações/perfil/config; modalidades de execução; ícones PWA/Lighthouse/a11y.

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
