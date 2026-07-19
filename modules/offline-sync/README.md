# modules/offline-sync

Fila de sincronização offline do app do atleta (Etapa 6, §17). Ver [ADR-006 §6-7](../../docs/adr/ADR-006-athlete-execution-and-pwa-foundation.md).

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `sync-queue.ts` | **Política pura** da fila (sem IndexedDB/fetch/`Date.now`): `enqueue` idempotente, `backoffMs` exponencial com teto, `isDue`/`nextBatch` (seleção do vencido), `applyResult` (transições incl. `CONFLICT` terminal e `FAILED` ao esgotar), `pendingCount`. |

## Itens

`EXECUTION_STARTED | EXECUTION_EVENT | FEEDBACK_SUBMITTED | READINESS_SUBMITTED | NOTE_CREATED`,
cada um com `idempotencyKey` (o servidor deduplica). Status: `PENDING → SYNCING → SYNCED | FAILED | CONFLICT`.

## Garantias

- **Não duplica** feedback/conclusão: `enqueue` ignora chave já presente e não esgotada.
- **Retry/backoff/limite**: `backoffMs(attempt)` até 5min; `MAX_ATTEMPTS` para de tentar.
- **Conflito** sobe para a UI resolver (§18), não é retentado.

## Testes

`tests/unit/modules/offline-sync/sync-queue.test.ts`.

## Pendências (fatia da UI de execução offline)

Adapter IndexedDB (store versionado), loop de envio, e limpeza no logout. A política
aqui é agnóstica de storage — o adapter só persiste e chama estas funções.
