# Changelog documental

Registro de mudanças nos documentos oficiais (fora do código). Ordem cronológica reversa.

## Fase 01.5 — Reconciliação e Hardening da Fundação

**Achado F1 (crítico) — documento duplicado:**
- Removido `docs/enky-os/enky_os_specification.md` (cópia superada da Product & Engineering Specification v1.0).
- Corrigido erro de digitação em `docs/enky_os_specification.md` §1 ("in uma" → "em uma") — único conteúdo exclusivo válido da cópia removida.
- `docs/enky_os_specification.md` (raiz de `docs/`) é agora a única versão canônica.

**Descoberta adicional durante o fechamento de F1 — índice desatualizado:**
- Reescrito `docs/enky-os/enky_os_indice.md`, que descrevia uma estrutura documental (numeração 00–PRD01, entidades `Person`/`Membership`/`TrainingSession`, "motores centrais" como `Calculation Engine`) nunca escrita e incompatível com os 5 documentos canônicos hoje aprovados. Substituído por um índice que reflete a hierarquia real.

**Achado F2 (crítico) — entidades do MVP divergentes do Data Model aprovado:**
- `docs/enky_os_specification.md` §12 reescrito com classificação explícita de cada entidade: `[MVP]`, `[SUBSTITUÍDO]` ou `[PÓS-MVP]`. Ver detalhamento na própria seção.
- `modules/intelligence/README.md` e `modules/periodization/README.md` atualizados para referenciar a resolução em vez da pendência.

**Achado F3 (crítico) — `WorkoutSource` incompatível com o documento de Periodização:**
- `docs/enky_25_periodizacao.md` §8 reescrito: `source` usa exclusivamente os valores aprovados (`MANUAL`, `PERIODIZATION_GENERATED`, ...); a distinção manual/assistido/automático passa a viver em `generationMode`. Nomes de campo corrigidos para bater com o Data Model v1.2.1 (`periodizationPhaseId` em vez de `phaseId`; removidos `isGenerated`/`generationReason`, inexistentes no schema aprovado).
- `modules/periodization/README.md` atualizado.

**Achado F4 (crítico) — organização pessoal implícita:**
- Criado `docs/adr/ADR-001-multitenancy-enforcement.md`: formaliza a criação atômica de `User`+`TrainerProfile`+`Organization`+`OrganizationMembership(OWNER)` no cadastro do treinador, e resolve também o achado F8 (mecanismo de aplicação das invariantes de tenant: resolução no servidor, RLS adiado).
- `modules/organizations/README.md` e `docs/ARCHITECTURE.md` atualizados.

**Achado F7 — matriz de permissões ausente:**
- Criado `docs/enky_role_permission_matrix.md`: cruza `Role` global e `OrganizationRole`, cobrindo as 12 ações listadas na Fase 01.5 (criar/visualizar atleta, prescrever, publicar, editar treino publicado, visualizar feedback, emitir relatório, gerenciar membros, pagamentos, feature flags, logs, dados sensíveis).

**Autenticação e hash de senha:**
- Criado `docs/adr/ADR-002-authentication.md`: decide sessão própria server-side com token opaco revogável (não Auth.js, não HMAC stateless) e mantém `bcryptjs` (não migra para Argon2id agora), com justificativa e gatilhos de reavaliação para ambas as decisões.

**Toolchain e dependências:**
- Criado `docs/adr/ADR-003-quality-toolchain.md`: consolida a estratégia de versionamento da Fase 01, registra os resultados do `npm audit`/`npm outdated` da Fase 01.5 em tabela (pacote, severidade, caminho transitivo, ambiente afetado, decisão) e a decisão de manter `lib/env.ts` com validação unificada.

**Verificado sem necessidade de mudança:**
- Fórmula `sessionRpeLoad = actualDurationMinutes × sessionRpe` — idêntica, literal, em `enky_interface_specification.md` §7 e `enky_data_model_specification.md` §6.

## Fase 1 — Auditoria (referência)

Os achados F1–F11 citados acima foram originalmente levantados no relatório de auditoria da Fase 1 (entregue como artifact, não commitado neste repositório). Este changelog é o primeiro registro documental permanente das resoluções.
