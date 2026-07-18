# ENKY — Motor de Zonas de Intensidade

Etapa `feat/athlete-assessments-prescription-zones`, fatias B/C. Complementa
[modules/training-zones/README.md](../modules/training-zones/README.md).

## Perfil consolidado (fatia B)

`getCurrentAthletePerformanceProfile` deriva o valor **atual** de cada indicador
das avaliações **VÁLIDAS**. Regra de seleção **versionada**
(`PROFILE_SELECTION_VERSION = 1.0.0`), pura em `selectBestMetric`:

1. não-expirado **>** expirado;
2. medido **>** estimado;
3. mais recente.

Ausência = `null` (nunca valor inventado). Só-expirado volta **com aviso**
(`expired: true`). FC máxima estimada por idade conta como estimada mesmo sem o
header dizer. Cada indicador carrega procedência (fonte, data, protocolo, versão,
confiança, validade, status).

## Fórmulas de zona (fatia C)

Cada método é **puro, determinístico, versionado**, declara entradas e unidade,
lista `limitations` e retorna **erro tipado**. A UI não conhece as fórmulas —
consulta o `zoneRegistry` e chama o `zone-engine`.

| Código | v | Entradas | Fórmula | Saída | Status |
|---|---|---|---|---|---|
| HR_MAX | 1.0.0 | maximumHeartRate | %FCmáx (Z1–Z5) | bpm | VALIDATED |
| HR_RESERVE | 1.0.0 | maximumHeartRate, restingHeartRate | Karvonen: `rep + %×(máx−rep)` | bpm | VALIDATED |
| HR_THRESHOLD | 1.0.0 | thresholdHeartRate | %LTHR (Friel) | bpm | VALIDATED |
| PACE_THRESHOLD | 1.0.0 | thresholdPace | frações de v(limiar) | s/km | VALIDATED |
| PACE_VAM | 1.0.0 | vam | frações de vVO2máx | s/km | EXPERIMENTAL |
| PACE_CRITICAL_SPEED | 1.0.0 | criticalSpeed | frações de v(CV) | s/km | EXPERIMENTAL |
| PACE_VDOT | 1.0.0 | vdot | Daniels: resolve vVO2máx de `VO2=-4.60+0.182258v+0.000104v²` | s/km | EXPERIMENTAL |
| POWER_FTP | 1.0.0 | ftp | %FTP (Coggan, 7 zonas) | W | VALIDATED |
| SWIM_CSS | 1.0.0 | css | frações de v(CSS) | s/100m | VALIDATED |
| STRENGTH_PERCENT_1RM | 1.0.0 | oneRepMax (+ %) | `%×1RM`, arredondado | kg | VALIDATED |

Estimadores de 1RM (`strength-zones.ts`, v1.0.0): `ONE_RM_DIRECT` (reps=1),
`EPLEY` = `L(1+r/30)`, `BRZYCKI` = `L·36/(37−r)`, `LANDER` = `100L/(101.3−2.67123r)`,
`O_CONNER` = `L(1+0.025r)`. Válidos até ~10–12 reps.

## Limitações científicas

As tabelas de percentuais são um **default v1** (escolas Coggan/Friel/Daniels), não
consenso único; configuração por organização é fatia futura. `PACE_VDOT` aproxima
Daniels por frações de vVO2máx (não é a tabela oficial). Nenhuma saída é diagnóstico.

## Testes

22 testes científicos (`tests/unit/modules/training-zones/zones.test.ts`): valores
conhecidos (Epley 100×5≈116.7; FTP Z4 250→225–263W; Karvonen), conversões de pace,
faixas plausíveis e **erros tipados** (dado ausente/implausível/método desconhecido).
