import { describe, expect, it } from "vitest";
import { computeHrZones, computePowerZones, computeZonesForTest } from "@/modules/assessments/zones";

describe("zonas de treino (padrão da indústria)", () => {
  it("potência = Coggan 7 zonas sobre o FTP", () => {
    const set = computePowerZones(250);
    expect(set.scheme).toBe("POWER_COGGAN");
    expect(set.unit).toBe("W");
    expect(set.zones).toHaveLength(7);
    // Z1 aberta para baixo, teto 55%.
    expect(set.zones[0]).toMatchObject({ min: null, max: 138 });
    // Z4 Limiar em torno do FTP (91–105%).
    expect(set.zones[3]).toMatchObject({ min: 228, max: 263 });
    // Z7 aberta para cima.
    expect(set.zones[6]).toMatchObject({ min: 378, max: null });
  });

  it("FC = Friel 7 zonas sobre o LTHR", () => {
    const set = computeHrZones(160);
    expect(set.scheme).toBe("HR_FRIEL");
    expect(set.zones).toHaveLength(7);
    expect(set.zones[0]).toMatchObject({ min: null, max: 134 }); // Z1 ≤84%
    expect(set.zones[3]).toMatchObject({ min: 152, max: 158 }); // Z4 95–99%
    expect(set.zones[6]).toMatchObject({ min: 171, max: null }); // Z5c ≥107%
  });

  it("resolve o esquema pela unidade e ignora o que não sabe", () => {
    expect(computeZonesForTest("W", 250)?.scheme).toBe("POWER_COGGAN");
    expect(computeZonesForTest("bpm", 160)?.scheme).toBe("HR_FRIEL");
    expect(computeZonesForTest("min/km", 4)).toBeNull();
    expect(computeZonesForTest("W", 0)).toBeNull();
  });
});
