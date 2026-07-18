# ENKY — Fluxo de Intensidade da Prescrição

Etapa `feat/athlete-assessments-prescription-zones`, fatias D/D2.

## O fluxo

1. O atleta possui avaliações **validadas** (aba Avaliações da 360º).
2. No modal de prescrição, o treinador escolhe o **método** de intensidade e a
   **zona**.
3. O motor (puro, **client-side**) busca o perfil consolidado e calcula a **faixa
   real** — `computeZones(método, zoneInputsFromProfile(perfil))`.
4. O treinador vê a faixa + a **fonte** (avaliação/data/confiança/fórmula+versão) e
   aplica; os campos de alvo (endurance) ou carga (força) são preenchidos.
5. A **proveniência** é gravada com a prescrição.

## Métodos por modalidade (no editor)

- Corrida: RPE, FC, PACE (+ VAM/velocidade via avaliação).
- Ciclismo: RPE, FC, POTÊNCIA.
- Natação: RPE, FC, PACE (/100m via CSS).
- Musculação/Funcional: RPE, RIR, %1RM, carga absoluta.

RPE/cadência não têm zona calculada — entrada manual segue valendo.

## Ausência de dado

Quando falta a avaliação necessária, o modal mostra **"Este atleta ainda não
possui os dados necessários…"** + **Cadastrar avaliação** — e o treinador pode
mudar o método, usar RPE ou informar o valor manualmente. Nunca zera, nunca
inventa, nunca bloqueia o modal inteiro. Avaliação **expirada** avisa.

## Proveniência (congela a interpretação histórica)

Gravada em `WorkoutStep.metadata` (endurance) e `WorkoutExercise.metadata` (força),
via `zoneProvenanceSchema` (strict):

```
intensityMethod, zoneCode, calculatedLowerBound, calculatedUpperBound, unit,
formulaCode, formulaVersion, assessmentId, assessmentDate,
wasManuallyOverridden, overrideReason
```

**Uma avaliação nova NÃO altera um treino já prescrito** — os valores calculados
na data ficam congelados. Base para auditoria e para o comparativo
planejado × realizado.

## Sobrescrita manual

Editar o alvo/carga à mão **limpa a proveniência** (valor digitado não é derivado
de zona — honesto). O `zoneProvenanceSchema` exige **justificativa** quando
`wasManuallyOverridden = true`; o fluxo formal de override-com-motivo-preservado é
o próximo refinamento.

## Limites da etapa

- Re-hidratar a zona ao **editar** um treino já salvo (persiste hoje; re-exibição
  no editor é follow-up — `workout-content` não devolve `metadata`).
- Carga prevista automática (sRPE planejado) e RPE↔zona não entram aqui.
