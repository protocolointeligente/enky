import type { PerformanceProfile } from "@/modules/assessments/performance-profile";
import {
  hrMaxZones,
  hrReserveZones,
  hrThresholdZones,
} from "./heart-rate-zones";
import {
  paceZonesFromCriticalSpeed,
  paceZonesFromThreshold,
  paceZonesFromVam,
  paceZonesFromVdot,
} from "./pace-zones";
import { powerZonesFromFtp } from "./power-zones";
import { swimZonesFromCss } from "./swim-zones";
import { strengthLoadFromPercent, type LoadIncrement } from "./strength-zones";
import { zoneMethod } from "./zone-registry";
import type { ZoneComputation } from "./training-zone-types";

// Ponto único de cálculo. A UI passa o CÓDIGO do método + as entradas; o engine
// despacha para a fórmula certa. Nunca a UI conhece a matemática. Método
// desconhecido → erro tipado.

export interface ZoneInputs {
  maximumHeartRate?: number | null;
  restingHeartRate?: number | null;
  thresholdHeartRate?: number | null;
  thresholdPace?: number | null;
  vam?: number | null;
  criticalSpeed?: number | null;
  vdot?: number | null;
  ftp?: number | null;
  css?: number | null;
  oneRepMax?: number | null;
  // Força: a "zona" é o intervalo de %1RM escolhido pelo treinador.
  percentLow?: number;
  percentHigh?: number;
  loadIncrement?: LoadIncrement;
}

export function computeZones(methodCode: string, inputs: ZoneInputs): ZoneComputation {
  switch (methodCode) {
    case "HR_MAX":
      return hrMaxZones(inputs.maximumHeartRate);
    case "HR_RESERVE":
      return hrReserveZones(inputs.maximumHeartRate, inputs.restingHeartRate);
    case "HR_THRESHOLD":
      return hrThresholdZones(inputs.thresholdHeartRate);
    case "PACE_THRESHOLD":
      return paceZonesFromThreshold(inputs.thresholdPace);
    case "PACE_VAM":
      return paceZonesFromVam(inputs.vam);
    case "PACE_CRITICAL_SPEED":
      return paceZonesFromCriticalSpeed(inputs.criticalSpeed);
    case "PACE_VDOT":
      return paceZonesFromVdot(inputs.vdot);
    case "POWER_FTP":
      return powerZonesFromFtp(inputs.ftp);
    case "SWIM_CSS":
      return swimZonesFromCss(inputs.css);
    case "STRENGTH_PERCENT_1RM":
      return strengthLoadFromPercent(
        inputs.oneRepMax,
        inputs.percentLow ?? 70,
        inputs.percentHigh ?? 75,
        inputs.loadIncrement ?? 2.5,
      );
    default:
      return {
        ok: false,
        error: { code: "UNKNOWN_METHOD", message: `Método de zona desconhecido: ${methodCode}.` },
      };
  }
}

// Ponte fatia B → C: monta as entradas escalares a partir do perfil consolidado.
// Só copia o valor; a proveniência (fonte/data/expirado) fica no próprio perfil,
// que o modal exibe ao lado da faixa. `oneRepMax` vem por exercício (fatia D
// escolhe o exercício); aqui expomos só os escalares comuns.
export function zoneInputsFromProfile(profile: PerformanceProfile): ZoneInputs {
  const v = (key: string): number | null => profile.metrics[key]?.value ?? null;
  return {
    maximumHeartRate: v("maximumHeartRate"),
    restingHeartRate: v("restingHeartRate"),
    thresholdHeartRate: v("thresholdHeartRate"),
    thresholdPace: v("thresholdPace"),
    vam: v("vam"),
    criticalSpeed: v("criticalSpeed"),
    vdot: v("vdot"),
    ftp: v("ftp"),
    css: v("css"),
  };
}

// Qual avaliação alimentou um método — para o modal mostrar a fonte da faixa.
export function sourceForMethod(profile: PerformanceProfile, methodCode: string) {
  const method = zoneMethod(methodCode);
  if (!method) return null;
  // A fonte é a do PRIMEIRO input requerido presente no perfil (o determinante).
  for (const key of method.requiredInputs) {
    const m = profile.metrics[key];
    if (m) return m;
  }
  return null;
}
