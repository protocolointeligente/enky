export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });

  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !body.ok) {
    throw new ApiClientError(body.error?.message ?? "Erro inesperado.", body.error?.code ?? "UNKNOWN");
  }

  return body.data as T;
}
