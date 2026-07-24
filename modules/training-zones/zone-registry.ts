import {
  HR_MAX_VERSION,
  HR_RESERVE_VERSION,
  HR_THRESHOLD_VERSION,
} from "./heart-rate-zones";
import {
  PACE_CRITICAL_SPEED_VERSION,
  PACE_THRESHOLD_VERSION,
  PACE_VAM_VERSION,
  PACE_VDOT_VERSION,
} from "./pace-zones";
import { POWER_FTP_VERSION } from "./power-zones";
import { SWIM_CSS_VERSION } from "./swim-zones";
import { STRENGTH_PERCENT_1RM_VERSION } from "./strength-zones";
import type { ZoneUnit } from "./training-zone-types";

// Registro DECLARATIVO dos métodos de zona. A UI consulta o registro (o que
// existe, o que cada método exige, unidade, status) SEM conhecer as fórmulas —
// o cálculo passa pelo zone-engine. Adicionar um método = registrar aqui +
// implementar a função + despachar no engine.

export type ZoneMethodStatus = "VALIDATED" | "EXPERIMENTAL" | "DEPRECATED";
export type ZoneMetricType = "HEART_RATE" | "PACE" | "SWIM_PACE" | "POWER" | "STRENGTH";

export interface ZoneMethodDescriptor {
  code: string;
  version: string;
  metricType: ZoneMetricType;
  modalities: string[]; // Modality[] a que se aplica
  requiredInputs: string[]; // chaves do perfil consolidado (fatia B)
  outputUnit: ZoneUnit;
  description: string;
  status: ZoneMethodStatus;
}

const ENDURANCE = ["RUNNING", "CYCLING", "SWIMMING", "TRIATHLON", "FUNCTIONAL"];

export const ZONE_REGISTRY: ZoneMethodDescriptor[] = [
  {
    code: "HR_MAX",
    version: HR_MAX_VERSION,
    metricType: "HEART_RATE",
    modalities: ENDURANCE,
    requiredInputs: ["maximumHeartRate"],
    outputUnit: "bpm",
    description: "Percentual da FC máxima.",
    status: "VALIDATED",
  },
  {
    code: "HR_RESERVE",
    version: HR_RESERVE_VERSION,
    metricType: "HEART_RATE",
    modalities: ENDURANCE,
    requiredInputs: ["maximumHeartRate", "restingHeartRate"],
    outputUnit: "bpm",
    description: "FC de reserva (Karvonen).",
    status: "VALIDATED",
  },
  {
    code: "HR_THRESHOLD",
    version: HR_THRESHOLD_VERSION,
    metricType: "HEART_RATE",
    modalities: ENDURANCE,
    requiredInputs: ["thresholdHeartRate"],
    outputUnit: "bpm",
    description: "Percentual da FC de limiar (LTHR).",
    status: "VALIDATED",
  },
  {
    code: "PACE_THRESHOLD",
    version: PACE_THRESHOLD_VERSION,
    metricType: "PACE",
    modalities: ["RUNNING", "TRIATHLON"],
    requiredInputs: ["thresholdPace"],
    outputUnit: "s/km",
    description: "Pace por percentual da velocidade de limiar.",
    status: "VALIDATED",
  },
  {
    code: "PACE_VAM",
    version: PACE_VAM_VERSION,
    metricType: "PACE",
    modalities: ["RUNNING", "TRIATHLON"],
    requiredInputs: ["vam"],
    outputUnit: "s/km",
    description: "Pace por percentual da VAM (vVO2máx).",
    status: "EXPERIMENTAL",
  },
  {
    code: "PACE_CRITICAL_SPEED",
    version: PACE_CRITICAL_SPEED_VERSION,
    metricType: "PACE",
    modalities: ["RUNNING", "TRIATHLON"],
    requiredInputs: ["criticalSpeed"],
    outputUnit: "s/km",
    description: "Pace por velocidade crítica.",
    status: "EXPERIMENTAL",
  },
  {
    code: "PACE_VDOT",
    version: PACE_VDOT_VERSION,
    metricType: "PACE",
    modalities: ["RUNNING", "TRIATHLON"],
    requiredInputs: ["vdot"],
    outputUnit: "s/km",
    description: "Pace por VDOT (aproximação de Daniels).",
    status: "EXPERIMENTAL",
  },
  {
    code: "POWER_FTP",
    version: POWER_FTP_VERSION,
    metricType: "POWER",
    modalities: ["CYCLING", "TRIATHLON"],
    requiredInputs: ["ftp"],
    outputUnit: "W",
    description: "Potência por percentual do FTP (Coggan).",
    status: "VALIDATED",
  },
  {
    code: "SWIM_CSS",
    version: SWIM_CSS_VERSION,
    metricType: "SWIM_PACE",
    modalities: ["SWIMMING", "TRIATHLON"],
    requiredInputs: ["css"],
    outputUnit: "s/100m",
    description: "Ritmo de natação por percentual do CSS.",
    status: "VALIDATED",
  },
  {
    code: "STRENGTH_PERCENT_1RM",
    version: STRENGTH_PERCENT_1RM_VERSION,
    metricType: "STRENGTH",
    modalities: ["STRENGTH", "FUNCTIONAL"],
    requiredInputs: ["oneRepMax"],
    outputUnit: "kg",
    description: "Carga por percentual do 1RM.",
    status: "VALIDATED",
  },
];

export function zoneMethod(code: string): ZoneMethodDescriptor | undefined {
  return ZONE_REGISTRY.find((m) => m.code === code);
}

export function zoneMethodsForModality(modality: string): ZoneMethodDescriptor[] {
  return ZONE_REGISTRY.filter((m) => m.modalities.includes(modality));
}
