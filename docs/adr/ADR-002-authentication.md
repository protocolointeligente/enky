# ADR-002 — Estratégia de autenticação e hash de senha

**Status:** Aceito
**Data:** Fase 01.5 — Reconciliação e Hardening da Fundação
**Contexto de decisão:** os primitivos de `server/auth/` criados na Fase 01 (assinatura HMAC stateless em `node:crypto`) ainda não estavam conectados a nenhuma rota de login. Esta ADR fecha essa decisão antes de qualquer cadastro real de usuário, conforme apontado na revisão da Fase 01.

## 1. Problema

A implementação original de `server/auth/session.ts` assinava um payload JSON com HMAC-SHA256 e o devolvia como cookie — sem nenhum registro no servidor. Isso resolve integridade (o cliente não consegue forjar ou alterar o payload sem o segredo), mas **não resolve nenhuma das seguintes propriedades exigidas de um sistema de sessão de produção**:

- expiração revogável antes do prazo original;
- revogação individual (logout de um dispositivo específico);
- revogação em massa (troca de senha, "logout em todos os dispositivos", suspeita de comprometimento);
- rotação de segredo sem invalidar todas as sessões de uma vez;
- proteção contra replay de um token roubado além da janela de expiração;
- visibilidade de sessões ativas por usuário (multi-dispositivo).

Um token assinado e stateless só pode ser invalidado antes do prazo trocando o segredo global — o que derruba **todas** as sessões de **todos** os usuários simultaneamente. Isso não é aceitável como mecanismo de logout ou de resposta a comprometimento de conta.

## 2. Opções avaliadas

### Opção A — Auth.js (NextAuth v5)

| Critério | Avaliação |
|---|---|
| Compatibilidade com Next.js 15 | Boa — suporte oficial a App Router e Route Handlers. |
| Estratégia de sessão | Suporta banco de dados (revogável, real) ou JWT (mesma limitação de revogação do HMAC atual). |
| Cookies | Gerencia `httpOnly`/`secure`/`sameSite` automaticamente. |
| OAuth futuro | Ponto forte — dezenas de provedores prontos, hoje fora do escopo do MVP. |
| Revogação | Real apenas com estratégia de banco de dados. |
| Integração Prisma | Via `@auth/prisma-adapter`, mas **exige os modelos `Account`, `Session` e `VerificationToken`** com formato específico do Auth.js. |
| Complexidade | Framework completo — mais superfície do que o MVP precisa hoje (sem OAuth, sem múltiplos provedores). |
| Manutenção | Ativa, mas acopla o ciclo de vida de autenticação a um pacote de terceiros com seu próprio schema. |

**Problema decisivo:** o schema exigido pelo adapter Prisma do Auth.js **não existe e não é compatível** com o Data Model Specification v1.2.1 (documento canônico, hierarquia 4), que já define `User` com `passwordHash`/`globalRole` diretamente e não prevê `Account`/`VerificationToken`. Adotar Auth.js agora forçaria uma segunda divergência de schema — exatamente o tipo de problema documental que esta Fase 01.5 existe para fechar (achados F1–F4), não para criar um novo.

### Opção B — Sessão própria server-side (escolhida, com hardening)

Requisitos obrigatórios avaliados e como cada um é endereçado:

| Requisito | Como é resolvido |
|---|---|
| Identificador de sessão aleatório | Token opaco de 256 bits (`crypto.randomBytes(32)`), gerado no servidor — nunca derivado de dados previsíveis. |
| Armazenamento de hash do token em banco | O cookie carrega o token bruto; o banco armazena apenas `HMAC-SHA256(AUTH_SECRET, token)`. Um vazamento do banco não expõe tokens válidos. |
| Expiração | `Session.expiresAt`, verificado a cada leitura. |
| Revogação | `Session.revokedAt` — revogação individual (logout) sem afetar outras sessões do mesmo usuário. |
| Rotação | Rotacionar `AUTH_SECRET` invalida todos os hashes de uma vez (recuperação de comprometimento total); revogar uma linha invalida uma sessão específica sem afetar as demais. |
| Logout | Marca a sessão atual como revogada. |
| Invalidação após troca de senha | Revoga todas as sessões do `userId` (`revokeAllSessionsForUser`). |
| Múltiplos dispositivos | Uma linha de `Session` por login — múltiplas linhas por `userId` coexistem naturalmente. |
| Proteção contra fixação e replay | Token gerado apenas no servidor após autenticação bem-sucedida (nunca aceito vindo do cliente antes do login); token de sessão revogada nunca mais valida, mesmo dentro do prazo de expiração original. |
| CSRF | Cookie `sameSite=lax` (o padrão do projeto) mitiga a maioria dos casos entre sites; rotas mutantes que aceitem `sameSite=strict` ou validação de origem explícita ficam como responsabilidade da Fase 02, quando as rotas de mutação existirem — não há mutação nenhuma nesta fase. |
| Cookie `httpOnly`, `secure`, `sameSite` | Já implementado em `getSessionCookieOptions()` desde a Fase 01, mantido. |
| Auditoria | Cada `Session` guarda `userAgent`/`ipAddress` no momento da criação, disponível para `AuditLog` futuro. |

