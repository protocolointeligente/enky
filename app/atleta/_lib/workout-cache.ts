// Cache do detalhe do treino em IndexedDB (Etapa 6, §16/§21): ao abrir um treino
// online, guarda-se a cópia local; offline, o detalhe é servido dela para permitir
// iniciar a execução sem conexão. Guarda o objeto inteiro (com `id`) como veio da API.
import { idbGet, idbPut, STORE_WORKOUTS } from "@/app/_lib/idb";

export function cacheWorkout<T extends { id: string }>(workout: T): Promise<void> {
  return idbPut(STORE_WORKOUTS, workout);
}

export function getCachedWorkout<T>(id: string): Promise<T | undefined> {
  return idbGet<T>(STORE_WORKOUTS, id);
}
