# ENKY — Estratégia de Cache do PWA (Etapa 6, §32-33)

Service worker: [`public/sw.js`](../public/sw.js). Registro/update: [`components/pwa-register.tsx`](../components/pwa-register.tsx).
Manifest: [`public/manifest.webmanifest`](../public/manifest.webmanifest).

## Regra de ouro

**Nunca cachear `/api/*`.** Respostas autenticadas (treinos, feedback, prontidão,
financeiro, outro atleta) jamais entram no cache do service worker — num aparelho
compartilhado isso vazaria dados entre usuários (§33). Os dados que precisam ficar
disponíveis offline vivem em **IndexedDB no nível do app** (`modules/offline-sync`,
snapshot da execução), não no cache do SW.

## Estratégia por tipo de request

| Request | Estratégia | Por quê |
|---------|-----------|---------|
| `/api/*` | **NetworkOnly** (sem cache) | Autenticado/sensível — nunca persistir no SW. |
| Navegação HTML | **Network-First** → fallback `/atleta/offline` | Sempre buscar a versão fresca; offline mostra estado útil (§50). |
| `/_next/static/*`, `/brand/*`, `/exercise-gifs/*`, assets `.css/.js/.woff2/img` | **Cache-First** + revalidação | Imutáveis/versionados; seguros para cachear. |
| Terceiros (outra origem) | **Não intercepta** | Fora do controle; sem cache. |
| Outros GET same-origin | **NetworkOnly** | Default conservador. |

## Update flow (§32)

1. Novo `sw.js` é detectado (`updatefound`).
2. Ao instalar com um worker já ativo, o app mostra um toast informativo.
3. **Não** força reload — o atleta pode estar no meio de um treino. A nova versão
   ativa naturalmente quando o app é reaberto (todas as abas fechadas) ou via
   `SKIP_WAITING` numa ação futura de "atualizar agora".
4. `activate` limpa caches de versões antigas (`CACHE_VERSION`).

## Logout (§33/§52)

`clearAppCaches()` ([`app/_lib/pwa.ts`](../app/_lib/pwa.ts)) é chamado no logout
([`components/app-header.tsx`](../components/app-header.tsx)): manda `CLEAR_CACHE`
ao SW e apaga todos os caches diretamente. Best-effort — nunca bloqueia o logout.
IndexedDB de dados offline deve ser limpo pelo mesmo caminho quando o adapter for
implementado (pendência registrada abaixo).

## Invalidação

Bump `CACHE_VERSION` em `public/sw.js` a cada mudança de estratégia/precache.
`activate` remove automaticamente as versões anteriores.

## Pendências (fora desta fatia de fundação)

- **Ícones**: o manifest reaproveita `/brand/enky-app-icon.png` para 192/512/maskable.
  O operador deve confirmar/gerar PNGs nas dimensões exatas + variante *maskable* com
  safe-zone antes da homologação.
- **IndexedDB adapter**: `modules/offline-sync` tem só a política pura; o store
  IndexedDB + loop de envio + limpeza no logout entram na fatia de execução offline.
- **Precache do shell**: hoje só `/atleta/offline` + ícone. Ampliar com cuidado para
  não cachear HTML autenticado.
