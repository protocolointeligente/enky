# domain

Regras de negócio e casos de uso da ENKY — a camada que os componentes React e as rotas de API **não** devem concentrar (ver `docs/ARCHITECTURE.md`).

## Status nesta fase

Fundação apenas. Contém hoje só `errors.ts`, a taxonomia de erros de aplicação usada por toda a plataforma (`ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`, `ExternalServiceError`), conforme ENKY 24 — Prompt Master §9.

Nenhuma regra de negócio de domínio (treino, periodização, marketplace, pagamento etc.) foi implementada. Essas regras nascem em `modules/<domínio>/` a partir da Fase seguinte, seguindo estritamente:

1. ENKY 00 — Constitution
2. ENKY OS — Product & Engineering Specification v1.0
3. ENKY OS — Interface Architecture & Screen Specifications v1.4
4. ENKY OS — Data Model Specification v1.2.1
5. ENKY 24 — Prompt Master
