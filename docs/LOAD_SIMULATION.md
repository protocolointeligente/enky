# LOAD_SIMULATION — Simulação de carga (ENKY Intelligence 2.0 · Fase 6)

> **Status:** implementada (`modules/load-simulation`, pura e testada — 7 testes)
> + rota de preview + botão "Simular carga" no modo estratégico. **Não grava** —
> é uma projeção para decidir antes de salvar.

## 1. O que faz

"Simular alterações antes de salvar": projeta **CTL/ATL/TSB** dia a dia adiante,
por cima do **histórico real** do atleta, para o plano proposto — mostrando o
novo CTL (fitness), o vale de TSB no pico e o TSB na prova (efeito do taper),
além do volume total planejado.

```
histórico sRPE do atleta ─► seedFromHistory ─► CTL/ATL de HOJE ─┐
                                                                 ├─► projectLoad ─► start · peak · end · trajetória
plano (Fase 1) ─► enriquecer (Fase 3) ─► carga prevista/sessão ──┘
```

## 2. Mesma matemática do painel (não pode divergir)

O motor usa **as mesmas** constantes de tempo e o mesmo EWMA impulso-resposta do
`modules/intelligence/load-state.ts` (CTL 42 d, ATL 7 d) — agora exportados. Um
teste trava a invariante: `seedFromHistory(série)` bate com o `computeLoadState`
da mesma série. Se a projeção divergisse da leitura, o "simular" mentiria.

## 3. Núcleo puro (`simulate-load.ts`)

- `seedFromHistory(historyDaily)` — roda o EWMA sobre o histórico e devolve o
  CTL/ATL do último dia (o "hoje").
- `projectLoad(historyDaily, proposed[])` — projeta dia a dia sobre a janela das
  sessões propostas (dias sem sessão = carga 0; o repouso também move a EWMA — é
  o que faz o CTL cair no taper). Devolve `start`, `end`, `peak` (CTL máx, TSB
  mín), a trajetória diária e a carga somada por semana ISO.

## 4. Serviço e rota

- `simulateStrategyLoad(athleteId, input, actor, now)` — monta o macrociclo
  (Fase 1), enriquece cada semana para obter a carga prevista por sessão (Fase
  2/3), lê a série de sRPE do atleta (últimos 42 dias, igual ao `load-state`) e
  projeta. Devolve `{ simulation, confidence, totalVolumeKm, historyDays }`.
- `POST /api/trainer/athletes/[athleteId]/periodizations/strategy/simulate` —
  preview; exige acesso treinador↔atleta; não grava.

## 5. UI

No modal "✨ Gerar com ENKY", o botão **"Projetar carga do plano"** mostra uma
tabela **Hoje → Pico → Na prova** de CTL/ATL/TSB, o volume total planejado e um
aviso quando há pouco histórico (partida de base fraca).

## 6. Postura

- **Projeção, não promessa.** A carga futura vem da carga prevista por sessão
  (estimativa da Fase 3). O TSB projetado é um cenário para decidir.
- **Não decide nada.** Não corta volume nem sessão — só mostra o que a alteração
  faria à trajetória. TSB negativo no pico é esperado; positivo na prova é o
  objetivo do taper.
- **Honesta sobre a partida.** `historyDays` diz de quantos dias de carga real a
  projeção parte; pouco histórico é sinalizado.
