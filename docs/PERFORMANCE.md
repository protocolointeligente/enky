# PERFORMANCE — ENKY Intelligence 2.0 (Fase 9)

> **Princípio da fase:** processamento pesado nunca bloqueia a interface. Aqui a
> postura é honesta sobre o que é pesado **hoje** e o que só se justifica sob
> carga real — sem infra especulativa.

## 1. O que é caro e o que não é

Os motores (`periodization-engine`, `session-generator`, `load-simulation`,
`adaptation-engine`) são **puros e síncronos** — cada chamada custa milissegundos.
As rotas de **prévia/sugestão/simulação NÃO gravam** e respondem rápido; a UI já
mostra estado de carregamento (`Simulando…`, `Carregando…`) e nunca trava.

O único caminho realmente pesado e ligado ao banco é a **geração do ciclo
inteiro** (`generate-week.ts`, escopo `FULL_CYCLE`): planeja e persiste dezenas de
semanas × sessões × blocos/steps numa transação. Já é **em lote**
(`persistManyWorkoutBlocks` — 3 `createMany` independentemente do nº de treinos)
e limitada por um teto de transação de 30 s.

## 2. O que esta fatia entrega — Cache de computação

`server/cache/computation-cache.ts` — LRU **limitado** com **TTL** e relógio
injetável (testável). Memoiza funções **puras**:

- `ComputationCache<T>` — `get`/`set`/`getOrCompute`, despejo do menos-recente ao
  estourar `maxEntries`, expiração por `ttlMs`, `stats()` para observabilidade.
- `stableKey(obj)` — chave estável independente da ordem dos campos.

**Aplicado à simulação** (`load-simulation-service`): a parte cara — montar o
macrociclo e **enriquecer todas as semanas** para a carga prevista por sessão — é
função só da entrada, então é memoizada (`proposedPlanCache`, 300 entradas, TTL
10 min). Quando o treinador encadeia **prévia → simular → re-simular** com as
mesmas entradas, o trabalho é feito uma vez.

Limites conscientes:

- Só entra o que é **puro**. O **histórico de carga do atleta** (que muda) é lido
  do banco **a cada** chamada e nunca servido de cache — correção acima de
  velocidade.
- Cache em memória é **por instância e efêmero** (serverless). É um acelerador,
  nunca fonte de verdade: um miss só custa o recálculo, jamais um erro.
- `maxEntries` + `ttlMs` evitam crescer sem teto e servir resultado velho entre
  deploys (regras/versões podem mudar).

## 3. Background job para o `FULL_CYCLE` (entregue)

A geração do ciclo inteiro agora tem um caminho **assíncrono** que não faz a
interface esperar a persistência:

1. `POST …/periodizations/[id]/generate/async` — `startCycleGeneration` cria o
   `GenerationBatch` como **PENDING** (falhando cedo em acesso/plano sem semanas),
   responde **202** com o `batchId`, e o processamento roda **depois da resposta**
   via Next `after()` (`processCycleGeneration`).
2. O processador chama a MESMA geração homologada, que **ADOTA** o batch PENDING
   (`generateCycleDrafts(..., { existingBatchId })`) em vez de criar outro. Erro →
   batch marcado `FAILED` com `failureCode`.
3. `GET …/periodizations/[id]/batches/[batchId]` — status; a UI faz polling
   (2,5 s) até `COMPLETED`/`FAILED` e então recarrega o plano.

**Segurança da mudança:** o caminho **síncrono** (`generateCycleDrafts` sem
`existingBatchId`, botão "Gerar rascunhos") ficou **byte-idêntico** — a adoção do
batch é um ramo backward-compatible. O botão "Gerar em segundo plano" é aditivo e
opcional. Nada publica: os treinos nascem DRAFT nos dois caminhos.

**Fila real (SQS/Vercel Queues) e retry** seguem desnecessários no volume atual —
`after()` sobre Fluid Compute cobre o caso. Migra-se para fila dedicada só se a
taxa de geração concorrente crescer a ponto de exigir throttling/durabilidade
além do batch.

## 4. Postura

Cache e assincronismo são **aceleradores**, não muletas de correção. Nada aqui
muda o resultado de uma computação — só evita repeti-la. O caminho pesado real
(persistência do ciclo) fica marcado e planejado, não silenciosamente ignorado.
