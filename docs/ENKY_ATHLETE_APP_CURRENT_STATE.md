# ENKY — Estado Atual do Aplicativo do Atleta (Etapa 6, §5)

> Auditoria **somente leitura** realizada antes de qualquer alteração de código.
> Base: branch `feat/athlete-mobile-app-pwa` (criada de `feat/public-marketplace-commerce`).
> Objetivo: registrar o que já existe, o que falta e como migrar sem duplicar nem quebrar o portal atual do atleta.

---

## 1. Estado atual (o que existe hoje)

### 1.1 Rotas do atleta (`app/atleta/`)

| Rota | Arquivo | O que faz |
|------|---------|-----------|
| `/atleta` | `app/atleta/page.tsx` | Lista de treinos ("Meus treinos"). |
| `/atleta/calendario` | `app/atleta/calendario/page.tsx` | Calendário. |
| `/atleta/treinos/[id]` | `app/atleta/treinos/[id]/page.tsx` | Detalhe do treino + execução guiada + feedback. |
| `/atleta/prontidao` | `app/atleta/prontidao/page.tsx` | Check-in de prontidão. |
| `/atleta/relatorios` | `app/atleta/relatorios/page.tsx` | Relatórios do atleta. |

Não existem ainda: `home` operacional dedicada (a raiz é a lista), `evolucao`, `metricas`,
`objetivos`, `avaliacoes`, `mensagens`, `biblioteca`, `perfil`, `configuracoes`.

### 1.2 Shell / navegação

- `app/atleta/layout.tsx` reutiliza o **`AppHeader` do treinador** (topo) + `AthleteBottomNav`.
- `components/athlete-bottom-nav.tsx`: bottom nav mobile-first já existe, mas com **apenas 2 itens**
  (Início, Calendário), visível só em `< sm`. O §7 pede 5 itens (Início, Calendário, Treino, Evolução, Mais).
- Padrão de UI centralizado em `app/_lib/ui.ts` (`uiClasses`), rótulos em `app/_lib/labels.ts`,
  modalidades em `app/_lib/modality.ts`. Reutilizáveis.

### 1.3 Execução guiada (hoje)

- `components/workout-execution.tsx` + estado local em `app/atleta/treinos/[id]/page.tsx`
  (`mode: "view" → "executing" → "feedback"`).
- **Efêmera e 100% client-side**: o atleta marca etapas/exercícios (`Set<string>` em memória),
  progresso e checks **não são persistidos**. Comentário no código já registra isso como dívida
  deliberada ("nothing is persisted step-by-step — that would need a schema change").
- Não há: timer, pausa/retomada persistida, descanso em musculação, registro série-a-série,
  planejado-vs-realizado, snapshot, offline.
- O único resultado persistido é o **feedback** ao concluir/abandonar.

### 1.4 APIs do atleta (`app/api/athlete/`)

| Endpoint | Existe? |
|----------|---------|
| `GET /workouts`, `GET /workouts/[id]` | ✅ |
| `POST/PATCH /workouts/[id]/feedback` | ✅ |
| `GET /calendar` | ✅ |
| `POST /readiness` | ✅ |
| `GET/POST /reports`, `GET /reports/[id]` | ✅ |
| `GET /home` | ❌ (não existe) |
| `.../execution/*`, `/offline-sync`, `/metrics`, `/progress`, `/goals`, `/messages` | ❌ |

**Padrão de segurança (bom, já isolado):** cada rota faz
`requireAuthenticatedUser()` → `requireGlobalRole(identity, ["ATHLETE"])` →
`resolveAthleteOrganization(userId)` → chama módulo (`modules/workouts/…`) escopado por
`organizationId + athleteProfileId`. Tenant + athlete isolation já garantidos nesse fluxo.
`export const dynamic = "force-dynamic"`. Erros via `apiError`/`apiSuccess` (`server/http/response`).

### 1.5 Schema relevante (`prisma/schema.prisma`)

- `enum WorkoutStatus`: `DRAFT, PUBLISHED, IN_PROGRESS (reservado), COMPLETED, PARTIAL, MISSED, ARCHIVED, CANCELLED`.
- `model Workout`: tem `lockVersion` (concorrência otimista), `plannedDate/StartAt/EndAt`, `timezone`,
  `modality`, relações para blocos/feedback. **Não** tem `workoutSnapshot` nem `version` de conteúdo.
