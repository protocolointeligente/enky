import { describe, expect, it } from "vitest";
import {
  reasonRequired,
  transitionTarget,
} from "@/modules/admin/marketplace-moderation-rules";

describe("transitionTarget", () => {
  it("approves/rejects only from PENDING_REVIEW", () => {
    expect(transitionTarget("APPROVE", "PENDING_REVIEW")).toBe("APPROVED");
    expect(transitionTarget("REJECT", "PENDING_REVIEW")).toBe("REJECTED");
    expect(transitionTarget("APPROVE", "DRAFT")).toBeNull();
    expect(transitionTarget("APPROVE", "PUBLISHED")).toBeNull();
  });

  it("suspends a live product and reinstates a suspended one", () => {
    expect(transitionTarget("SUSPEND", "PUBLISHED")).toBe("SUSPENDED");
    expect(transitionTarget("SUSPEND", "APPROVED")).toBe("SUSPENDED");
    expect(transitionTarget("SUSPEND", "DRAFT")).toBeNull();
    expect(transitionTarget("REINSTATE", "SUSPENDED")).toBe("APPROVED");
    expect(transitionTarget("REINSTATE", "REJECTED")).toBeNull();
  });

  it("archives from any non-archived state but not from archived", () => {
    for (const s of ["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "REJECTED", "SUSPENDED"] as const) {
      expect(transitionTarget("ARCHIVE", s)).toBe("ARCHIVED");
    }
    expect(transitionTarget("ARCHIVE", "ARCHIVED")).toBeNull();
  });
});

describe("reasonRequired", () => {
  it("requires a reason for reject and suspend, not for approve/reinstate/archive", () => {
    expect(reasonRequired("REJECT")).toBe(true);
    expect(reasonRequired("SUSPEND")).toBe(true);
    expect(reasonRequired("APPROVE")).toBe(false);
    expect(reasonRequired("REINSTATE")).toBe(false);
    expect(reasonRequired("ARCHIVE")).toBe(false);
  });
});
