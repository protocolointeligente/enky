import { describe, expect, it } from "vitest";
import { decideMatch, MATCHABLE_WORKOUT_STATUSES } from "@/modules/integrations/match-activity";

const run = { id: "w-run", modality: "RUNNING" as const, hasLinkedActivity: false };
const swim = { id: "w-swim", modality: "SWIMMING" as const, hasLinkedActivity: false };

describe("decideMatch — vínculo realizado → planejado", () => {
  it("vincula quando há exatamente um treino da modalidade no dia", () => {
    expect(decideMatch({ modality: "RUNNING", candidates: [run] })).toEqual({
      status: "MATCHED",
      workoutId: "w-run",
    });
  });

  it("escolhe o treino da modalidade certa entre candidatos do mesmo dia", () => {
    expect(decideMatch({ modality: "SWIMMING", candidates: [run, swim] })).toEqual({
      status: "MATCHED",
      workoutId: "w-swim",
    });
  });

  it("não vincula quando não há treino da modalidade", () => {
    expect(decideMatch({ modality: "CYCLING", candidates: [run, swim] })).toEqual({
      status: "UNMATCHED",
      workoutId: null,
    });
  });

  it("não vincula quando não há candidato nenhum", () => {
    expect(decideMatch({ modality: "RUNNING", candidates: [] })).toEqual({
      status: "UNMATCHED",
      workoutId: null,
    });
  });

  // A decisão central da fase. Duplo período de natação é rotina — e sem hora
  // não há critério de desempate que não seja invenção. Par errado faria o
  // treinador ajustar carga com base numa atribuição que a máquina chutou.
  it("recusa escolher quando há dois treinos da mesma modalidade no dia", () => {
    const decision = decideMatch({
      modality: "SWIMMING",
      candidates: [swim, { ...swim, id: "w-swim-2" }],
    });
    expect(decision).toEqual({ status: "AMBIGUOUS", workoutId: null });
  });

  // 1:1 — a coluna é UNIQUE. Uma segunda corrida no dia não rouba o treino da
  // primeira; ela fica avulsa e o treinador vê as duas.
  it("ignora treino que já tem realizado vinculado", () => {
    expect(
      decideMatch({ modality: "RUNNING", candidates: [{ ...run, hasLinkedActivity: true }] }),
    ).toEqual({ status: "UNMATCHED", workoutId: null });
  });

  it("vincula ao único treino livre quando o outro já está ocupado", () => {
    const decision = decideMatch({
      modality: "RUNNING",
      candidates: [{ ...run, hasLinkedActivity: true }, { ...run, id: "w-run-2" }],
    });
    expect(decision).toEqual({ status: "MATCHED", workoutId: "w-run-2" });
  });

  // Yoga não cumpre um treino de funcional prescrito.
  it("nunca vincula atividade sem modalidade mapeada", () => {
    expect(decideMatch({ modality: null, candidates: [run, swim] })).toEqual({
      status: "UNMATCHED",
      workoutId: null,
    });
  });
});

describe("MATCHABLE_WORKOUT_STATUSES", () => {
  // DRAFT o atleta nem vê; MISSED/CANCELLED/ARCHIVED já foram decididos e não
  // devem ser ressuscitados por uma atividade que apareceu depois.
  it.each(["DRAFT", "MISSED", "CANCELLED", "ARCHIVED"])(
    "não considera treino %s como candidato",
    (status) => {
      expect(MATCHABLE_WORKOUT_STATUSES).not.toContain(status);
    },
  );

  it("considera o treino publicado — o caso normal", () => {
    expect(MATCHABLE_WORKOUT_STATUSES).toContain("PUBLISHED");
  });
});
