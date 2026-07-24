import {
  invalidInput,
  missingInput,
  type ZoneBand,
  type ZoneComputation,
} from "./training-zone-types";

// Zonas de POTÊNCIA (ciclismo) a partir do FTP — modelo clássico de Coggan
// (7 zonas, %FTP). Saída em watts. Arquitetura pronta para outras referências
// (potência crítica) sem generalizar prematuramente.

export const POWER_FTP_VERSION = "1.0.0";

// %FTP (Coggan). Z7 é aberta no topo; usamos um teto prático.
const FTP_TABLE = [
  { zoneCode: "Z1", label: "Recuperação ativa", low: 0.0, high: 0.55 },
  { zoneCode: "Z2", label: "Endurance", low: 0.55, high: 0.75 },
  { zoneCode: "Z3", label: "Tempo", low: 0.75, high: 0.9 },
  { zoneCode: "Z4", label: "Limiar", low: 0.9, high: 1.05 },
  { zoneCode: "Z5", label: "VO2máx", low: 1.05, high: 1.2 },
  { zoneCode: "Z6", label: "Anaeróbico", low: 1.2, high: 1.5 },
  { zoneCode: "Z7", label: "Neuromuscular", low: 1.5, high: 2.5 },
];

export function powerZonesFromFtp(ftp: number | null | undefined): ZoneComputation {
  if (ftp == null) return missingInput(["ftp"]);
  if (ftp < 50 || ftp > 600) return invalidInput("FTP fora de faixa plausível.");
  const zones: ZoneBand[] = FTP_TABLE.map((z) => ({
    zoneCode: z.zoneCode,
    label: z.label,
    lowerBound: Math.round(z.low * ftp),
    upperBound: Math.round(z.high * ftp),
    unit: "W",
  }));
  return {
    ok: true,
    methodCode: "POWER_FTP",
    methodVersion: POWER_FTP_VERSION,
    unit: "W",
    zones,
    limitations: ["FTP deve ser recente; Z7 é aberta no topo (teto de 250% do FTP é convenção prática)."],
  };
}
