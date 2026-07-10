# ADR-003 — Toolchain de qualidade, versionamento de dependências e ambiente

**Status:** Aceito
**Data:** Fase 01 (toolchain inicial) — consolidado e auditado na Fase 01.5

## 1. Estratégia de versionamento

A fundação (Fase 01) fixou intervalos `^major` conhecidos e estáveis para cada dependência, em vez de `latest`, especificamente para evitar majors recém-lançados com paradigmas que ainda não haviam sido validados neste projeto: TypeScript 7 (reescrita nativa/`tsgo`), Prisma 7 (novo `prisma.config.ts`), ESLint 10, Next.js 16, Vitest 4, Zod 4, bcryptjs 3, pino 10.

`npm outdated` (Fase 01.5) confirma que o projeto está na última versão compatível dentro de cada major escolhido (coluna "Wanted" = "Current" para todos os pacotes) — a estratégia de `^` está funcionando como pretendido: patches e minors chegam automaticamente, majors não testados não.

**Gatilho para revisitar cada major represado:** apenas depois de uma verificação dedicada (não durante uma fase de hardening ampla como esta) confirmando que a nova major não quebra nenhum dos scripts de `npm run validate`.

## 2. Vulnerabilidades conhecidas (`npm audit`, Fase 01.5)

| Pacote | Severidade | Caminho transitivo | Ambiente afetado | Correção sem breaking change? | Decisão |
|---|---|---|---|---|---|
| `postcss` (interno ao `next`) | Moderada | `next` → `node_modules/next/node_modules/postcss` | Build-time apenas — `next` empacota sua própria cópia de `postcss` independente da nossa (`@tailwindcss/postcss` v4, não afetada) | Não — exigiria downgrade de `next` para `9.3.3` (sugestão do resolvedor do `npm audit`, sem sentido prático) | **Aceitar.** XSS via stringificação de CSS não é explorável no nosso uso — `postcss` só processa folhas de estilo do próprio time, nunca CSS submetido por usuário. Confirmado com `npm audit --omit=dev`: é o único item que sobrevive ao filtro de produção. |
| `esbuild` | Moderada | `vitest` → `vite` → `esbuild` | **Somente desenvolvimento** — `esbuild` expõe um servidor de dev que aceita requisições de qualquer site. Não entra no bundle de produção. | Não — exige `vitest@4` (major) | **Aceitar, com mitigação operacional.** Não expor a porta do servidor de desenvolvimento fora de `localhost`. Reavaliar ao planejar a migração para `vitest@4`. |
| `vite`, `vite-node`, `@vitest/mocker` | Alta / Moderada | `vitest` → `vite` (path traversal, bypass de `server.fs.deny`, disclosure de hash NTLMv2 via UNC no Windows) | **Somente desenvolvimento**, e apenas quando o servidor do Vite estiver de fato escutando (não ocorre em `vitest run`, nosso script de `test`) | Não — exige `vitest@4` (major) | **Aceitar.** Confirmado ausente com `npm audit --omit=dev`. |
| `vitest` | **Crítica** | Direto — "quando o servidor de UI do Vitest está escutando, um arquivo arbitrário pode ser lido e executado" | **Somente desenvolvimento, e somente se `vitest --ui` for executado** — nenhum script de `package.json` deste projeto usa `--ui` | Não — exige `vitest@4` (major) | **Aceitar, com regra operacional explícita: nunca rodar `vitest --ui` neste repositório antes de migrar para `vitest@4`.** |

**Confirmado com `npm audit --omit=dev`:** apenas a entrada de `postcss`/`next` sobrevive ao filtro de produção — todo o restante (a cadeia crítica do `vitest`/`vite`/`esbuild`) é exclusivamente de desenvolvimento, como já era esperado no relatório de Fase 1, agora comprovado e não apenas presumido.

`npm audit fix --force` **não foi executado** — todas as correções disponíveis implicam bump de major (`vitest@4`, ou um downgrade sem sentido de `next`), fora do escopo de uma fase de hardening que não deve introduzir instabilidade nova.

