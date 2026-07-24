# modules/training-zones

Motor de zonas de intensidade — **fatia C** da etapa
`feat/athlete-assessments-prescription-zones`.

Módulo **puro** (sem Prisma): recebe os valores do perfil consolidado (fatia B) e
devolve as faixas reais de intensidade. A UI **não conhece as fórmulas** — consulta
o `zoneRegistry` (o que existe) e chama o `zone-engine` (o cálculo).

## Princípios

Toda fórmula é pura, determinística, **versionada** (`*_VERSION`), declara entradas
e unidade, lista `limitations`, e retorna **erro tipado** (`ZoneComputation` =
`{ok:true,...}` | `{ok:false,error}`) — nunca lança para fluxo de negócio. Cada
método tem a SUA função (não há genérico que misture referências).

## Unidades (contrato com as avaliações)

FC **bpm** · pace corrida **s/km** · pace natação **s/100 m** · potência **W** ·
carga **kg**. Em pace/s-por-100m o **menor número é o mais rápido**.

## Métodos (ver `zone-registry.ts`)

| Código | Métrica | Entrada | Status |
|---|---|---|---|
| `HR_MAX` | FC | maximumHeartRate | VALIDATED |
| `HR_RESERVE` (Karvonen) | FC | maximumHeartRate, restingHeartRate | VALIDATED |
| `HR_THRESHOLD` | FC | thresholdHeartRate | VALIDATED |
| `PACE_THRESHOLD` | pace | thresholdPace | VALIDATED |
| `PACE_VAM` | pace | vam | EXPERIMENTAL |
| `PACE_CRITICAL_SPEED` | pace | criticalSpeed | EXPERIMENTAL |
| `PACE_VDOT` | pace | vdot | EXPERIMENTAL |
| `POWER_FTP` (Coggan) | potência | ftp | VALIDATED |
| `SWIM_CSS` | pace natação | css | VALIDATED |
| `STRENGTH_PERCENT_1RM` | carga | oneRepMax (+ %) | VALIDATED |

Estimadores de 1RM em `strength-zones.ts`: `ONE_RM_DIRECT`, `EPLEY`, `BRZYCKI`,
`LANDER`, `O_CONNER`.

## Uso

```ts
import { computeZones, zoneInputsFromProfile } from "@/modules/training-zones/zone-engine";
const result = computeZones("HR_RESERVE", zoneInputsFromProfile(profile));
// result.ok ? result.zones : result.error (tipado)
```

## Limitações científicas

As tabelas de percentuais são um **default v1** (escolas Coggan/Friel/Daniels), não
consenso único; a configuração por organização é fatia futura. `PACE_VDOT` aproxima
Daniels por frações de vVO2máx — marcado `EXPERIMENTAL`. Nenhuma saída é diagnóstico.
