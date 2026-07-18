import { describe, expect, it } from "vitest";
import { hrMaxZones, hrReserveZones, hrThresholdZones } from "@/modules/training-zones/heart-rate-zones";
import {
  paceZonesFromThreshold,
  paceZonesFromVdot,
} from "@/modules/training-zones/pace-zones";
import { powerZonesFromFtp } from "@/modules/training-zones/power-zones";
import { swimZonesFromCss } from "@/modules/training-zones/swim-zones";
import {
  estimateOneRepMax,
  strengthLoadFromPercent,
} from "@/modules/training-zones/strength-zones";
import { computeZones } from "@/modules/training-zones/zone-engine";

function zone(result: ReturnType<typeof hrMaxZones>, code: string) {
  if (!result.ok) throw new Error(`esperava ok, veio erro: ${result.error.message}`);
  const z = result.zones.find((x) => x.zoneCode === code);
  if (!z) throw new Error(`zona ${code} ausente`);
  return z;
}

describe("zonas de FC", () => {
  it("%FCmáx: Z2 de FCmáx 200 = 120–140 bpm", () => {
    const z2 = zone(hrMaxZones(200), "Z2");
    expect([z2.lowerBound, z2.upperBound]).toEqual([120, 140]);
  });

  it("FC de reserva (Karvonen): FCmáx 200 / rep 50 → Z2 140–155", () => {
    const z2 = zone(hrReserveZones(200, 50), "Z2");
    expect([z2.lowerBound, z2.upperBound]).toEqual([140, 155]);
  });

  it("FC de limiar: Z4 de LTHR 170 = 162–168", () => {
    const z4 = zone(hrThresholdZones(170), "Z4");
    expect([z4.lowerBound, z4.upperBound]).toEqual([162, 168]);
  });

  it("erros tipados: falta de dado e valor implausível", () => {
    const miss = hrReserveZones(200, null);
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.error.code).toBe("MISSING_INPUT");
    const bad = hrReserveZones(200, 200); // rep >= máx
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("INVALID_INPUT");
  });
});

describe("zonas de pace", () => {
  it("limiar: pace de limiar 300 s/km (5:00) → zona THRESHOLD contém ~5:00", () => {
    const r = paceZonesFromThreshold(300);
    const t = zone(r, "THRESHOLD");
    // mais rápido = menor número; a zona de limiar cerca os 300 s/km.
    expect(t.lowerBound).toBeLessThan(300);
    expect(t.upperBound).toBeGreaterThan(300);
    expect(t.unit).toBe("s/km");
  });

  it("zonas mais rápidas têm pace MENOR (monotonicidade)", () => {
    const r = paceZonesFromThreshold(300);
    if (!r.ok) throw new Error("esperava ok");
    const easy = r.zones.find((z) => z.zoneCode === "EASY")!;
    const interval = r.zones.find((z) => z.zoneCode === "INTERVAL")!;
    expect(interval.lowerBound).toBeLessThan(easy.lowerBound);
  });

  it("VDOT resolve vVO2máx e produz paces plausíveis", () => {
    const r = paceZonesFromVdot(50);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const easy = r.zones.find((z) => z.zoneCode === "EASY")!;
      expect(easy.lowerBound).toBeGreaterThan(180); // > 3:00/km
      expect(easy.upperBound).toBeLessThan(600); // < 10:00/km
    }
  });

  it("pace sem dado → erro tipado", () => {
    const r = paceZonesFromThreshold(null);
    expect(r.ok).toBe(false);
  });
});

describe("zonas de potência", () => {
  it("FTP 250: Z4 = 225–263 W", () => {
    const z4 = zone(powerZonesFromFtp(250), "Z4");
    expect([z4.lowerBound, z4.upperBound]).toEqual([225, 263]);
  });
  it("FTP ausente → erro", () => {
    expect(powerZonesFromFtp(null).ok).toBe(false);
  });
});

describe("zonas de natação", () => {
  it("CSS 120 s/100m: zona AEROBIC = 120–128 s/100m", () => {
    const a = zone(swimZonesFromCss(120), "AEROBIC");
    expect([a.lowerBound, a.upperBound]).toEqual([120, 128]);
    expect(a.unit).toBe("s/100m");
  });
});

describe("força — estimativa de 1RM", () => {
  it("Epley 100kg×5 ≈ 116.7", () => {
    expect(estimateOneRepMax("EPLEY", 100, 5)).toBeCloseTo(116.7, 1);
  });
  it("Brzycki 100kg×5 = 112.5", () => {
    expect(estimateOneRepMax("BRZYCKI", 100, 5)).toBeCloseTo(112.5, 1);
  });
  it("O'Conner 100kg×5 = 112.5", () => {
    expect(estimateOneRepMax("O_CONNER", 100, 5)).toBeCloseTo(112.5, 1);
  });
  it("Lander 100kg×5 ≈ 113.7", () => {
    expect(estimateOneRepMax("LANDER", 100, 5)).toBeCloseTo(113.7, 1);
  });
  it("direto exige 1 repetição; reps implausíveis → null", () => {
    expect(estimateOneRepMax("ONE_RM_DIRECT", 100, 1)).toBe(100);
    expect(estimateOneRepMax("ONE_RM_DIRECT", 100, 5)).toBeNull();
    expect(estimateOneRepMax("EPLEY", 100, 40)).toBeNull();
  });
});

describe("força — carga por %1RM", () => {
  it("70–75% de 1RM 100 = 70–75 kg", () => {
    const z = zone(strengthLoadFromPercent(100, 70, 75, 2.5), "70-75%");
    expect([z.lowerBound, z.upperBound]).toEqual([70, 75]);
    expect(z.unit).toBe("kg");
  });
  it("arredonda ao incremento (2.5 kg)", () => {
    const r = strengthLoadFromPercent(102, 70, 75, 2.5);
    if (!r.ok) throw new Error("esperava ok");
    expect(r.zones[0]!.lowerBound % 2.5).toBe(0);
    expect(r.zones[0]!.upperBound % 2.5).toBe(0);
  });
  it("1RM ausente → erro tipado", () => {
    expect(strengthLoadFromPercent(null, 70, 75).ok).toBe(false);
  });
});

describe("zone-engine (despacho)", () => {
  it("despacha por código e calcula", () => {
    const r = computeZones("HR_MAX", { maximumHeartRate: 200 });
    expect(r.ok).toBe(true);
  });
  it("método desconhecido → UNKNOWN_METHOD", () => {
    const r = computeZones("NOPE", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UNKNOWN_METHOD");
  });
  it("propaga falta de dado do método", () => {
    const r = computeZones("HR_RESERVE", { maximumHeartRate: 200 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("MISSING_INPUT");
  });
});