## 3. `lib/env.ts` — validação eager unificada (não separada em `serverEnv`/`clientEnv`)

Avaliado na Fase 01.5 (item 12 do prompt de hardening): o acoplamento é real — `AUTH_SECRET` e `DATABASE_URL` são validados juntos na primeira importação de `lib/env.ts`, mesmo por um módulo que só precise de um dos dois.

**Decisão: manter a validação unificada.** Razões:

- O projeto hoje tem **zero** variáveis `NEXT_PUBLIC_*` — não existe, ainda, nenhuma variável de ambiente exposta ao cliente. Não há nada para separar em `clientEnv` até que a primeira exista.
- `DATABASE_URL` e `AUTH_SECRET` são, na prática, requisitos conjuntos de qualquer execução real da aplicação — não há um deploy válido da ENKY sem banco e sem segredo de sessão.
- Testes não dependem de um `.env` real graças a `tests/setup.ts`.
- Scripts do Prisma (`generate`/`validate`/`format`) leem `DATABASE_URL` diretamente via o carregamento de `.env` do próprio Prisma CLI — nunca importam `lib/env.ts`, portanto não têm nenhum acoplamento com o schema Zod.

**Gatilho para revisitar:** a primeira variável `NEXT_PUBLIC_*` introduzida no projeto deve vir acompanhada da separação em `serverEnv`/`clientEnv` — não antes, para não criar uma abstração sem uso real (violaria o princípio de não antecipar estrutura especulativa).

## 4. Incidente: build quebrado na Vercel por validação eager (corrigido)

**A afirmação original desta ADR — "build não depende de `lib/env.ts` graças a `force-dynamic`" — estava errada**, e só foi descoberta porque os dois Preview Deployments da Fase 02A falharam de verdade na Vercel, não porque os testes locais pegaram o problema.

**Causa raiz:** `next build` executa a etapa "Collecting page data" para **toda** rota, inclusive as marcadas `dynamic = "force-dynamic"` — `force-dynamic` impede a pré-renderização estática (o problema que ele foi desenhado para resolver), mas não impede o Next de carregar/executar o módulo da rota durante essa etapa de build. Como `lib/env.ts` validava o schema inteiro (`envSchema.parse(process.env)`) no escopo do módulo — fora de qualquer função —, a simples importação do arquivo já disparava a validação, e faltando `AUTH_SECRET` na Vercel (nenhuma integração automática o provisiona, diferente de `DATABASE_URL` via integração Neon), o build inteiro quebrava. Reproduzido localmente removendo `.env` e rodando `npm run build`: **toda** rota que importa `lib/env.ts`, mesmo indiretamente via `server/observability/logger.ts` (que também construía o `pino(...)` no escopo do módulo, tocando `env.LOG_LEVEL`/`env.NODE_ENV`), falhava da mesma forma — não só `/api/health`.

**Correção:** `lib/env.ts` agora expõe `env` como um `Proxy` — a validação só roda no primeiro acesso a uma propriedade (`env.AUTH_SECRET`, etc.), não na importação do módulo. `server/observability/logger.ts` segue o mesmo padrão: a instância real do `pino` só é construída na primeira chamada de log, não no escopo do módulo. Resultado, verificado localmente: `npm run build` agora **passa com zero variáveis de ambiente definidas** — o build nunca mais falha por falta de segredo; apenas uma requisição real que efetivamente precise de uma variável ausente falha, e só naquele caminho.

**Isso não elimina a necessidade de configurar `AUTH_SECRET` na Vercel** — sem ele, o build passa, mas qualquer rota que crie sessão (`/api/auth/*`, `/api/athletes/invitations*`) retorna 500 em runtime. Configurar as variáveis de ambiente do projeto na Vercel continua sendo necessário e é responsabilidade de quem administra o projeto lá — nenhuma ferramenta disponível aqui tem acesso para configurá-las.

**Lição de processo:** todo teste de build feito localmente até este incidente rodou com um `.env` real populado — o cenário "build sem nenhuma variável definida" nunca tinha sido testado de fato, só presumido. Verificar precisa incluir o caso adversarial, não só o caso feliz.
