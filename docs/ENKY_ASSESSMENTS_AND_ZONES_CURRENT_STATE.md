# ENKY — Estado atual: Avaliações e Zonas de Intensidade

> Auditoria inicial da etapa `feat/athlete-assessments-prescription-zones` (item #1).
> Documento de estado **antes** de qualquer alteração de código. Base: branch
> `feat/athlete-assessments-prescription-zones` (criada de `fix/production-critical-calendar-athlete-360`).

## 1. Resumo executivo

Hoje o treinador digita **manualmente** todos os valores de intensidade (FC min/max,
pace, potência, carga, RIR, RPE) em cada passo/exercício do treino. Não existe:

- modelo de **avaliação** fisiológica/esportiva versionada em uso;
- **perfil fisiológico** consolidado do atleta;
- **motor de zonas** (FC, pace, potência, natação, força);
- integração avaliação → zona → valor real no modal de prescrição.

Existem, porém, **fundações reaproveitáveis**: modelos vestigiais próximos do
conceito de avaliação, o padrão de "JSON validado por Zod + fórmula versionada",
e o serviço report-free de métricas criado na etapa anterior.

## 2. Modelos existentes relevantes

| Modelo | Situação | Observação |
|---|---|---|
| `TestResult` | **definido, sem uso em código** | `org/athlete/trainer/testType/resultValue/unit/protocol/calculatedMetrics(Json)/performedAt/lockVersion`. É o embrião de "avaliação", mas genérico (um único valor) e sem ciclo de vida (status/validade/confiança/versão de protocolo). |
| `DerivedMetric` | **definido, sem uso em código** | `metricKey/metricValue/period/formulaVersion/status(DerivedMetricStatus)`. Guarda métrica derivada por período — não é avaliação de entrada. |
| `AthleteProfile` | em uso | Só `birthDate/gender/weightKg/heightCm`. **Nenhum** campo de performance (FC repouso/máx, FTP, VDOT, CSS, 1RM). |
| `WorkoutStep` | em uso | `targetType(IntensityTargetType: PACE/HEART_RATE_ZONE/POWER/CADENCE/RPE)`, `targetMin/targetMax(Decimal)`, `metadata(Json)`. É onde a intensidade endurance é gravada. |
| `WorkoutExercise` | em uso | `loadKg/rir/rpeTarget` — intensidade de força. |
| `Periodization` | em uso | `parameters(Json)` validado por Zod (`periodizationParametersSchema`) guarda VDOT/pace/FTP/CSS/séries etc. do PLANO — não do atleta. |

**Conclusão de duplicação:** `TestResult` e `DerivedMetric` não têm consumidores.
`TestResult` é conceitualmente o alvo, mas seu formato genérico (single value) não
comporta os payloads tipados por protocolo que a etapa exige (FC repouso+máx+limiar;
VDOT+VAM; FTP; CSS; 1RM+fórmula). Ver §7 (decisão).

## 3. Fluxo de intensidade atual (o que será reconstruído)

- UI: `components/blocks-editor.tsx` — o treinador escolhe `targetType` por passo e
  **digita** `targetMin`/`targetMax` (bpm, min/km, W). Para força, digita `loadKg/rir/rpe`.
- Validação: `modules/workouts/prescription-schema.ts` (`workoutStepInputSchema`).
- Persistência: `modules/workouts/persist-blocks.ts` → `WorkoutStep`/`WorkoutExercise`.
- Modalidades por método já mapeadas no editor:
  RUNNING/SWIMMING → PACE/HR/RPE; CYCLING → POWER/HR/CADENCE/RPE; TRIATHLON → todos.

Nenhum valor é derivado de avaliação: tudo é entrada crua e re-digitada a cada sessão.

## 4. Regras científicas já presentes

- `modules/intelligence/load-state.ts` — `computeLoadState` (CTL/ATL/TSB/ACWR/monotonia/
  strain/ramp) com `LOAD_FORMULA_VERSION = "1.0.0"`. Puro, determinístico, testado.
- `modules/intelligence/readiness.ts` — `classifyReadiness` (prontidão).
- `modules/intelligence/athlete-context.ts` (etapa anterior) — perfil de carga/prontidão
  report-free, com `formulaVersion`, suficiência de histórico e "última atualização".

**Não existe** nenhuma fórmula de zona (FC%/FCR/VDOT/FTP/CSS/1RM). Tudo será novo.

## 5. Padrões da base a reutilizar (evita reinvenção)

1. **JSON validado por Zod** para payloads variáveis (`Periodization.parameters`,
   `WorkoutStep.metadata`, `TestResult.calculatedMetrics`). → usar para as medições
   por protocolo da avaliação e para a proveniência da zona na prescrição.
2. **Fórmula versionada** (`LOAD_FORMULA_VERSION`) → cada método de zona terá `code`+`version`.
3. **Serviço report-free** (`athlete-context`) → mesmo espírito para o perfil consolidado.
4. **Chokepoint de erro** (`server/http/response.ts` `apiError`) + `ErrorNotice` (código ao usuário).
5. **Stack de guardas** (`requireAuthenticatedUser`/`requireGlobalRole`/`requireTrainerAccessToAthlete`/
   `resolveActiveOrganization`) + `assertTrustedOrigin` (CSRF) + `enforceRateLimit` + `recordAuditLog`.
6. **Módulo puro + registro** (padrão de `intelligence`) → `modules/training-zones/` puro,
   com `zoneRegistry` declarativo que a UI consulta sem conhecer fórmulas.

## 6. Lacunas (o que falta)

- Modelo de **avaliação versionada** com ciclo de vida (DRAFT/VALID/SUPERSEDED/EXPIRED/INVALID),
  fonte (MEASURED/ESTIMATED/…), confiança, validade, protocolo+versão, autor.
- Campos/payloads de **performance por modalidade** (FC; corrida; ciclismo; natação; força).
- **Serviço de perfil consolidado** (`getCurrentAthletePerformanceProfile`) com seleção da
  avaliação válida mais recente, preferência medido>estimado, expiração explícita.
- **Motor de zonas puro** (`modules/training-zones/`): FC (%FCmáx, %FCR, %FClimiar), pace
  (VDOT/VAM/CV/limiar), potência (FTP), natação (CSS), força (%1RM + Epley/Brzycki/Lander/O'Conner).
- **Registro de zonas** declarativo (`code/version/modality/metricType/requiredInputs/outputUnit/
  limitations/status`).
- **Reconstrução da seção de intensidade** do modal (método+zona → faixa calculada + fonte).
- **Proveniência na prescrição** (método/zona/limites calculados/fórmula+versão/assessmentId/
  data/override+motivo) — para não alterar retroativamente treinos passados.
- Aba **Avaliações** na página 360º (listar/criar/validar/histórico/comparar/expirada).

## 7. Decisão de modelagem (proposta)

Introduzir **novo modelo `Assessment`** (cabeçalho + `measurements Json` validado por Zod
por protocolo + `derivedMetrics Json`), **em vez de** forçar o `TestResult` genérico.
Motivo: os protocolos produzem conjuntos de indicadores diferentes (um teste de 5 km →
VDOT+pace+VAM; FTP 20 min → FTP+FClimiar), que não cabem num único `resultValue`. O
`Assessment` reusa o padrão JSON-validado já consagrado na base.

`TestResult`/`DerivedMetric` (sem uso) ficam como estão nesta etapa (não apagar — regra da
etapa); recomenda-se **deprecação futura** documentada, não remoção agora.

Proveniência da prescrição: gravar em `WorkoutStep.metadata` / `WorkoutExercise` (JSON
validado) para não exigir migração de muitas colunas — decisão a confirmar na fatia de
integração (§8, fatia D).

## 8. Proposta de implementação (fatias pequenas, commits separados)

- **A — Fundação de dados:** modelo `Assessment` + enums (`AssessmentStatus`, `AssessmentSource`)
  + migração aditiva + schema Zod dos protocolos + serviço CRUD com guardas/auditoria + testes.
- **B — Perfil consolidado:** `getCurrentAthletePerformanceProfile` (seleção válida/medido>estimado/
  expiração) + testes unitários e de integração.
- **C — Motor de zonas:** `modules/training-zones/` puro + `zoneRegistry` + FC/pace/potência/
  natação/força, cada fórmula com `code/version/limitations` + bateria de testes científicos.
- **D — Integração ao modal:** reconstruir a seção de intensidade (método→zona→faixa+fonte),
  estados de dado insuficiente/expirado, sobrescrita com justificativa; gravar proveniência.
- **E — Aba Avaliações (360º):** listar/criar/validar/histórico/comparar.
- **F — E2E + docs finais.**

## 9. Riscos

- **Banco isolado indisponível localmente** (docker ausente; só Neon de dev compartilhado).
  Migrações serão **escritas e validadas por `prisma validate`**, aplicadas via `migrate-on-deploy`
  no ambiente com credenciais — **nunca** em produção manualmente. Integração/E2E dependem de DB
  migrado (rodam em CI/preview).
- **Rigor científico:** fórmulas de zona variam por escola (Coggan, Daniels, Karvonen). Cada uma
  entra com `code/version/status=EXPERIMENTAL|VALIDATED` e limitações declaradas — sem fingir consenso.
- **Retroatividade:** nova avaliação não pode alterar treino já prescrito → proveniência gravada na
  prescrição (não referência viva).
- **Dados de saúde:** notas livres e campos clínicos **redigidos** nos logs de auditoria.

## 10. Limites desta etapa (fora de escopo, confirmados)

CRM, cobrança/assessoria, marketplace, geração automática completa de periodização, app nativo,
comunicação, prescrição automática sem confirmação, diagnóstico médico, recomendação clínica.
Composição corporal: pode entrar no **modelo**, mas **não** integra o motor de zonas agora.
