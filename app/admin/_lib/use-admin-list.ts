"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";

// Busca com filtros para os painéis do /admin. Todos os painéis fazem a mesma
// coisa (montar query string, buscar, tratar erro, recarregar após uma ação),
// então isso mora aqui uma vez só.
//
// `query` é serializado como chave do efeito: os painéis passam um objeto
// literal, que muda de identidade a cada render e re-dispararia o fetch em
// loop se fosse dependência direta.
export function useAdminList<T>(path: string, query: Record<string, string | undefined> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const entries = Object.entries(JSON.parse(queryKey) as Record<string, string | undefined>);
    const params = new URLSearchParams(
      entries.filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();

    apiFetch<T>(`${path}${params ? `?${params}` : ""}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, queryKey, reloadNonce]);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}

// Evita uma requisição por tecla digitada na busca.
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