- Árvore de conteúdo: `WorkoutBlock → WorkoutExercise / WorkoutStep`; `Exercise` (com `videoUrl`).
- `model WorkoutFeedback` (sRPE, dor, fadiga, recuperação) e `model ReadinessCheckIn` já existem.
- `WorkoutTemplate.contentSnapshot Json` já usa o padrão de **snapshot imutável** — precedente direto
  para o snapshot de execução do §19.
- **Não existem** `WorkoutExecution`, `WorkoutExecutionEvent`, nada de offline-sync, mensagens ou notificações.

### 1.6 PWA / offline

- **Nada.** Sem `manifest.webmanifest`, sem service worker, sem ícones PWA.
- `next.config.ts` sem plugin PWA. Sem `idb`/`dexie`/`workbox`/`serwist`/`next-pwa` nas dependências.

### 1.7 Módulos (`modules/`)

Existentes e reutilizáveis: `workouts, athletes, feedback, calendar, readiness, metrics, reports,
intelligence, periodization, exercises, audit, identity, organizations, trainers, templates,
marketplace*, payments, subscriptions`. **Ausentes** (a criar nesta etapa):
`workout-execution`, `offline-sync`, `athlete-notifications`, comunicação/mensagens.

---

## 2. Funcionalidades existentes (aproveitar, não recriar)

- Autenticação por sessão + guards de papel/organização/atleta (`server/auth/guards`). **Reusar.**
- `apiFetch`/`ApiClientError` (`app/_lib/api-client`), toasts (`app/_lib/toast`),
  `useRequireRole` (`app/_lib/use-session`). **Reusar.**
- `WorkoutBlocksView`, `WorkoutExecution`, `WorkoutFeedbackForm`, `ExerciseDemo`, `AthleteBottomNav`. **Evoluir.**
- Feedback + sRPE + prontidão já modelados e persistidos. **Integrar, não duplicar.**
- Snapshot imutável via JSON já é padrão aceito (`WorkoutTemplate.contentSnapshot`). **Estender ao snapshot de execução.**

---

## 3. Lacunas (gap analysis) vs. spec Etapa 6

| Área | Spec | Hoje | Gap |
|------|------|------|-----|
| Execução persistida | §10 `WorkoutExecution`/`Event` | efêmera client-side | **Modelo + migração + API** |
| Estados de treino | §9 (STARTED/PAUSED/ABANDONED…) | 8 estados, faltam intermediários | Mapear em `WorkoutExecution.status`, **não** inchar `WorkoutStatus` |
| Timer | §13 por timestamp | inexistente | **Domínio puro + UI** |
| Descanso musculação | §14 | inexistente | Novo |
| Planejado vs realizado | §15 | só prescrição | Campos `actual*` em execução/eventos |
| Offline | §16–19 | inexistente | **IndexedDB + snapshot + fila** |
| Fila de sync | §17 `modules/offline-sync` | inexistente | **Módulo novo** |
| Snapshot/versão | §18–19 | `lockVersion` só | Campo snapshot + versão na execução |
| PWA | §32–33 | inexistente | **manifest + SW + cache** |
| Home operacional | §8 | lista simples | Nova home + `GET /api/athlete/home` |
| Nav 5 itens | §7 | 2 itens | Evoluir `AthleteBottomNav` + rota "Mais" |
| Métricas/evolução/objetivos/avaliações | §25–28 | parcial (relatórios) | Rotas + APIs |
| Mensagens | §29–30 | inexistente | `Conversation/Message` (assíncrono) |
| Notificações | §31 | inexistente | Centro in-app (+ Web Push condicional) |
| Perfil/configurações | §36–39 | inexistente | Rotas |
| Telemetria/auditoria de execução | §42/§53 | parcial (`AuditLog`) | Eventos novos |

---

## 4. Proposta (foundation-first, fatias pequenas)

Ordem de implementação, cada item = 1 commit semântico:

1. **Schema** — `WorkoutExecution` + `WorkoutExecutionEvent`, campos `plannedX/actualX`,
   `workoutSnapshot Json` + `workoutVersion` na execução. Migração **aditiva**, testada em banco
   descartável, **não aplicada em produção**. `prisma validate`/`format`.
