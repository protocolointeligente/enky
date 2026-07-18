# modules/assessments

Avaliações fisiológicas/esportivas do atleta — **fatia A** (fundação de dados) da
etapa `feat/athlete-assessments-prescription-zones`.

## Modelo

`Assessment` (Prisma) é versionada: uma avaliação nova do mesmo tipo **não apaga** a
anterior — a antiga vira `SUPERSEDED`. Ciclo de vida:

```
DRAFT → VALID → (nova valida) → SUPERSEDED
                └→ EXPIRED (derivado de validUntil)
                └→ INVALID (marcação manual — fatia futura)
```

As MEDIÇÕES do protocolo vivem em `measurements` (JSON validado por Zod por tipo,
nunca lido cru); saídas por fórmula formal ficariam em `derivedMetrics` (vazio nesta
fatia — o cálculo é a **fatia C**, `modules/training-zones`).

## Contrato de unidades (para o motor de zonas não adivinhar)

- FC: **bpm** · pace corrida: **segundos por km** · velocidade: **km/h**
- potência: **watts** · pace natação: **segundos por 100 m** · carga/1RM: **kg**
- durações/tempos de teste: **segundos**

O front formata (mm:ss); o banco guarda número.

## Arquivos

- `assessment-schema.ts` — Zod: cabeçalho + medições por tipo (HR/corrida/ciclismo/
  natação/força/composição). `.strict()` + refine de indicador mínimo por tipo.
- `assessment-service.ts` — `createAssessment` (DRAFT), `updateAssessmentDraft`,
  `validateAssessment` (supersede transacional), `listAssessments`, `getAssessment`.
  Escopo org+treinador reforçado em toda entrada; auditoria em toda escrita.

## Rotas

- `GET|POST /api/trainer/athletes/[athleteId]/assessments` — listar histórico / criar.
- `GET|PATCH /api/trainer/assessments/[id]` — ver / editar rascunho.
- `POST /api/trainer/assessments/[id]/validate` — validar (DRAFT→VALID + supersede).

## Fora desta fatia

Perfil consolidado (B), motor/registro de zonas (C), integração ao modal (D), aba
Avaliações na 360º (E). `TestResult`/`DerivedMetric` (sem uso) não foram tocados.
