import { describe, expect, it } from "vitest";
import {
  computeHrZones,
  computePowerZones,
  computeRunningPaceZones,
  computeZonesForTest,
  formatSecondsAsPace,
  isPaceUnit,
  parsePaceToSeconds,
} from "@/modules/assessments/zones";

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

  it("pace de corrida = faixas por % da velocidade de limiar (inverso)", () => {
    const set = computeRunningPaceZones(240); // 4:00/km
    expect(set.scheme).toBe("PACE_RUNNING");
    expect(set.unit).toBe("s/km");
    // Z4 Limiar: 240 (no limiar) até 240/0.95 (mais lento).
    expect(set.zones[3]).toMatchObject({ min: 240, max: 253 });
    // Z5 VO2: mais rápido que o limiar, aberto para cima (min null).
    expect(set.zones[4]).toMatchObject({ min: null, max: 240 });
    // Z1 Recuperação: mais lento, aberto para baixo (max null).
    expect(set.zones[0]).toMatchObject({ min: 300, max: null });
  });

  it("resolve o esquema pela unidade e ignora o que não sabe", () => {
    expect(computeZonesForTest("W", 250)?.scheme).toBe("POWER_COGGAN");
    expect(computeZonesForTest("bpm", 160)?.scheme).toBe("HR_FRIEL");
    expect(computeZonesForTest("s/km", 240)?.scheme).toBe("PACE_RUNNING");
    expect(computeZonesForTest("s/100m", 90)?.scheme).toBe("PACE_SWIM");
    expect(computeZonesForTest("min/km", 4)).toBeNull();
    expect(computeZonesForTest("W", 0)).toBeNull();
  });

  it("mm:ss ↔ segundos", () => {
    expect(parsePaceToSeconds("4:15")).toBe(255);
    expect(parsePaceToSeconds("1:05")).toBe(65);
    expect(parsePaceToSeconds("abc")).toBeNull();
    expect(parsePaceToSeconds("4:99")).toBeNull();
    expect(formatSecondsAsPace(255)).toBe("4:15");
    expect(formatSecondsAsPace(65)).toBe("1:05");
    expect(isPaceUnit("s/km")).toBe(true);
    expect(isPaceUnit("bpm")).toBe(false);
  });
});
