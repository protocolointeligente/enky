# ADR-006 — App do atleta: execução, offline e PWA (Etapa 6, fundação)

**Status:** Aceito (fundação: schema + domínio + API de execução + PWA; UI e demais telas em fatias seguintes)
**Data:** Etapa 6 — App do Atleta Mobile-First, primeiras fatias (auditoria + fundação).
**Contexto:** a auditoria (`docs/ENKY_ATHLETE_APP_CURRENT_STATE.md`) confirmou que a execução do treino era efêmera e 100% client-side (checks em `Set` na memória, nada persistido), sem timer, offline, PWA ou modelo de execução. Esta ADR registra as decisões da fundação.

## Decisões

### 1. PWA antes de app nativo
Entregar como Progressive Web App (manifest + service worker próprios), sem React Native/Flutter (fora de escopo, §4). Arquitetura preparada para empacotamento futuro, mas nada de nativo agora. Service worker é **hand-written**, sem `next-pwa`/`serwist`: a estratégia de cache é crítica de segurança (§33) e um plugin tenderia a fazer precache cego de rotas autenticadas.

### 2. Execução é uma entidade nova, não um novo `WorkoutStatus`
`WorkoutExecution` = uma tentativa do atleta. Os estados "intermediários" do §9 (`STARTED`/`PAUSED`/`PARTIALLY_COMPLETED`/`ABANDONED`) vivem em `WorkoutExecutionStatus`, **não** inflam `WorkoutStatus` (que continua sendo a prescrição). O fluxo de execução **não altera** `Workout.status` — o feedback segue como fonte da verdade do estado do treino, evitando dupla escrita e o campo minado de visibilidade (`IN_PROGRESS` não é athlete-visible em `getAthleteWorkout`).

### 3. Snapshot imutável + versão por execução (§18-19)
Ao iniciar, congela-se `workoutSnapshot` (cópia JSON plana via `JSON.parse(JSON.stringify(...))`, resolvendo Date/Decimal) + `workoutVersion = Workout.lockVersion`. Alteração posterior do treinador **não** corrompe uma execução em andamento. Mesmo padrão já aceito em `WorkoutTemplate.contentSnapshot` (ADR-005 §3 usa a mesma ideia). Snapshot mora na execução, não no `Workout` — migração 100% aditiva (2 enums + 2 tabelas, sem `ALTER`).

### 4. Tudo é evento; sem 6 rotas quase-idênticas
`WorkoutExecutionEvent` é um log append-only. `PAUSE`/`RESUME`/`STEP_COMPLETED`/`COMPLETE`/`ABANDON` são **tipos de evento** por um único endpoint `POST /executions/[id]/events`; o status é **derivado** pela redução pura (`modules/workout-execution/execution-state.ts`). Só `start` tem rota própria (cria execução + snapshot). Isso substitui as rotas separadas pause/resume/complete/abandon do brief por sugar opcional futuro.

### 5. Tempo por timestamp, não por tick (§13)
`elapsedSeconds`/`activeSeconds` são recalculados a partir do `occurredAt` dos eventos, nunca de `setInterval`. Sobrevive a lock de tela e background (que congelam timers, não timestamps). Lógica pura e testada, `now` injetado. **Limitação documentada:** o navegador limita JS em aba oculta — a exibição ao vivo pode "pular" ao voltar, mas o número exibido vem sempre do timestamp, então se autocorrige. Sem promessa de cronômetro profissional.

### 6. Offline: IndexedDB no app, nunca no cache do SW
Dados offline (snapshot, progresso, feedback pendente) vivem em IndexedDB no nível do app; o service worker **nunca** cacheia `/api/*` (evita vazar respostas autenticadas entre atletas num aparelho compartilhado, §33). A política pura da fila (`modules/offline-sync/sync-queue.ts`) já existe (idempotência, backoff, CONFLICT); o adapter IndexedDB + loop de envio entram com a UI de execução offline.

### 7. Sincronização idempotente (§17)
`idempotencyKey` único em `WorkoutExecution` e `WorkoutExecutionEvent`. `start` reenviado retorna a mesma execução; eventos reenviados são ignorados (`createMany skipDuplicates`); eventos após terminal não reabrem a execução (a redução ignora-os). Enfileiramento dedupe por chave impede feedback/conclusão duplicados.

### 8. Múltiplos dispositivos (§45)
Invariante de execução ativa única: iniciar quando já há execução `STARTED`/`PAUSED` retorna a existente — dois aparelhos veem a mesma tentativa em vez de criar concorrentes. Sem bloqueio permanente por aparelho perdido.

### 9. Cache autenticado e logout (§33/§52)
`/api/*` nunca cacheado. `clearAppCaches()` no logout manda `CLEAR_CACHE` ao SW e apaga caches — não deixar rastro no aparelho. Update do SW **não** força reload (não interromper treino); aplica ao reabrir.

## Consequências / pendências
- Migração `20260719160000_athlete_workout_execution` é **aditiva** e **não foi aplicada** a nenhum banco — operador aplica em staging/descartável antes de qualquer deploy.
- Ícones do manifest reaproveitam `enky-app-icon.png`; gerar 192/512 + maskable exatos antes da homologação.
- Adapter IndexedDB da fila, UI de execução por modalidade, descanso de musculação, hook `useExecutionTimer`, e demais telas (home, evolução, métricas, objetivos, avaliações, mensagens, notificações) são fatias seguintes.
- Auditoria de execução registra só `START` + terminal (evita volume excessivo, §10/§53); `PAUSE`/`RESUME` não são auditados.
