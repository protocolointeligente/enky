import { describe, expect, it } from "vitest";
import {
  buildDeliveryPlan,
  initialEntitlementStatus,
} from "@/modules/marketplace-delivery/delivery-payload";

describe("buildDeliveryPlan", () => {
  it("TRAINING_PLAN copia periodização e templates", () => {
    const plan = buildDeliveryPlan("TRAINING_PLAN", {
      periodizationTemplateId: "per-1",
      workoutTemplateIds: ["w-1", "w-2"],
    });
    expect(plan.requiresManualStep).toBe(false);
    expect(plan.actions).toContainEqual({ kind: "COPY_PERIODIZATION", periodizationTemplateId: "per-1" });
    expect(plan.actions).toContainEqual({ kind: "COPY_WORKOUT_TEMPLATES", workoutTemplateIds: ["w-1", "w-2"] });
  });

  it("TRAINING_PLAN só com templates (sem periodização) entrega os templates", () => {
    const plan = buildDeliveryPlan("TRAINING_PLAN", { workoutTemplateIds: ["w-1"] });
    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toEqual({ kind: "COPY_WORKOUT_TEMPLATES", workoutTemplateIds: ["w-1"] });
  });

  it("§6: TRAINING_PLAN sem conteúdo nenhum é erro, não entrega vazia", () => {
    expect(() => buildDeliveryPlan("TRAINING_PLAN", {})).toThrow();
    expect(() => buildDeliveryPlan("TRAINING_PLAN", { workoutTemplateIds: ["  "] })).toThrow();
  });

  it("PERIODIZATION_TEMPLATE exige o template", () => {
    expect(() => buildDeliveryPlan("PERIODIZATION_TEMPLATE", {})).toThrow();
    expect(
      buildDeliveryPlan("PERIODIZATION_TEMPLATE", { periodizationTemplateId: "p" }).actions[0],
    ).toEqual({ kind: "COPY_PERIODIZATION", periodizationTemplateId: "p" });
  });

  it("EXERCISE_LIBRARY_PACK / EDUCATIONAL_CONTENT exigem conteúdo", () => {
    expect(() => buildDeliveryPlan("EXERCISE_LIBRARY_PACK", { exerciseIds: [] })).toThrow();
    expect(() => buildDeliveryPlan("EDUCATIONAL_CONTENT", {})).toThrow();
    expect(buildDeliveryPlan("EXERCISE_LIBRARY_PACK", { exerciseIds: ["e"] }).requiresManualStep).toBe(false);
  });

  it("serviços humanos criam onboarding e exigem passo manual (§25)", () => {
    for (const type of ["COACHING_SERVICE", "CONSULTATION", "ASSESSMENT_SERVICE", "EVENT_PROGRAM"] as const) {
      const plan = buildDeliveryPlan(type, { coachServicePlanId: "svc-1" });
      expect(plan.requiresManualStep).toBe(true);
      expect(plan.actions[0]?.kind).toBe("CREATE_COACHING_ONBOARDING");
    }
  });
});

describe("initialEntitlementStatus", () => {
  it("automático => ACTIVE; humano => PENDING", () => {
    expect(initialEntitlementStatus("WORKOUT_TEMPLATE_PACK")).toBe("ACTIVE");
    expect(initialEntitlementStatus("EDUCATIONAL_CONTENT")).toBe("ACTIVE");
    expect(initialEntitlementStatus("COACHING_SERVICE")).toBe("PENDING");
    expect(initialEntitlementStatus("CONSULTATION")).toBe("PENDING");
  });
});
