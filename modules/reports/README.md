# modules/reports

**Responsabilidade:** `Report` — geração, publicação e revogação de relatórios de evolução do atleta, em tela e em PDF.

**Fonte de verdade:** Data Model Specification v1.2.1 §7; Product & Engineering Specification v1.0 §33.

**Regra crítica:** relatório para o atleta é simples e educativo, sem linguagem alarmista; relatório para o treinador pode ser técnico. Nunca usar linguagem diagnóstica (Constitution, Princípio 16; Product Spec §37).

## Arquitetura (Fase 8 — relatório premium)

O módulo é uma pilha de quatro camadas, e a separação é deliberada: **a redação acontece uma vez só**, e tela e PDF apenas desenham o mesmo texto.

| Arquivo              | Papel                                                                   | Depende de        |
| -------------------- | ----------------------------------------------------------------------- | ----------------- |
| `report-snapshot.ts` | Contrato do `metricsSnapshot` + limiares de suficiência. Puro.          | `zod`             |
| `report-document.ts` | **Redação.** Snapshot → `ReportDocument` (seções, stats, avisos). Puro. | `report-snapshot` |
| `report-pdf.ts`      | Desenha o `ReportDocument` em PDF com a identidade ENKY.                | `pdfkit`          |
| `report-service.ts`  | Mede (prisma), persiste, autoriza, audita.                              | prisma, motores   |

`components/report-view.tsx` desenha o **mesmo** `ReportDocument` na tela. Por isso o snapshot test em `tests/unit/modules/reports/report-document.test.ts` é o contrato de linguagem do produto: o que ele trava é literalmente o que o atleta lê nos dois meios.

### Suficiência de dados

Insuficiência é **informação de primeira classe**, não rodapé. Abaixo dos limiares (`MIN_LOAD_DATA_DAYS = 10`, `MIN_READINESS_CHECKINS = 3`) a seção **não exibe os números** e declara a lacuna com o motivo — CTL/ATL/TSB/ACWR sumem porque seriam instáveis, _não porque são zero_. `report-document` nunca estima o que falta.

Snapshot de versão desconhecida (relatório gerado antes de `REPORT_SNAPSHOT_VERSION = 2.0.0`) **não é reinterpretado**: o documento declara o formato antigo e pede regeneração.

### Interpretação

O serviço só MEDE. `insights`/`recommendations` nascem `null` de propósito e são campos **do treinador** — pré-preenchê-los assinaria uma interpretação em nome dele. O resumo executivo é derivado do snapshot pelo `report-document` e aparece como leitura do sistema; o texto do treinador, quando existe, vai para a seção própria "Leitura do treinador".

## Ciclo de vida

`DRAFT` → `PUBLISHED` (`shareReport`, grava `sharedAt`) → `REVOKED` (`revokeReport`, zera `sharedAt`) → `PUBLISHED` de novo (republicar é permitido).

O atleta enxerga **apenas `PUBLISHED`**, e a regra vale para lista, acesso por id **e PDF** — o PDF não é porta lateral para o que a tela esconde. Revogar tira o relatório do atleta na hora; o treinador mantém no histórico e o `AuditLog` guarda o ciclo (`GENERATE_REPORT`, `SHARE_REPORT`, `REVOKE_REPORT`).

## API

- `POST/GET /api/trainer/athletes/[athleteId]/reports` — gerar / listar (devolvem `{ report, document }`).
- `GET /api/trainer/reports/[id]` · `POST /api/trainer/reports/[id]/share` · `POST /api/trainer/reports/[id]/revoke` · `GET /api/trainer/reports/[id]/pdf`.
- `GET /api/athlete/reports` · `/[id]` · `/[id]/pdf` — só `PUBLISHED`.

Rotas de PDF são `runtime = "nodejs"` (pdfkit é Node puro) e respondem `Cache-Control: private, no-store` — relatório é dado de saúde/desempenho.

**PDF e deploy:** `pdfkit` carrega as métricas das fontes padrão (`.afm`) por `require` dinâmico, invisível ao bundler. Por isso `next.config.ts` o mantém em `serverExternalPackages` e puxa `public/brand/**` + `pdfkit/js/data/**` via `outputFileTracingIncludes`. Sem isso o PDF quebra **só em produção**. O wordmark é sempre **arquivo**, nunca refonte (Manual da Marca §3.4): se o asset não estiver no bundle, a marca é omitida em vez de recomposta com Helvetica.

**UI:** `/treinador/relatorios` (gerar, revisar, baixar PDF, compartilhar, revogar) e `/atleta/relatorios` (lê e baixa os compartilhados).

**Testes:** `tests/unit/modules/reports/report-document.test.ts` (snapshot + linguagem), `report-pdf.test.ts` (PDF válido nos dois extremos de dado), `tests/integration/report-flow.test.ts` (DRAFT→PUBLISHED) e `report-premium.test.ts` (revogação, autorização do PDF, isolamento entre organizações, auditoria).

**Falta:** edição do texto do relatório pelo treinador na UI (o campo já existe e o documento já o exibe; falta o formulário) e arquivamento (`ARCHIVED` existe no enum, sem fluxo).
