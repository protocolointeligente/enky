# ENKY — Modelo de Avaliações

Etapa `feat/athlete-assessments-prescription-zones`. Complementa
[modules/assessments/README.md](../modules/assessments/README.md).

## Entidade `Assessment`

Avaliação fisiológica/esportiva **versionada** do atleta. Uma avaliação nova do
mesmo tipo **não apaga** a anterior — a antiga vira `SUPERSEDED`.

| Campo | Papel |
|---|---|
| `assessmentType` | HEART_RATE / RUNNING / CYCLING / SWIMMING / STRENGTH / BODY_COMPOSITION |
| `modality` | opcional (FC e composição não têm modalidade única) |
| `protocolCode` / `protocolVersion` | protocolo do teste + versão |
| `assessmentDate` | data do teste |
| `performedByUserId` | quem registrou |
| `source` | MEASURED / ESTIMATED / IMPORTED / MANUAL / DEVICE / LAB / FIELD_TEST |
| `status` | DRAFT / VALID / SUPERSEDED / EXPIRED / INVALID |
| `confidence` | LOW / MODERATE / HIGH / NOT_ASSESSED |
| `validUntil` | validade (EXPIRED é derivado dela na leitura) |
| `measurements` (JSON, Zod) | medições do protocolo |
| `derivedMetrics` (JSON) | saídas por fórmula formal (vazio nesta etapa) |

## Ciclo de vida

```
DRAFT ──validar──▶ VALID ──(nova validada do mesmo tipo)──▶ SUPERSEDED
                     └── validUntil < hoje ──▶ EXPIRED (derivado, com aviso)
                     └── marcação manual ──▶ INVALID (fatia futura)
```

- **Não apaga**: histórico preservado (regra da etapa). `TestResult`/`DerivedMetric`
  (legados, sem uso) não foram tocados — deprecação futura documentada.
- **Validar** roda em transação: supersede a `VALID` anterior do mesmo tipo, então
  promove o rascunho. Auditado (`VALIDATE_ASSESSMENT`).

## Medições por tipo e unidades

Contrato validado por Zod (`assessment-schema.ts`), `.strict()`, com indicador
mínimo por tipo. **Unidades**: FC bpm · pace corrida **s/km** · velocidade **km/h**
· potência **W** · pace natação **s/100 m** · carga/1RM **kg** · tempos **s**.

| Tipo | Medições (chaves) | Mínimo exigido |
|---|---|---|
| HEART_RATE | restingHeartRate, maximumHeartRate, thresholdHeartRate, measurementMethod | máx **ou** limiar |
| RUNNING | vdot, vam, criticalSpeed, thresholdPace, pace3k/5k/10k, halfMarathonPace, marathonPace, testDistanceMeters, testDurationSeconds | ≥1 indicador |
| CYCLING | ftp, criticalPower, maxPower, thresholdHeartRate, testDurationSeconds | ftp **ou** potência crítica |
| SWIMMING | css, criticalSwimSpeed, pacePer100m, test400mSeconds, test200mSeconds | css/CV/ritmo |
| STRENGTH | exerciseId, oneRepMax, estimatedOneRepMax, testLoadKg, testRepetitions, formulaCode, formulaVersion | 1RM **ou** carga+reps |
| BODY_COMPOSITION | weightKg, bodyFatPercentage, leanMassKg, method | — (informativo; não integra zonas) |

## Segurança

Escopo organização + acesso do treinador ao atleta em toda entrada; auditoria em
`CREATE_ASSESSMENT` / `UPDATE_ASSESSMENT_DRAFT` / `VALIDATE_ASSESSMENT` (só
ids/ação — valores clínicos e notas livres **não** entram no log). Migração
aditiva; sem reset/destrutivo.

## Rotas

`GET|POST /api/trainer/athletes/[athleteId]/assessments` · `GET|PATCH
/api/trainer/assessments/[id]` · `POST /api/trainer/assessments/[id]/validate`.
