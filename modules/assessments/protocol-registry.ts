// Catálogo de protocolos de avaliação da ENKY — versionado e type-safe.
// Cada entrada é imutável após publicação. Para adicionar um protocolo, adicione
// uma nova entrada com code+version únicos; nunca edite entradas existentes que
// já tenham avaliações de atletas associadas.
//
// Convenções:
//   code: SCREAMING_SNAKE_CASE, estável no tempo.
//   version: semver "MAJOR.MINOR.PATCH"
//   category: um dos ASSESSMENT_CATEGORIES abaixo.
//   equationCode: chave em protocol-engine.ts que executa o cálculo.

export const ASSESSMENT_CATEGORIES = [
  "ANTHROPOMETRY",
  "BODY_COMPOSITION",
  "CARDIORESPIRATORY",
  "STRENGTH",
  "POWER",
  "SPEED_AGILITY",
  "FLEXIBILITY_MOBILITY",
  "BALANCE",
  "FUNCTIONAL",
  "QUESTIONNAIRE",
  "SPORT_SPECIFIC",
  "CUSTOM",
] as const;

export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];

export const ASSESSMENT_CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  ANTHROPOMETRY: "Antropometria",
  BODY_COMPOSITION: "Composição Corporal",
  CARDIORESPIRATORY: "Cardiorrespiratório",
  STRENGTH: "Força",
  POWER: "Potência",
  SPEED_AGILITY: "Velocidade e Agilidade",
  FLEXIBILITY_MOBILITY: "Flexibilidade e Mobilidade",
  BALANCE: "Equilíbrio",
  FUNCTIONAL: "Avaliação Funcional",
  QUESTIONNAIRE: "Questionários",
  SPORT_SPECIFIC: "Específico por Modalidade",
  CUSTOM: "Protocolo Personalizado",
};