2. **Domínio puro de execução** (`modules/workout-execution/`) — state machine, cálculo de
   `elapsedSeconds`/`activeSeconds` por **timestamp** (não `setInterval`), ordenação/idempotência de
   eventos. Sem React, sem I/O. + testes.
3. **Timer** por timestamp (sobrevive a lock de tela / background) + testes + limitações documentadas.
4. **`modules/offline-sync/`** — fila com `idempotencyKey`, `status`, retry/backoff, limite de tentativas. + testes.
5. **PWA** — `manifest.webmanifest`, service worker com estratégia por rota (doc `ENKY_PWA_CACHE_STRATEGY.md`),
   update flow, **sem cache de APIs autenticadas/financeiras**, limpeza no logout.
6. **Shell mobile** — bottom nav 5 itens, rota "Mais", home operacional + `GET /api/athlete/home`.
7. **API de execução** — start/events/pause/resume/complete/abandon, ligada ao modelo, com Zod + idempotência + auditoria.
8. **Feature-by-feature** — descanso musculação, planejado-vs-realizado na UI, métricas/evolução/objetivos/avaliações,
   mensagens assíncronas, notificações in-app.
9. **Docs + ADRs** (§60) e validação completa (§59).

**Princípio anti-duplicação:** reusar `WorkoutStatus`, guards de auth, `apiFetch`, snapshot-JSON,
feedback/prontidão existentes. Estados intermediários de execução vivem em `WorkoutExecution.status`,
não em novos enums de `Workout`.

---

## 5. Riscos

**Técnicos**
- Timer/execução em background: browsers limitam JS em aba oculta → precisão por timestamp, não por tick. Documentar teto.
- Service worker vazar respostas autenticadas/de outro atleta se cache mal configurado (§33). Mitigar com Network-First e allowlist estrita.
- Migração aditiva grande; risco de índice/constraint. Testar em banco descartável.
- Conflito de sync: treino alterado pelo treinador durante execução offline → snapshot imutável por execução (§18–19).
- Múltiplos dispositivos: duas execuções ativas concorrentes (§45).

**Privacidade**
- Dados de dor/saúde e conteúdo de mensagens **não** podem ir para analytics/logs (§42/§53).
- Cache local deve excluir dados financeiros, de outros atletas e credenciais (§35). Limpar no logout.

**Produto**
- Não reproduzir a complexidade do painel do treinador; home enxuta (§8).

---

## 6. Itens fora do escopo (§4) — não implementar nesta etapa

React Native / app nativo, publicação App Store/Play Store, Apple Watch/Wear OS, GPS completo,
Bluetooth/sensores, Garmin/Polar/Coros, chat em tempo real (WebSockets), chamadas de vídeo, rede
social/feed público, gamificação com premiação financeira, diagnóstico/recomendação clínica automática.

---

## 7. Plano de migração da interface atual

1. **Execução efêmera → persistida:** manter `WorkoutExecution` (componente) como UI, mas ligá-lo ao
   novo `WorkoutExecution` (modelo) via API; o estado local de checks passa a emitir eventos
   (`STEP_COMPLETED`), com fila offline como buffer. A transição `view→executing→feedback` é preservada.
2. **Layout do atleta:** remover dependência do `AppHeader` do treinador; introduzir shell mobile próprio
   (header enxuto + bottom nav 5 itens). Rotas atuais continuam funcionando durante a transição.
3. **Feedback/prontidão:** permanecem como estão; passam a ser itens sincronizáveis pela fila offline.
4. **Home:** a raiz `/atleta` (lista) evolui para home operacional; a lista de treinos vira uma seção.
5. **Sem migração destrutiva:** todo o schema novo é aditivo; treinos existentes seguem válidos sem snapshot
   (snapshot só é gerado quando uma execução inicia).

---

## 8. Regras de guarda respeitadas nesta etapa

Sem merge em `main`; sem promoção a Production; sem migration em produção; sem `migrate reset` /
`db push --force-reset`; sem `push --force`; banco de staging/descartável; tenant + athlete isolation
preservados; regras de negócio fora de componentes React; commits pequenos; testes antes da entrega.