## 3. Decisão

**Opção B — sessão própria server-side, com token opaco e registro revogável em `Session`.**

Justificativa: resolve objetivamente todas as lacunas listadas na seção 1, sem introduzir um schema de autenticação incompatível com o Data Model Specification v1.2.1 aprovado. Auth.js permanece candidato natural para quando o produto precisar de OAuth real (fora do MVP, conforme Product & Engineering Specification v1.0 §9) — reavaliar nesse momento, não antes.

**O que muda no código desta fase:**

- `prisma/schema.prisma` ganha o modelo `Session` (infraestrutura de identidade, não uma entidade de negócio do Product Spec — não conflita com o congelamento do schema tratado no achado F2).
- `server/auth/session.ts` passa a gerar token opaco + hash HMAC persistido, com `createSession`, `verifySessionByToken`, `revokeSession`, `revokeAllSessionsForUser`.
- Nenhuma rota de login/cadastro é conectada nesta fase — os primitivos continuam preparados, não utilizados.

## 4. Hash de senha — Argon2id vs. bcrypt nativo vs. bcryptjs

| Critério | Argon2id (`argon2`) | bcrypt nativo (`bcrypt`) | bcryptjs (atual) |
|---|---|---|---|
| Segurança | Recomendação atual da OWASP; memory-hard, resiste melhor a GPU/ASIC. | Maduro, mas não memory-hard. | Mesmo algoritmo do bcrypt nativo, implementação em JS puro. |
| Binding nativo | Sim (bindings C++ pré-compilados). | Sim (bindings C++ pré-compilados). | Não — puro JavaScript. |
| Compatibilidade com Vercel/serverless | Requer binário pré-compilado compatível com o runtime Node da função; risco documentado de mismatch de plataforma e aumento do tamanho do bundle em cold start. Não testado neste ambiente. | Mesmo risco do Argon2id. | Funciona de forma idêntica em qualquer runtime Node, incluindo serverless, sem etapa de compilação. |
| Desempenho | Mais lento por design (memory-hard) — bom para segurança, exige ajuste de parâmetros para runtime serverless. | Rápido. | Mais lento que as implementações nativas (puro JS), mas hashing de senha não é um caminho quente (ocorre uma vez por login). |
| Manutenção/instalação | Dependência adicional com etapa de build nativa. | Idem. | Zero dependências nativas, zero etapa de build. |

**Decisão: manter `bcryptjs`, 12 rounds, por enquanto.**

Justificativa: o Product & Engineering Specification v1.0 (§38, ENKY 24 §18) define a Vercel como alvo de deploy. Dependências com binding nativo são uma fonte conhecida de fricção em ambientes serverless (mismatch de plataforma, tamanho de função, cold start), e essa compatibilidade **não foi verificada neste ambiente de desenvolvimento**. Trocar o algoritmo de hash é uma migração sensível (hashes existentes não são reconvertíveis — exige double-hashing ou reset de senha em massa), então não deve ser feita de forma especulativa.

**Parâmetros atuais:** `bcrypt.hash(senha, 12)` — 12 rounds está dentro da faixa recomendada (10–14) para 2026, equilibrando tempo de hashing (~1,3 s neste ambiente de desenvolvimento, medido nos testes) com resistência a força bruta offline.

**Gatilho para reavaliar:** antes do cadastro real do primeiro usuário em produção, rodar um smoke test de deploy na Vercel com `argon2` instalado. Se os binários pré-compilados carregarem corretamente no runtime Node de produção (não Edge), migrar para Argon2id com uma estratégia de re-hash progressivo no primeiro login pós-migração (nunca reset de senha em massa).

## 5. Consequências

- Uma tabela nova (`Session`) entra no schema antes da expansão formal do Data Model — documentado aqui para não ser confundido com os achados F2 (que tratam de entidades de **produto**, não de infraestrutura de identidade).
- `server/auth/session.ts` agora depende de `infrastructure/database/prisma` — uma exceção deliberada ao fluxo de dependência descrito em `docs/ARCHITECTURE.md` (gestão de sessão é infraestrutura de identidade, não lógica de domínio de negócio). Documentado também em `docs/ARCHITECTURE.md`.
- CSRF além do `sameSite=lax` fica como item aberto para quando existirem rotas de mutação reais — resolvido na Fase 02B, ver `docs/adr/ADR-004-csrf-strategy.md`.

## 6. Implementação (Fase 02B)

Cadastro (`registerTrainer`), login (`login`) e logout (`logout`) conectados em `app/api/auth/{register,login,logout,session}/route.ts`, usando exatamente a arquitetura desta ADR. Testado contra PostgreSQL real: sessão criada/verificada/revogada, expiração, e mensagem idêntica para conta inexistente vs. senha incorreta (proteção contra enumeração) — ver `tests/integration/identity-auth.test.ts`.
