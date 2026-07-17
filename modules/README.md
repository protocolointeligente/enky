# modules

Monólito modular: cada subpasta representa um módulo de domínio com fronteiras claras. Nenhum módulo importa o Prisma Client diretamente (isso vive em `infrastructure/database`) nem concentra lógica de apresentação (isso vive em `components/` e `app/`).

Ver `docs/ARCHITECTURE.md` para o fluxo de dependência entre `app → modules → domain → infrastructure`.

## Status atual

Módulos **implementados** com regra de negócio (Fases 02A–12): `identity`, `organizations`,
`athletes` / `trainers`, `workouts` / `calendar`, `feedback`, `exercises`, `templates`, `reports`,
`periodization`, `subscriptions` / `payments`, `integrations`, `admin`, `content`, `intelligence`.
`audit` é transversal e já é consumido pelas mutações reais.

Ainda **apenas especificados** (só `README.md`, sem regra de negócio): `marketplace`, `metrics`
(Metric Registry). Ver `docs/ENKY_CURRENT_STATE.md` para o estado auditado completo.

A ordem de preenchimento seguiu o roadmap oficial (ENKY 23) e o Prompt Master (ENKY 24 §19):
`identity` → `organizations` → `athletes`/`trainers` → `workouts`/`calendar` → `feedback` →
`metrics`/`reports` → `periodization` → `marketplace`/`subscriptions`/`payments` → `intelligence`.
