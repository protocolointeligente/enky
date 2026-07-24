// ============================================================================
// CACHE DE COMPUTAÇÃO — LRU limitado com TTL (ENKY Intelligence 2.0 · Fase 9).
// ============================================================================
// Memoização em memória para funções PURAS e determinísticas (o motor
// estratégico, o enriquecimento). Objetivo: "nunca bloquear a interface" —
// quando o treinador encadeia prévia → sugestões → simular → re-simular com as
// MESMAS entradas, o trabalho pesado (montar o macrociclo e enriquecer todas as
// semanas) é feito uma vez e reaproveitado.
//
// POSTURA / limites conscientes:
//  - Só memoize funções PURAS. Nada que leia o banco entra aqui — dado que muda
//    não pode ser servido de cache (o histórico de carga do atleta é lido fora).
//  - Cache em memória é POR INSTÂNCIA e efêmero (serverless). É um acelerador,
//    nunca uma fonte de verdade: um miss só custa o recálculo, nunca um erro.
//  - Limitado (maxEntries) e com TTL para não crescer sem teto nem servir um
//    resultado velho se a regra/versão mudar entre deploys.

export interface Clock {
  now(): number;
}

const SYSTEM_CLOCK: Clock = { now: () => Date.now() };

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  /** Máximo de entradas antes de despejar a mais antiga (LRU). */
  maxEntries: number;
  /** Validade de cada entrada em ms. */
  ttlMs: number;
  /** Relógio injetável — para teste determinístico. */
  clock?: Clock;
}

export class ComputationCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private readonly clock: Clock;
  private hits = 0;
  private misses = 0;

  constructor(private readonly options: CacheOptions) {
    this.clock = options.clock ?? SYSTEM_CLOCK;
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= this.clock.now()) {
      // Expirou: remove e conta como miss (o chamador recomputa).
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }
    // LRU: reinsere para virar a entrada mais recente.
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Atualizar uma chave existente a move para o fim (mais recente).
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: this.clock.now() + this.options.ttlMs });
    // Despeja a mais antiga enquanto estourar o teto.
    while (this.store.size > this.options.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  /** Devolve o valor em cache ou computa, guarda e devolve. */
  getOrCompute(key: string, compute: () => T): T {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = compute();
    this.set(key, value);
    return value;
  }

  get size(): number {
    return this.store.size;
  }

  /** Estatísticas de acerto — para observabilidade/tuning, não para lógica. */
  stats(): { hits: number; misses: number; size: number } {
    return { hits: this.hits, misses: this.misses, size: this.store.size };
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

// Chave estável a partir de um objeto de entrada: ordena as chaves para que a
// ordem dos campos não gere entradas diferentes para a mesma entrada lógica.
// Arrays preservam a ordem (relevante) — cabe ao chamador normalizá-los antes se
// a ordem não importar (ex.: dias da semana ordenados).
export function stableKey(input: Record<string, unknown>): string {
  return JSON.stringify(input, Object.keys(input).sort());
}