export const EVIDENCE_LEVELS = ["LOW", "MODERATE", "HIGH"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const FIELD_TYPES = ["NUMBER", "SELECT", "TEXT", "BOOLEAN"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface ProtocolField {
  key: string;
  label: string;
  unit: string;
  fieldType: FieldType;
  required: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  hint?: string;
  /** Para campos bilaterais, pode ser "left" | "right" */
  side?: "left" | "right" | "both";
}

export interface ProtocolDefinition {
  code: string;
  version: string;
  name: string;
  category: AssessmentCategory;
  description: string;
  objective: string;
  targetPopulation: string[];
  contraindications: string[];
  ageMin?: number;
  ageMax?: number;
  /** "M" | "F" | undefined = sem distinção de sexo */
  sex?: "M" | "F";
  equipment: string[];
  durationMinutes?: number;
  instructions?: string;
  /**
   * Chave em protocol-engine.ts que executa o cálculo.
   * undefined = entrada direta sem cálculo (ex: BIA_ENTRY, DEXA_ENTRY).
   */
  equationCode?: string;
  resultUnit: string;
  /** Chave em normative-references.ts; undefined = sem classificação normativa */
  classificationRef?: string;
  evidence: EvidenceLevel;
  reference: string;
  isCustom: boolean;
  fields: ProtocolField[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Campos reutilizáveis
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_WEIGHT: ProtocolField = {
  key: "weight_kg",
  label: "Massa corporal",
  unit: "kg",
  fieldType: "NUMBER",
  required: true,
  min: 20,
  max: 300,
};

const FIELD_AGE: ProtocolField = {
  key: "age_years",
  label: "Idade",
  unit: "anos",
  fieldType: "NUMBER",
  required: true,
  min: 5,
  max: 100,
};

const FIELD_SEX: ProtocolField = {
  key: "sex",
  label: "Sexo biológico",
  unit: "",
  fieldType: "SELECT",
  required: true,
  options: [
    { value: "M", label: "Masculino" },
    { value: "F", label: "Feminino" },
  ],
};

const FIELD_EXERCISE_ID: ProtocolField = {
  key: "exercise_id",
  label: "Exercício",
  unit: "",
  fieldType: "TEXT",
  required: true,
  hint: "Pesquise na biblioteca de exercícios",
};

// Skinfold fields
const SF_CHEST: ProtocolField = { key: "chest_mm", label: "Peitoral", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_AXILLA: ProtocolField = { key: "axilla_mm", label: "Axilar média", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_TRICEPS: ProtocolField = { key: "triceps_mm", label: "Tríceps", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_SUBSCAPULAR: ProtocolField = { key: "subscapular_mm", label: "Subescapular", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_ABDOMINAL: ProtocolField = { key: "abdominal_mm", label: "Abdominal", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_SUPRAILIAC: ProtocolField = { key: "suprailiac_mm", label: "Suprailíaco", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_THIGH: ProtocolField = { key: "thigh_mm", label: "Coxa", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };
const SF_CALF: ProtocolField = { key: "calf_mm", label: "Panturrilha", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80 };

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO COMPLETO
// ─────────────────────────────────────────────────────────────────────────────

export const PROTOCOL_REGISTRY: ProtocolDefinition[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // COMPOSIÇÃO CORPORAL
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "JP7_MALE",
    version: "1.0.0",
    name: "Jackson-Pollock 7 Dobras (Masculino)",
    category: "BODY_COMPOSITION",
    description: "Equação preditiva de densidade corporal por 7 dobras cutâneas para homens adultos.",
    objective: "Estimar percentual de gordura corporal, massa gorda e massa magra.",
    targetPopulation: ["Homens adultos (18–80 anos)", "Atletas", "Sedentários"],
    contraindications: ["Edema generalizado", "Deformidade grave de tecido subcutâneo"],
    ageMin: 18, ageMax: 80, sex: "M",
    equipment: ["Adipômetro (skinfold caliper)", "Balança"],
    durationMinutes: 15,
    instructions: "Medir sempre o lado direito, atleta em pé e relaxado. Cada dobra medida 3 vezes; usar a mediana. Segurar dobra com polegar e indicador; aplicar o adipômetro 1 cm abaixo dos dedos.",
    equationCode: "JP7_MALE_SIRI",
    resultUnit: "%",
    classificationRef: "BODY_FAT_MALE_ADULT",
    evidence: "HIGH",
    reference: "Jackson AS, Pollock ML. Br J Nutr. 1978;40(3):497-504. Siri WE. Body composition from fluid spaces. 1956.",
    isCustom: false,
    fields: [FIELD_WEIGHT, FIELD_AGE, SF_CHEST, SF_AXILLA, SF_TRICEPS, SF_SUBSCAPULAR, SF_ABDOMINAL, SF_SUPRAILIAC, SF_THIGH],
  },

  {
    code: "JP7_FEMALE",
    version: "1.0.0",
    name: "Jackson-Pollock 7 Dobras (Feminino)",
    category: "BODY_COMPOSITION",
    description: "Equação preditiva de densidade corporal por 7 dobras cutâneas para mulheres adultas.",
    objective: "Estimar percentual de gordura corporal, massa gorda e massa magra.",
    targetPopulation: ["Mulheres adultas (18–80 anos)", "Atletas", "Sedentárias"],
    contraindications: ["Edema generalizado", "Gestação"],
    ageMin: 18, ageMax: 80, sex: "F",
    equipment: ["Adipômetro", "Balança"],
    durationMinutes: 15,
    instructions: "Medir lado direito. Cada dobra 3 vezes; usar a mediana.",
    equationCode: "JP7_FEMALE_SIRI",
    resultUnit: "%",
    classificationRef: "BODY_FAT_FEMALE_ADULT",
    evidence: "HIGH",
    reference: "Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc. 1980;12(3):175-81.",
    isCustom: false,
    fields: [FIELD_WEIGHT, FIELD_AGE, SF_CHEST, SF_AXILLA, SF_TRICEPS, SF_SUBSCAPULAR, SF_ABDOMINAL, SF_SUPRAILIAC, SF_THIGH],
  },

  {
    code: "JP3_MALE",
    version: "1.0.0",
    name: "Jackson-Pollock 3 Dobras (Masculino)",
    category: "BODY_COMPOSITION",
    description: "Versão simplificada com peitoral, abdominal e coxa.",
    objective: "Estimativa rápida de % gordura em homens.",
    targetPopulation: ["Homens adultos"],
    contraindications: [],
    ageMin: 18, ageMax: 80, sex: "M",
    equipment: ["Adipômetro", "Balança"],
    durationMinutes: 10,
    equationCode: "JP3_MALE_SIRI",
    resultUnit: "%",
    classificationRef: "BODY_FAT_MALE_ADULT",
    evidence: "HIGH",
    reference: "Jackson AS, Pollock ML. Br J Nutr. 1978;40(3):497-504.",
    isCustom: false,
    fields: [FIELD_WEIGHT, FIELD_AGE, SF_CHEST, SF_ABDOMINAL, SF_THIGH],
  },

  {
    code: "JP3_FEMALE",
    version: "1.0.0",
    name: "Jackson-Pollock 3 Dobras (Feminino)",
    category: "BODY_COMPOSITION",
    description: "Versão simplificada com tríceps, suprailíaco e coxa.",
    objective: "Estimativa rápida de % gordura em mulheres.",
    targetPopulation: ["Mulheres adultas"],
    contraindications: ["Gestação"],
    ageMin: 18, ageMax: 80, sex: "F",
    equipment: ["Adipômetro", "Balança"],
    durationMinutes: 10,
    equationCode: "JP3_FEMALE_SIRI",
    resultUnit: "%",
    classificationRef: "BODY_FAT_FEMALE_ADULT",
    evidence: "HIGH",
    reference: "Jackson AS, Pollock ML, Ward A. Med Sci Sports Exerc. 1980;12(3):175-81.",
    isCustom: false,
    fields: [FIELD_WEIGHT, FIELD_AGE, SF_TRICEPS, SF_SUPRAILIAC, SF_THIGH],
  },

  {
    code: "GUEDES_3",
    version: "1.0.0",
    name: "Guedes 3 Dobras",
    category: "BODY_COMPOSITION",
    description: "Protocolo brasileiro validado para populações latino-americanas adultas.",
    objective: "Estimar % gordura com 3 dobras em adultos brasileiros.",
    targetPopulation: ["Adultos brasileiros (18–60 anos)", "Ambos os sexos"],
    contraindications: [],
    ageMin: 18, ageMax: 60,
    equipment: ["Adipômetro", "Balança"],
    durationMinutes: 10,
    equationCode: "GUEDES_3_SIRI",
    resultUnit: "%",
    classificationRef: "BODY_FAT_ADULT_GUEDES",
    evidence: "HIGH",
    reference: "Guedes DP, Guedes JERP. Rev Paul Educ Fís. 1994;8(2):3-13.",
    isCustom: false,
    fields: [
      FIELD_WEIGHT, FIELD_AGE, FIELD_SEX,
      SF_TRICEPS, SF_SUPRAILIAC,
      { key: "abdominal_or_leg_mm", label: "Abdominal (Masc) / Panturrilha (Fem)", unit: "mm", fieldType: "NUMBER", required: true, min: 1, max: 80, hint: "Para homens: dobra abdominal. Para mulheres: dobra da panturrilha medial." },
    ],
  },

  {
    code: "FAULKNER",
    version: "1.0.0",
    name: "Faulkner 4 Dobras",
    category: "BODY_COMPOSITION",
    description: "Protocolo com tríceps, subescapular, abdominal e suprailíaco.",
    objective: "Estimativa de % gordura com 4 dobras.",
    targetPopulation: ["Adultos"],
    contraindications: [],
    ageMin: 18,
    equipment: ["Adipômetro", "Balança"],
    durationMinutes: 10,
    equationCode: "FAULKNER_4",
    resultUnit: "%",
    classificationRef: "BODY_FAT_ADULT_FAULKNER",
    evidence: "MODERATE",
    reference: "Faulkner JA. Physiology of swimming. Res Q. 1968;39(2):348-360.",
    isCustom: false,
    fields: [FIELD_WEIGHT, SF_TRICEPS, SF_SUBSCAPULAR, SF_ABDOMINAL, SF_SUPRAILIAC],
  },

  {
    code: "PETROSKI_4_MALE",
    version: "1.0.0",
    name: "Petroski 4 Dobras (Masculino)",
    category: "BODY_COMPOSITION",
    description: "Protocolo brasileiro de 4 dobras validado para homens de 18–66 anos.",
    objective: "Estimar % gordura em homens adultos com equação brasileira.",
    targetPopulation: ["Homens adultos brasileiros"],
    contraindications: [],
    ageMin: 18, ageMax: 66, sex: "M",
    equipment: ["Adipômetro", "Balança"],
    durationMinutes: 10,
    equationCode: "PETROSKI_4_MALE_SIRI",
    resultUnit: "%",
    classificationRef: "BODY_FAT_MALE_ADULT",
    evidence: "HIGH",
    reference: "Petroski EL. Rev Bras Atividade Física e Saúde. 1995;1(3):65-73.",
    isCustom: false,
    fields: [FIELD_WEIGHT, FIELD_AGE, SF_CHEST, SF_SUBSCAPULAR, SF_SUPRAILIAC, SF_CALF],
  },

  {
    code: "BIA_ENTRY",
    version: "1.0.0",
    name: "Bioimpedância (Entrada de Laudo)",
    category: "BODY_COMPOSITION",
    description: "Registro de resultado de BIA realizado externamente em aparelho específico.",
    objective: "Importar composição corporal obtida por bioimpedância para o histórico.",
    targetPopulation: ["Todos"],
    contraindications: ["Marca-passo cardíaco", "Implante metálico"],
    equipment: ["Laudo de BIA"],
    durationMinutes: 5,
    resultUnit: "%",
    classificationRef: "BODY_FAT_ADULT_GENERIC",
    evidence: "MODERATE",
    reference: "Lukaski HC et al. Am J Clin Nutr. 1985;41(4):810-817.",
    isCustom: false,
    fields: [
      FIELD_WEIGHT,
      { key: "body_fat_pct", label: "% Gordura", unit: "%", fieldType: "NUMBER", required: true, min: 1, max: 70 },
      { key: "fat_mass_kg", label: "Massa gorda", unit: "kg", fieldType: "NUMBER", required: false, min: 0, max: 200 },
      { key: "lean_mass_kg", label: "Massa magra", unit: "kg", fieldType: "NUMBER", required: false, min: 0, max: 200 },
      { key: "muscle_mass_kg", label: "Massa muscular", unit: "kg", fieldType: "NUMBER", required: false, min: 0, max: 150 },
      { key: "visceral_fat_level", label: "Gordura visceral (nível)", unit: "", fieldType: "NUMBER", required: false, min: 1, max: 30 },
      { key: "device_model", label: "Modelo do aparelho", unit: "", fieldType: "TEXT", required: false },
    ],
  },

  {
    code: "DEXA_ENTRY",
    version: "1.0.0",
    name: "DEXA (Entrada de Laudo)",
    category: "BODY_COMPOSITION",
    description: "Registro de resultado de densitometria por absorciometria de dupla energia (DEXA).",
    objective: "Importar composição corporal DEXA (padrão-ouro) para o histórico.",
    targetPopulation: ["Todos"],
    contraindications: [],
    equipment: ["Laudo de DEXA"],
    durationMinutes: 5,
    resultUnit: "%",
    classificationRef: "BODY_FAT_DEXA",
    evidence: "HIGH",
    reference: "Heymsfield SB et al. Ann N Y Acad Sci. 2000.",
    isCustom: false,
    fields: [
      FIELD_WEIGHT,
      { key: "body_fat_pct", label: "% Gordura total", unit: "%", fieldType: "NUMBER", required: true, min: 1, max: 70 },
      { key: "fat_mass_kg", label: "Massa gorda", unit: "kg", fieldType: "NUMBER", required: false, min: 0, max: 200 },
      { key: "lean_mass_kg", label: "Massa magra", unit: "kg", fieldType: "NUMBER", required: false, min: 0, max: 200 },
      { key: "bone_mineral_density", label: "DMO total (g/cm²)", unit: "g/cm²", fieldType: "NUMBER", required: false, min: 0.5, max: 2.5 },
      { key: "t_score", label: "T-score", unit: "", fieldType: "NUMBER", required: false, min: -4, max: 4 },
      { key: "z_score", label: "Z-score", unit: "", fieldType: "NUMBER", required: false, min: -4, max: 4 },
      { key: "lab_name", label: "Clínica/laboratório", unit: "", fieldType: "TEXT", required: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CARDIORRESPIRATÓRIO
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "COOPER_12MIN",
    version: "1.0.0",
    name: "Teste de Cooper (12 minutos)",
    category: "CARDIORESPIRATORY",
    description: "Estimativa de VO₂máx pela distância percorrida em 12 minutos.",
    objective: "Avaliar capacidade aeróbia máxima em campo com protocolo simples.",
    targetPopulation: ["Adultos saudáveis (18–70 anos)", "Atletas de endurance"],
    contraindications: ["Condição cardiovascular não avaliada", "Gestação", "Lesão aguda de membro inferior"],
    ageMin: 18, ageMax: 70,
    equipment: ["Pista de 400m com marcações ou GPS"],
    durationMinutes: 15,
    instructions: "Aquecimento de 5–10 min. Correr/caminhar o máximo de distância em 12 minutos exatos. Registrar distância ao sinal de encerramento.",
    equationCode: "COOPER_VO2MAX",
    resultUnit: "ml/kg/min",
    classificationRef: "VO2MAX_ADULT",
    evidence: "HIGH",
    reference: "Cooper KH. JAMA. 1968;203(3):201-204.",
    isCustom: false,
    fields: [
      { key: "distance_m", label: "Distância percorrida", unit: "m", fieldType: "NUMBER", required: true, min: 500, max: 5000 },
      { ...FIELD_WEIGHT, required: false },
    ],
  },

  {
    code: "ROCKPORT_MILE",
    version: "1.0.0",
    name: "Rockport — Caminhada de 1 Milha",
    category: "CARDIORESPIRATORY",
    description: "Estimativa de VO₂máx pela caminhada de 1 milha (1609 m) com FC ao final.",
    objective: "Avaliar capacidade aeróbia em população geral, idosos e pessoas sedentárias com menor risco.",
    targetPopulation: ["Adultos", "Idosos", "Sedentários"],
    contraindications: ["FC máx não estimável por medicamento (ex.: betabloqueador)"],
    ageMin: 18, ageMax: 90,
    equipment: ["Superfície plana de 1609 m", "Frequencímetro"],
    durationMinutes: 25,
    instructions: "Caminhar 1609 m o mais rápido possível sem correr. Medir FC imediatamente ao cruzar a linha de chegada.",
    equationCode: "ROCKPORT_VO2MAX",
    resultUnit: "ml/kg/min",
    classificationRef: "VO2MAX_ADULT",
    evidence: "HIGH",
    reference: "Kline GM et al. Med Sci Sports Exerc. 1987;19(3):253-259.",
    isCustom: false,
    fields: [
      { key: "time_seconds", label: "Tempo total (1 milha)", unit: "s", fieldType: "NUMBER", required: true, min: 300, max: 1800 },
      { key: "hr_final_bpm", label: "FC ao final", unit: "bpm", fieldType: "NUMBER", required: true, min: 60, max: 220 },
      FIELD_WEIGHT, FIELD_AGE, FIELD_SEX,
    ],
  },

  {
    code: "LEGER_BLEEP",
    version: "1.0.0",
    name: "Teste de Léger — Course Navette (Bleep Test)",
    category: "CARDIORESPIRATORY",
    description: "Teste de corrida em vai-e-vem de 20m com incremento progressivo de velocidade.",
    objective: "Estimar VO₂máx e VAM em atletas e escolares.",
    targetPopulation: ["Crianças (8+)", "Adolescentes", "Adultos", "Esportes coletivos"],
    contraindications: [],
    ageMin: 8, ageMax: 65,
    equipment: ["Pista de 20m", "Áudio calibrado do bleep test"],
    durationMinutes: 20,
    instructions: "Correr de lado a lado da pista de 20m. A velocidade aumenta 0.5 km/h a cada minuto. Encerrar quando o atleta não conseguir mais alcançar a linha antes do sinal.",
    equationCode: "LEGER_VO2MAX",
    resultUnit: "ml/kg/min",
    classificationRef: "VO2MAX_ADULT",
    evidence: "HIGH",
    reference: "Léger LA, Mercier D, Gadoury C, Lambert J. Eur J Appl Physiol. 1988;57:434-442.",
    isCustom: false,
    fields: [
      { key: "last_level", label: "Último nível completado", unit: "", fieldType: "NUMBER", required: true, min: 1, max: 21 },
      { key: "last_shuttle", label: "Último shuttle completo no nível", unit: "", fieldType: "NUMBER", required: true, min: 1, max: 16 },
      FIELD_AGE,
    ],
  },

  {
    code: "VDOT_RACE",
    version: "1.0.0",
    name: "VDOT por Tempo de Prova",
    category: "CARDIORESPIRATORY",
    description: "Cálculo de VDOT a partir de tempo de prova competitiva usando tabelas de Jack Daniels.",
    objective: "Estabelecer paces de treino por zona (Easy, Marathon, Threshold, Interval, Repetition).",
    targetPopulation: ["Corredores adultos"],
    contraindications: [],
    ageMin: 15,
    equipment: ["Resultado de prova oficial ou tempo controlado"],
    durationMinutes: 5,
    instructions: "Usar tempo oficial de prova, não estimado. Distâncias válidas: 1500m até maratona.",
    equationCode: "VDOT_DANIELS",
    resultUnit: "vdot",
    classificationRef: "VDOT_RUNNERS",
    evidence: "HIGH",
    reference: "Daniels J. Daniels' Running Formula. 3rd ed. Human Kinetics; 2014.",
    isCustom: false,
    fields: [
      {
        key: "race_distance_m",
        label: "Distância da prova",
        unit: "m",
        fieldType: "SELECT",
        required: true,
        options: [
          { value: "1500", label: "1500 m" },
          { value: "1609", label: "1 milha" },
          { value: "3000", label: "3000 m" },
          { value: "5000", label: "5 km" },
          { value: "10000", label: "10 km" },
          { value: "21097", label: "Meia maratona" },
          { value: "42195", label: "Maratona" },
        ],
      },
      { key: "race_time_seconds", label: "Tempo de prova", unit: "s", fieldType: "NUMBER", required: true, min: 180, max: 36000, hint: "Tempo em segundos totais (ex.: 30:00 = 1800s)" },
    ],
  },

  {
    code: "ERGO_DIRECT",
    version: "1.0.0",
    name: "Ergoespirometria (Resultado Direto)",
    category: "CARDIORESPIRATORY",
    description: "Registro de VO₂máx/VO₂pico medido diretamente por ergoespirometria.",
    objective: "Importar o valor mais preciso de capacidade aeróbia para o histórico.",
    targetPopulation: ["Atletas", "Cardiopatas acompanhados"],
    contraindications: [],
    equipment: ["Laudo de ergoespirometria"],
    durationMinutes: 5,
    resultUnit: "ml/kg/min",
    classificationRef: "VO2MAX_ADULT",
    evidence: "HIGH",
    reference: "ATS/ACCP Statement on Cardiopulmonary Exercise Testing. Am J Respir Crit Care Med. 2003.",
    isCustom: false,
    fields: [
      { key: "vo2max_ml_kg_min", label: "VO₂máx / VO₂pico", unit: "ml/kg/min", fieldType: "NUMBER", required: true, min: 10, max: 100 },
      { key: "measurement_type", label: "Tipo de medida", unit: "", fieldType: "SELECT", required: true, options: [
        { value: "VO2MAX", label: "VO₂máx (teste máximo)" },
        { value: "VO2PEAK", label: "VO₂pico" },
      ]},
      { key: "vam_kmh", label: "VAM (km/h)", unit: "km/h", fieldType: "NUMBER", required: false, min: 5, max: 30 },
      { key: "hr_max_bpm", label: "FC máxima atingida", unit: "bpm", fieldType: "NUMBER", required: false, min: 100, max: 250 },
      { key: "lab_name", label: "Laboratório / clínica", unit: "", fieldType: "TEXT", required: false },
    ],
  },

  {
    code: "SIX_MIN_WALK",
    version: "1.0.0",
    name: "Teste de Caminhada de 6 Minutos (TC6M)",
    category: "CARDIORESPIRATORY",
    description: "Avaliação de capacidade funcional aeróbia pela distância caminhada em 6 minutos.",
    objective: "Avaliar capacidade funcional em idosos, cardiopatas e populações especiais.",
    targetPopulation: ["Idosos", "Cardiopatas", "Pacientes pulmonares"],
    contraindications: ["Angina instável", "IAM recente (< 1 mês)"],
    ageMin: 18,
    equipment: ["Corredor de 30m com marcações", "Cronômetro", "Frequencímetro"],
    durationMinutes: 10,
    instructions: "Caminhar o máximo possível em 6 minutos em corredor de 30m. Não correr. Registrar distância total.",
    equationCode: "SIX_MIN_WALK_VO2",
    resultUnit: "m",
    classificationRef: "SIX_MIN_WALK_ADULT",
    evidence: "HIGH",
    reference: "ATS Committee on Proficiency Standards for Clinical Pulmonary Function Laboratories. Am J Respir Crit Care Med. 2002.",
    isCustom: false,
    fields: [
      { key: "distance_m", label: "Distância total", unit: "m", fieldType: "NUMBER", required: true, min: 50, max: 1000 },
      { key: "hr_final_bpm", label: "FC ao final", unit: "bpm", fieldType: "NUMBER", required: false, min: 40, max: 220 },
      { key: "borg_final", label: "Escala de Borg ao final", unit: "", fieldType: "NUMBER", required: false, min: 6, max: 20 },
      FIELD_WEIGHT, FIELD_AGE,
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FORÇA
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "ONE_RM_DIRECT",
    version: "1.0.0",
    name: "1RM Direto",
    category: "STRENGTH",
    description: "Registro de carga máxima levantada em uma única repetição completa.",
    objective: "Determinar força máxima em um exercício específico.",
    targetPopulation: ["Adultos treinados"],
    contraindications: ["Lesão articular aguda", "Hipertensão grave não controlada", "Cardiopatia não avaliada"],
    ageMin: 16,
    equipment: ["Equipamento do exercício"],
    durationMinutes: 20,
    instructions: "Aquecimento progressivo. Tentativas com intervalos de 3–5 min. Registrar maior carga com amplitude completa.",
    equationCode: "ONE_RM_DIRECT",
    resultUnit: "kg",
    classificationRef: "STRENGTH_RELATIVE",
    evidence: "HIGH",
    reference: "Baechle TR, Earle RW. Essentials of Strength Training. NSCA; 2008.",
    isCustom: false,
    fields: [
      FIELD_EXERCISE_ID,
      { key: "load_kg", label: "Carga (1RM)", unit: "kg", fieldType: "NUMBER", required: true, min: 1, max: 1000 },
      { ...FIELD_WEIGHT, required: false },
      { key: "equipment_type", label: "Equipamento", unit: "", fieldType: "TEXT", required: false },
      { key: "notes", label: "Observações da execução", unit: "", fieldType: "TEXT", required: false },
    ],
  },

  {
    code: "EPLEY_1RM",
    version: "1.0.0",
    name: "Estimativa 1RM — Epley",
    category: "STRENGTH",
    description: "Estimativa de 1RM pela equação de Epley: peso × (1 + reps/30).",
    objective: "Estimar 1RM sem realizar esforço máximo.",
    targetPopulation: ["Adultos"],
    contraindications: [],
    ageMin: 16,
    equipment: ["Equipamento do exercício"],
    durationMinutes: 10,
    instructions: "Realizar uma série com carga conhecida até a falha voluntária. Máximo recomendado: 10 repetições para maior precisão.",
    equationCode: "EPLEY_FORMULA",
    resultUnit: "kg",
    classificationRef: "STRENGTH_RELATIVE",
    evidence: "MODERATE",
    reference: "Epley B. Boyd Epley Workout. Lincoln, NE; 1985.",
    isCustom: false,
    fields: [
      FIELD_EXERCISE_ID,
      { key: "test_load_kg", label: "Carga de teste", unit: "kg", fieldType: "NUMBER", required: true, min: 1, max: 500 },
      { key: "reps_completed", label: "Repetições completadas", unit: "reps", fieldType: "NUMBER", required: true, min: 1, max: 30 },
      { ...FIELD_WEIGHT, required: false },
    ],
  },

  {
    code: "BRZYCKI_1RM",
    version: "1.0.0",
    name: "Estimativa 1RM — Brzycki",
    category: "STRENGTH",
    description: "Estimativa de 1RM pela equação de Brzycki: peso / (1.0278 − 0.0278 × reps).",
    objective: "Estimar 1RM sem esforço máximo. Mais conservadora que Epley em altas repetições.",
    targetPopulation: ["Adultos"],
    contraindications: [],
    ageMin: 16,
    equipment: ["Equipamento do exercício"],
    durationMinutes: 10,
    instructions: "Realizar série até falha. Recomendado ≤ 10 reps para maior acurácia.",
    equationCode: "BRZYCKI_FORMULA",
    resultUnit: "kg",
    classificationRef: "STRENGTH_RELATIVE",
    evidence: "MODERATE",
    reference: "Brzycki M. Strength Cond J. 1993;14(6):20-21.",
    isCustom: false,
    fields: [
      FIELD_EXERCISE_ID,
      { key: "test_load_kg", label: "Carga de teste", unit: "kg", fieldType: "NUMBER", required: true, min: 1, max: 500 },
      { key: "reps_completed", label: "Repetições completadas", unit: "reps", fieldType: "NUMBER", required: true, min: 1, max: 10, hint: "Acurácia reduzida acima de 10 repetições" },
      { ...FIELD_WEIGHT, required: false },
    ],
  },

  {
    code: "MAYHEW_1RM",
    version: "1.0.0",
    name: "Estimativa 1RM — Mayhew",
    category: "STRENGTH",
    description: "Estimativa de 1RM pela equação de Mayhew (1992), validada para supino.",
    objective: "Estimar 1RM em movimentos de membros superiores.",
    targetPopulation: ["Adultos treinados"],
    contraindications: [],
    ageMin: 16,
    equipment: ["Barra e anilhas (supino) ou equivalente"],
    durationMinutes: 10,
    instructions: "Realizar série submáxima até a falha. Equação: (100 × peso) / (52.2 + 41.9 × e^(−0.055 × reps)).",
    equationCode: "MAYHEW_FORMULA",
    resultUnit: "kg",
    classificationRef: "STRENGTH_RELATIVE",
    evidence: "MODERATE",
    reference: "Mayhew JL et al. J Sports Med Phys Fitness. 1992;32(4):395-401.",
    isCustom: false,
    fields: [
      FIELD_EXERCISE_ID,
      { key: "test_load_kg", label: "Carga de teste", unit: "kg", fieldType: "NUMBER", required: true, min: 1, max: 500 },
      { key: "reps_completed", label: "Repetições completadas", unit: "reps", fieldType: "NUMBER", required: true, min: 1, max: 20 },
      { ...FIELD_WEIGHT, required: false },
    ],
  },

  {
    code: "HANDGRIP",
    version: "1.0.0",
    name: "Dinamometria de Preensão Manual",
    category: "STRENGTH",
    description: "Medição da força isométrica de preensão manual com dinamômetro.",
    objective: "Avaliar força de preensão bilateral e índice de assimetria.",
    targetPopulation: ["Adultos", "Idosos", "Atletas"],
    contraindications: ["Lesão aguda de mão ou punho"],
    ageMin: 6,
    equipment: ["Dinamômetro de preensão manual (Jamar ou similar)"],
    durationMinutes: 10,
    instructions: "Três tentativas em cada mão alternadas, intervalo de 30s entre tentativas. Posição: sentado, ombro a 0°, cotovelo a 90°. Registrar melhor tentativa de cada lado.",
    equationCode: "HANDGRIP_ASYMMETRY",
    resultUnit: "kgf",
    classificationRef: "HANDGRIP_ADULT",
    evidence: "HIGH",
    reference: "Mathiowetz V et al. Arch Phys Med Rehabil. 1985;66(2):69-74.",
    isCustom: false,
    fields: [
      { key: "right_1_kgf", label: "Direita — 1ª tentativa", unit: "kgf", fieldType: "NUMBER", required: true, min: 1, max: 120, side: "right" },
      { key: "left_1_kgf", label: "Esquerda — 1ª tentativa", unit: "kgf", fieldType: "NUMBER", required: true, min: 1, max: 120, side: "left" },
      { key: "right_2_kgf", label: "Direita — 2ª tentativa", unit: "kgf", fieldType: "NUMBER", required: false, min: 1, max: 120, side: "right" },
      { key: "left_2_kgf", label: "Esquerda — 2ª tentativa", unit: "kgf", fieldType: "NUMBER", required: false, min: 1, max: 120, side: "left" },
      { key: "right_3_kgf", label: "Direita — 3ª tentativa", unit: "kgf", fieldType: "NUMBER", required: false, min: 1, max: 120, side: "right" },
      { key: "left_3_kgf", label: "Esquerda — 3ª tentativa", unit: "kgf", fieldType: "NUMBER", required: false, min: 1, max: 120, side: "left" },
      { ...FIELD_WEIGHT, required: false },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POTÊNCIA
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "CMJ",
    version: "1.0.0",
    name: "Countermovement Jump (CMJ)",
    category: "POWER",
    description: "Salto vertical com contramovimento para avaliação de potência de membros inferiores.",
    objective: "Avaliar potência explosiva, rastrear fadiga neuromuscular e assimetria bilateral.",
    targetPopulation: ["Adultos", "Atletas"],
    contraindications: ["Lesão aguda de membro inferior"],
    ageMin: 14,
    equipment: ["Plataforma de força, tapete de contato ou régua de salto vertical"],
    durationMinutes: 15,
    instructions: "3–5 tentativas com intervalo de 30–60s. Mãos nos quadris. Registrar cada tentativa.",
    equationCode: "CMJ_BEST_HEIGHT",
    resultUnit: "cm",
    classificationRef: "CMJ_ADULTS",
    evidence: "HIGH",
    reference: "Bosco C et al. Eur J Appl Physiol. 1983;51(1):5-19.",
    isCustom: false,
    fields: [
      { key: "jump1_cm", label: "Tentativa 1", unit: "cm", fieldType: "NUMBER", required: true, min: 5, max: 120 },
      { key: "jump2_cm", label: "Tentativa 2", unit: "cm", fieldType: "NUMBER", required: false, min: 5, max: 120 },
      { key: "jump3_cm", label: "Tentativa 3", unit: "cm", fieldType: "NUMBER", required: false, min: 5, max: 120 },
      { key: "jump4_cm", label: "Tentativa 4", unit: "cm", fieldType: "NUMBER", required: false, min: 5, max: 120 },
      { key: "jump5_cm", label: "Tentativa 5", unit: "cm", fieldType: "NUMBER", required: false, min: 5, max: 120 },
      { ...FIELD_WEIGHT, required: false },
      {
        key: "device_type", label: "Dispositivo", unit: "", fieldType: "SELECT", required: false,
        options: [
          { value: "FORCE_PLATE", label: "Plataforma de força" },
          { value: "CONTACT_MAT", label: "Tapete de contato" },
          { value: "OPTICAL", label: "Sensor óptico" },
          { value: "RULER", label: "Régua / fita" },
        ],
      },
    ],
  },

  {
    code: "SJ",
    version: "1.0.0",
    name: "Squat Jump (SJ)",
    category: "POWER",
    description: "Salto vertical partindo de posição estática de agachamento (sem contramovimento).",
    objective: "Avaliar potência concêntrica pura. Comparado ao CMJ, revela contribuição do ciclo estiramento-encurtamento.",
    targetPopulation: ["Adultos", "Atletas"],
    contraindications: ["Lesão aguda de membro inferior"],
    ageMin: 14,
    equipment: ["Plataforma de força ou tapete de contato"],
    durationMinutes: 10,
    instructions: "Partir de 90° de flexão de joelho, mãos nos quadris, sem qualquer contramovimento. 3 tentativas com 30–60s de intervalo.",
    equationCode: "SJ_BEST_HEIGHT",
    resultUnit: "cm",
    classificationRef: "CMJ_ADULTS",
    evidence: "HIGH",
    reference: "Bosco C et al. Eur J Appl Physiol. 1983;51(1):5-19.",
    isCustom: false,
    fields: [
      { key: "jump1_cm", label: "Tentativa 1", unit: "cm", fieldType: "NUMBER", required: true, min: 5, max: 100 },
      { key: "jump2_cm", label: "Tentativa 2", unit: "cm", fieldType: "NUMBER", required: false, min: 5, max: 100 },
      { key: "jump3_cm", label: "Tentativa 3", unit: "cm", fieldType: "NUMBER", required: false, min: 5, max: 100 },
      { ...FIELD_WEIGHT, required: false },
    ],
  },

  {
    code: "FTP_20MIN",
    version: "1.0.0",
    name: "FTP — Teste de 20 Minutos",
    category: "POWER",
    description: "FTP estimado como 95% da potência média sustentada em 20 minutos de esforço máximo.",
    objective: "Estabelecer FTP (Functional Threshold Power) para prescrição de zonas de ciclismo.",
    targetPopulation: ["Ciclistas adultos"],
    contraindications: ["Condição cardiovascular não avaliada"],
    ageMin: 16,
    equipment: ["Medidor de potência ou cicloergômetro calibrado"],
    durationMinutes: 40,
    instructions: "Aquecimento de 10 min incluindo 2 × 1 min perto do máximo. Esforço máximo sustentado por 20 min. FTP = média × 0.95.",
    equationCode: "FTP_20MIN_FACTOR",
    resultUnit: "W",
    classificationRef: "FTP_CYCLISTS",
    evidence: "HIGH",
    reference: "Allen H, Coggan A. Training and Racing with a Power Meter. VeloPress; 2010.",
    isCustom: false,
    fields: [
      { key: "avg_power_20min_w", label: "Potência média (20 min)", unit: "W", fieldType: "NUMBER", required: true, min: 50, max: 2000 },
      { ...FIELD_WEIGHT, required: false },
      { key: "hr_avg_bpm", label: "FC média no teste", unit: "bpm", fieldType: "NUMBER", required: false, min: 80, max: 220 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // VELOCIDADE E AGILIDADE
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "SPRINT_10M",
    version: "1.0.0",
    name: "Sprint 10 metros",
    category: "SPEED_AGILITY",
    description: "Medição do tempo de aceleração em 10 metros a partir de saída estática.",
    objective: "Avaliar capacidade de aceleração inicial.",
    targetPopulation: ["Adultos ativos", "Atletas"],
    contraindications: ["Lesão muscular ou articular de membro inferior"],
    ageMin: 14,
    equipment: ["Fotocélulas ou cronômetro manual", "Superfície plana e segura"],
    durationMinutes: 15,
    instructions: "2–3 tentativas com 3 min de intervalo. Saída estática. Registrar melhor tentativa.",
    equationCode: "SPRINT_BEST_TIME",
    resultUnit: "s",
    classificationRef: "SPRINT_10M_ADULTS",
    evidence: "HIGH",
    reference: "Haugen TA et al. Int J Sports Physiol Perform. 2012;7(2):135-143.",
    isCustom: false,
    fields: [
      { key: "time1_s", label: "Tentativa 1", unit: "s", fieldType: "NUMBER", required: true, min: 1.0, max: 5.0 },
      { key: "time2_s", label: "Tentativa 2", unit: "s", fieldType: "NUMBER", required: false, min: 1.0, max: 5.0 },
      { key: "time3_s", label: "Tentativa 3", unit: "s", fieldType: "NUMBER", required: false, min: 1.0, max: 5.0 },
      { key: "surface", label: "Superfície", unit: "", fieldType: "SELECT", required: false, options: [
        { value: "TARTAN", label: "Tartã" },
        { value: "GRASS", label: "Grama" },
        { value: "SYNTHETIC", label: "Sintético" },
        { value: "CONCRETE", label: "Concreto/piso" },
      ]},
      { key: "timing_device", label: "Cronometragem", unit: "", fieldType: "SELECT", required: false, options: [
        { value: "PHOTOCELL", label: "Fotocélula" },
        { value: "MANUAL", label: "Cronômetro manual" },
        { value: "APP", label: "Aplicativo/câmera" },
      ]},
    ],
  },

  {
    code: "SPRINT_30M",
    version: "1.0.0",
    name: "Sprint 30 metros",
    category: "SPEED_AGILITY",
    description: "Medição do tempo de sprint em 30 metros.",
    objective: "Avaliar velocidade máxima de sprint.",
    targetPopulation: ["Adultos ativos", "Atletas"],
    contraindications: ["Lesão muscular ou articular de membro inferior"],
    ageMin: 14,
    equipment: ["Fotocélulas ou cronômetro manual"],
    durationMinutes: 15,
    instructions: "2–3 tentativas com 5 min de intervalo. Saída estática.",
    equationCode: "SPRINT_BEST_TIME",
    resultUnit: "s",
    classificationRef: "SPRINT_30M_ADULTS",
    evidence: "HIGH",
    reference: "Haugen TA et al. Int J Sports Physiol Perform. 2012;7(2):135-143.",
    isCustom: false,
    fields: [
      { key: "time1_s", label: "Tentativa 1", unit: "s", fieldType: "NUMBER", required: true, min: 3.0, max: 10.0 },
      { key: "time2_s", label: "Tentativa 2", unit: "s", fieldType: "NUMBER", required: false, min: 3.0, max: 10.0 },
      { key: "time3_s", label: "Tentativa 3", unit: "s", fieldType: "NUMBER", required: false, min: 3.0, max: 10.0 },
      { key: "surface", label: "Superfície", unit: "", fieldType: "SELECT", required: false, options: [
        { value: "TARTAN", label: "Tartã" }, { value: "GRASS", label: "Grama" }, { value: "SYNTHETIC", label: "Sintético" },
      ]},
    ],
  },

  {
    code: "ILLINOIS",
    version: "1.0.0",
    name: "Teste de Illinois",
    category: "SPEED_AGILITY",
    description: "Circuito de agilidade Illinois (10 × 5m) com cones e mudança de direção.",
    objective: "Avaliar agilidade, velocidade de mudança de direção e coordenação.",
    targetPopulation: ["Adultos ativos", "Atletas de esportes coletivos"],
    contraindications: ["Lesão articular de membro inferior"],
    ageMin: 14,
    equipment: ["8 cones", "Cronômetro ou fotocélula", "Área de 10 × 5 metros"],
    durationMinutes: 15,
    instructions: "2 tentativas com intervalo de 3 min. Saída em decúbito ventral ou em pé (registrar qual). Completar circuito Illinois padrão.",
    equationCode: "AGILITY_BEST_TIME",
    resultUnit: "s",
    classificationRef: "ILLINOIS_ADULTS",
    evidence: "HIGH",
    reference: "Getchell LH. Testing and training for sport. J Phys Educ. 1979.",
    isCustom: false,
    fields: [
      { key: "time1_s", label: "Tentativa 1", unit: "s", fieldType: "NUMBER", required: true, min: 10, max: 30 },
      { key: "time2_s", label: "Tentativa 2", unit: "s", fieldType: "NUMBER", required: false, min: 10, max: 30 },
      { key: "start_position", label: "Posição de saída", unit: "", fieldType: "SELECT", required: false, options: [
        { value: "PRONE", label: "Decúbito ventral" }, { value: "STANDING", label: "Em pé" },
      ]},
    ],
  },

  {
    code: "T_TEST",
    version: "1.0.0",
    name: "Teste T (Agilidade)",
    category: "SPEED_AGILITY",
    description: "Teste de agilidade em forma de T: frente, lateral e trás.",
    objective: "Avaliar agilidade multidirecional.",
    targetPopulation: ["Adultos ativos", "Atletas"],
    contraindications: [],
    ageMin: 14,
    equipment: ["4 cones", "Cronômetro ou fotocélula"],
    durationMinutes: 15,
    instructions: "Sprint frontal de 9.14m, lateral de 4.57m para cada lado, de volta ao centro e sprint de trás. 2–3 tentativas com 3 min de intervalo.",
    equationCode: "AGILITY_BEST_TIME",
    resultUnit: "s",
    classificationRef: "T_TEST_ADULTS",
    evidence: "HIGH",
    reference: "Pauole K et al. J Strength Cond Res. 2000;14(2):219-225.",
    isCustom: false,
    fields: [
      { key: "time1_s", label: "Tentativa 1", unit: "s", fieldType: "NUMBER", required: true, min: 8, max: 25 },
      { key: "time2_s", label: "Tentativa 2", unit: "s", fieldType: "NUMBER", required: false, min: 8, max: 25 },
      { key: "time3_s", label: "Tentativa 3", unit: "s", fieldType: "NUMBER", required: false, min: 8, max: 25 },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // FLEXIBILIDADE E MOBILIDADE
  // ══════════════════════════════════════════════════════════════════════════

  {
    code: "WELLS_BENCH",
    version: "1.0.0",
    name: "Banco de Wells (Sentar-e-Alcançar)",
    category: "FLEXIBILITY_MOBILITY",
    description: "Teste de flexibilidade de coluna lombar e isquiotibiais com banco de Wells padronizado.",
    objective: "Avaliar flexibilidade da cadeia posterior.",
    targetPopulation: ["Adultos", "Idosos"],
    contraindications: ["Hérnia de disco aguda", "Ciatalgia aguda"],
    ageMin: 6,
    equipment: ["Banco de Wells ou fita métrica no chão"],
    durationMinutes: 10,
    instructions: "Descalço. Joelhos completamente estendidos. Três tentativas lentas sem balanço. Registrar melhor alcance.",
    equationCode: "WELLS_BEST",
    resultUnit: "cm",
    classificationRef: "WELLS_ADULT",
    evidence: "MODERATE",
    reference: "Wells KF, Dillon EK. Res Q. 1952;23(1):115-118.",
    isCustom: false,
    fields: [
      { key: "reach1_cm", label: "1ª tentativa", unit: "cm", fieldType: "NUMBER", required: true, min: -30, max: 50 },
      { key: "reach2_cm", label: "2ª tentativa", unit: "cm", fieldType: "NUMBER", required: false, min: -30, max: 50 },
      { key: "reach3_cm", label: "3ª tentativa", unit: "cm", fieldType: "NUMBER", required: false, min: -30, max: 50 },
    ],
  },

  {
    code: "ANKLE_DORSIFLEXION",
    version: "1.0.0",
    name: "Dorsiflexão de Tornozelo (Lunge Test)",
    category: "FLEXIBILITY_MOBILITY",
    description: "Avaliação da amplitude de dorsiflexão de tornozelo com o joelho fletido (lunge test) bilateral.",
    objective: "Identificar restrição de mobilidade de tornozelo e assimetria bilateral.",
    targetPopulation: ["Adultos", "Atletas"],
    contraindications: ["Lesão aguda de tornozelo"],
    ageMin: 14,
    equipment: ["Fita métrica ou goniômetro", "Parede"],
    durationMinutes: 10,
    instructions: "Hálux a X cm da parede. O atleta flete o joelho em direção à parede sem levantar o calcanhar. Registrar maior distância possível bilateralmente.",
    equationCode: "DORSIFLEXION_ASYMMETRY",
    resultUnit: "cm",
    classificationRef: "DORSIFLEXION_ADULT",
    evidence: "HIGH",
    reference: "Bennell K et al. Br J Sports Med. 1998;32(2):138-143.",
    isCustom: false,
    fields: [
      { key: "right_cm", label: "Lado direito", unit: "cm", fieldType: "NUMBER", required: true, min: 0, max: 30, side: "right" },
      { key: "left_cm", label: "Lado esquerdo", unit: "cm", fieldType: "NUMBER", required: true, min: 0, max: 30, side: "left" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de acesso ao catálogo
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o protocolo pela última versão disponível para um code. */
export function findProtocol(code: string): ProtocolDefinition | undefined {
  return PROTOCOL_REGISTRY.filter((p) => p.code === code).sort((a, b) =>
    b.version.localeCompare(a.version, undefined, { numeric: true }),
  )[0];
}

/** Retorna o protocolo por code + versão exata. */
export function findProtocolVersion(code: string, version: string): ProtocolDefinition | undefined {
  return PROTOCOL_REGISTRY.find((p) => p.code === code && p.version === version);
}

/** Lista protocolos por categoria, ordenados por nome. */
export function listProtocolsByCategory(category: AssessmentCategory): ProtocolDefinition[] {
  return PROTOCOL_REGISTRY.filter((p) => p.category === category).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
}

/** Todas as categorias que possuem ao menos um protocolo no catálogo. */
export function availableCategories(): AssessmentCategory[] {
  return [...new Set(PROTOCOL_REGISTRY.map((p) => p.category))];
}

/** Pesquisa livre por nome ou descrição (case-insensitive, acentuação tolerada). */
export function searchProtocols(query: string): ProtocolDefinition[] {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return PROTOCOL_REGISTRY.filter((p) => {
    const text = `${p.name} ${p.description} ${p.objective}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return text.includes(q);
  });
}
