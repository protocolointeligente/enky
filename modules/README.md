# modules

Monólito modular: cada subpasta representa um módulo de domínio com fronteiras claras. Nenhum módulo importa o Prisma Client diretamente (isso vive em `infrastructure/database`) nem concentra lógica de apresentação (isso vive em `components/` e `app/`).

Ver `docs/ARCHITECTURE.md` para o fluxo de dependência entre `app → modules → domain → infrastructure`.

## Status nesta fase

Todos os 15 módulos abaixo contêm apenas um `README.md` de responsabilidade — nenhuma regra de negócio foi implementada. A ordem de preenchimento segue o roadmap oficial (ENKY 23) e o Prompt Master (ENKY 24 §19):

1. `identity`
2. `organizations`
3. `athletes` / `trainers`
4. `workouts` / `calendar`
5. `feedback`
6. `metrics` / `reports`
7. `periodization`
8. `marketplace` / `subscriptions` / `payments`
9. `intelligence`

`audit` é transversal e é consumido por todos os demais módulos assim que existirem mutações reais para registrar.
