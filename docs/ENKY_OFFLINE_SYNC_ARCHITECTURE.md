# ENKY — Arquitetura de Execução Offline e Sincronização (Etapa 6, §16-18)

Fluxo end-to-end de execução de treino offline-first. Ver também
[ADR-006](adr/ADR-006-athlete-execution-and-pwa-foundation.md).

## Camadas

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| Política pura | `modules/offline-sync/sync-queue.ts` | Idempotência, backoff, seleção do vencido, transições. Sem IO. |
| Domínio puro | `modules/workout-execution/execution-state.ts` | State machine + tempo por timestamp. Sem IO. |
| Store local | `app/_lib/idb.ts` | IndexedDB nativo (stores `sync-queue` e `executions`). |
| Cliente | `app/atleta/_lib/execution-client.ts` | Orquestra store + política + APIs. Glue de browser. |
| Timer | `components/use-execution-timer.ts` | Re-render 1s; número sempre de `computeTime`. |
| API | `app/api/athlete/workouts/[id]/execution/start`, `.../executions/[id]/events` | Persistência servidor. |

## Fluxo

```
Iniciar treino
  → startExecution(): cria LocalExecution no IndexedDB (com START local p/ timer)
  → enfileira EXECUTION_STARTED
  → flush() → POST /execution/start → grava serverId na execução local

Marcar etapa / concluir / abandonar
  → recordEvent(): anexa evento local + enfileira EXECUTION_EVENT
  → flush() → POST /executions/{serverId}/events

Offline
  → flush() vê navigator.onLine === false e não faz nada; itens ficam PENDING
  → window 'online' → flush() automático
  → EXECUTION_EVENT depende do serverId; enquanto o start não sincroniza,
    o item retorna TRANSIENT e espera (o start foi enfileirado antes → vai primeiro)
```

## Idempotência (§17)

- `idempotencyKey` (uuid do cliente) em cada item e cada evento.
- `enqueue` puro dedupe por chave → não duplica ao reenviar.
- Servidor: `createMany skipDuplicates` + `idempotencyKey @unique` → evento repetido é ignorado.
- `start` reenviado retorna a mesma execução (execução ativa única + unique key).

## Tempo (§13)

- Cliente e servidor derivam `elapsed/active` de timestamps, nunca de tick.
- O endpoint `/start` não insere evento START; o servidor **sintetiza** um START
  ancorado em `WorkoutExecution.startedAt` antes de reduzir (ver `append-events.ts`).
- O cliente mantém um START local só para alimentar o cronômetro.

## Conflito (§18)

- Erro do servidor com código não-transitório → item vira `CONFLICT` (não re-tenta),
  sobe para a UI. Erros transitórios (rede, 5xx, rate limit, auth) → retry com backoff.
- Snapshot imutável por execução garante que alteração do treinador não corrompe
  uma execução iniciada.

## Limpeza (§35)

Logout → `clearAppCaches()` apaga caches do SW **e** o IndexedDB (`idbDeleteDatabase`).

## Limitações / pendências

- Sem cache offline do **detalhe do treino** ainda: iniciar exige ter aberto o
  treino online ao menos uma vez na sessão (o snapshot do servidor é congelado no
  start, mas o cliente hoje parte dos `blocks` já carregados). Cachear o detalhe em
  IndexedDB para início 100% offline é a próxima evolução.
- Verificação de runtime (Playwright offline, §57) é manual/CI — não roda headless aqui.
- Descanso de musculação e execução por modalidade (§12/§14) são fatia à parte.
