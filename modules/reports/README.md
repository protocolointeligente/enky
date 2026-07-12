# modules/reports

**Responsabilidade:** `Report` — geração e compartilhamento de relatórios de evolução do atleta.

**Fonte de verdade:** Data Model Specification v1.2.1 §7; Product & Engineering Specification v1.0 §33.

**Regra crítica:** relatório para o atleta é simples e educativo, sem linguagem alarmista; relatório para o treinador pode ser técnico. Nunca usar linguagem diagnóstica (Constitution, Princípio 16; Product Spec §37).

**Status (item 6 — backend):** relatório simples de período implementado. `report-service.ts` fotografa o que os motores já calculam — **aderência** (planejado×realizado), **carga** (`computeLoadState`: CTL/ATL/ACWR) e **prontidão** (`classifyReadiness`) — num `Report` DRAFT que o treinador revisa e compartilha (DRAFT→PUBLISHED, `sharedAt`). Linguagem de contexto, nunca diagnóstico.

- `generateAthleteReport` · `shareReport` · `listTrainerReports` · `getTrainerReport` · `listAthleteReports` (só PUBLISHED) · `getAthleteReport`.
- Rotas: `POST/GET /api/trainer/athletes/[athleteId]/reports`, `GET /api/trainer/reports/[id]`, `POST /api/trainer/reports/[id]/share`, `GET /api/athlete/reports` + `/[id]`.
- Coberto por `tests/integration/report-flow.test.ts`.

**UI:** `/treinador/relatorios` (seletor de atleta + período → gerar, listar, compartilhar) e `/atleta/relatorios` (lê os compartilhados), com o componente comum `components/report-view.tsx`. Entradas no dashboard do treinador e no home do atleta.

**Falta:** edição do texto do relatório pelo treinador (hoje `insights` é pré-preenchido factual, não editável) e revogar/arquivar compartilhamento.
