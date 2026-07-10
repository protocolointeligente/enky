# ADR-004 — Estratégia de CSRF

**Status:** Aceito
**Data:** Fase 02B — Identidade, Autenticação, Organização Pessoal e Convite de Atleta

## Contexto

A Fase 02B introduz as primeiras mutações reais autenticadas por cookie (cadastro, login, logout, convite, ativação). Sessão em cookie `httpOnly` com `sameSite=lax` (ADR-002) reduz a superfície de CSRF, mas não a elimina sozinha: `sameSite=lax` ainda permite navegação de nível superior (ex.: um link) enviar cookies em requisições `GET`, e alguns navegadores/proxies mais antigos não aplicam `sameSite` de forma consistente. Precisamos de uma segunda camada.

## Decisão

**Validação de `Origin` (com fallback para `Referer`) contra `APP_URL` e, quando presente, `VERCEL_URL`, aplicada a toda rota de mutação (`POST`/`PATCH`/`DELETE`).** Implementada em `server/security/csrf.ts` (`assertTrustedOrigin`), chamada no início de cada route handler mutante, antes de qualquer leitura de corpo ou acesso ao banco.

**Por que também `VERCEL_URL`:** cada Preview Deployment da Vercel recebe uma URL única e imprevisível, que `APP_URL` (fixo, aponta só para produção) nunca cobre — sem isso, requisições legítimas same-origin dentro de um Preview seriam rejeitadas como CSRF. `VERCEL_URL` é injetado automaticamente pela própria Vercel, nunca controlável pelo cliente, então confiar nele não enfraquece a checagem.

**Por que não um token CSRF de duplo envio (double-submit):** a ENKY é uma API JSON same-origin consumida pelo próprio frontend Next.js — não há formulários HTML capazes de fazer POST cross-origin sem JavaScript, nem embeds de terceiros. Validação de `Origin` é a defesa recomendada pela OWASP para exatamente esse cenário, com uma fração da complexidade de gerar, distribuir e validar um token por sessão/formulário. Reavaliar se a ENKY um dia expuser uma API pública consumida por terceiros fora do controle da própria aplicação (ENKY API, Fase 8 do roadmap) — nesse cenário, autenticação por token de API (não cookie) resolve o problema de forma diferente e mais adequada.

## Regras

- Toda rota de mutação chama `assertTrustedOrigin(request)` como primeira linha do handler.
- Rotas somente-leitura (`GET`) não precisam da checagem — não há efeito colateral a proteger.
- Nunca usar `GET` para mutação, mesmo idempotente (ex.: nunca "ativar convite via GET").
- `sameSite=lax` permanece como primeira camada (definido em `server/auth/session.ts`, `getSessionCookieOptions()`) — as duas defesas são complementares, não substitutas uma da outra.

## Consequências

- Requisições de ferramentas como `curl`/Postman sem header `Origin`/`Referer` são rejeitadas por padrão durante desenvolvimento manual de rotas — comportamento esperado, não um bug; adicionar `-H "Origin: http://localhost:3000"` ao testar manualmente.
- Rate limiting (ver `server/security/rate-limit.ts`) é uma camada independente e complementar — CSRF impede que OUTRO site force o navegador da vítima a mutar dados; rate limiting impede abuso vindo do próprio cliente legítimo (ou de um atacante direto, sem depender de engano via CSRF).
