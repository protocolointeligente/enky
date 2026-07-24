// Referências normativas para classificação de resultados de protocolos de avaliação.
// Cada NormativeTable contém faixas de classificação por sexo e/ou faixa etária.
// O campo `classificationRef` em protocol-registry.ts é a chave desta tabela.
//
// Política editorial:
//   - Toda faixa indica a referência científica original.
//   - O sistema nunca apresenta a classificação como diagnóstico clínico.
//   - O treinador pode sempre revisar/sobrescrever a classificação automática.

export const CLASSIFICATION_LABELS = [
  "VERY_LOW",
  "LOW",
  "BELOW_AVERAGE",
  "AVERAGE",
  "ABOVE_AVERAGE",
  "GOOD",
  "EXCELLENT",
] as const;

export type ClassificationLabel = (typeof CLASSIFICATION_LABELS)[number];

export const CLASSIFICATION_LABEL_PT: Record<ClassificationLabel, string> = {
  VERY_LOW: "Muito baixo",
  LOW: "Baixo",
  BELOW_AVERAGE: "Abaixo da média",
  AVERAGE: "Médio",
  ABOVE_AVERAGE: "Acima da média",
  GOOD: "Bom",
  EXCELLENT: "Excelente",
};

export interface NormativeRange {
  label: ClassificationLabel;
  /** Valor mínimo da faixa (inclusivo). undefined = sem limite inferior. */
  min?: number;
  /** Valor máximo da faixa (exclusivo). undefined = sem limite superior. */
  max?: number;
}

export interface NormativeTable {
  key: string;
  description: string;
  reference: string;
  /** "LOWER_IS_BETTER" para tempos de sprint, % gordura excessivo etc. */
  direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  /** Se verdadeiro, a faixa só é válida para o sexo correspondente. */
  sexSpecific?: boolean;
  /**
   * Ranges flat (sem faixa etária). Usar quando não há estratificação por idade.
   * Ou informar `ageGroups` para tabelas com estratificação etária.
   */
  ranges?: NormativeRange[];
  ageGroups?: {
    ageMin: number;
    ageMax: number;
    sex?: "M" | "F";
    ranges: NormativeRange[];
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSIÇÃO CORPORAL — % Gordura
// ─────────────────────────────────────────────────────────────────────────────

const BODY_FAT_MALE_ADULT: NormativeTable = {
  key: "BODY_FAT_MALE_ADULT",
  description: "% Gordura corporal — Homens adultos (ACSM 2022)",
  reference: "ACSM. Guidelines for Exercise Testing and Prescription. 11th ed. 2022.",
  direction: "LOWER_IS_BETTER",
  sexSpecific: true,
  ageGroups: [
    {
      ageMin: 18, ageMax: 25,
      sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 8 },
        { label: "LOW", min: 8, max: 11 },       // "Essential + low"
        { label: "BELOW_AVERAGE", min: 11, max: 14 },
        { label: "AVERAGE", min: 14, max: 18 },
        { label: "ABOVE_AVERAGE", min: 18, max: 21 },
        { label: "LOW", min: 21, max: 25 },
        { label: "VERY_LOW", min: 25, max: undefined },
      ],
    },
    {
      ageMin: 26, ageMax: 35,
      sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 10 },
        { label: "LOW", min: 10, max: 14 },
        { label: "BELOW_AVERAGE", min: 14, max: 17 },
        { label: "AVERAGE", min: 17, max: 21 },
        { label: "ABOVE_AVERAGE", min: 21, max: 24 },
        { label: "LOW", min: 24, max: 28 },
        { label: "VERY_LOW", min: 28, max: undefined },
      ],
    },
    {
      ageMin: 36, ageMax: 45,
      sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 12 },
        { label: "LOW", min: 12, max: 16 },
        { label: "BELOW_AVERAGE", min: 16, max: 19 },
        { label: "AVERAGE", min: 19, max: 23 },
        { label: "ABOVE_AVERAGE", min: 23, max: 26 },
        { label: "LOW", min: 26, max: 30 },
        { label: "VERY_LOW", min: 30, max: undefined },
      ],
    },
    {
      ageMin: 46, ageMax: 55,
      sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 14 },
        { label: "LOW", min: 14, max: 18 },
        { label: "BELOW_AVERAGE", min: 18, max: 21 },
        { label: "AVERAGE", min: 21, max: 25 },
        { label: "ABOVE_AVERAGE", min: 25, max: 28 },
        { label: "LOW", min: 28, max: 32 },
        { label: "VERY_LOW", min: 32, max: undefined },
      ],
    },
    {
      ageMin: 56, ageMax: 99,
      sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 15 },
        { label: "LOW", min: 15, max: 19 },
        { label: "BELOW_AVERAGE", min: 19, max: 22 },
        { label: "AVERAGE", min: 22, max: 26 },
        { label: "ABOVE_AVERAGE", min: 26, max: 29 },
        { label: "LOW", min: 29, max: 33 },
        { label: "VERY_LOW", min: 33, max: undefined },
      ],
    },
  ],
};

const BODY_FAT_FEMALE_ADULT: NormativeTable = {
  key: "BODY_FAT_FEMALE_ADULT",
  description: "% Gordura corporal — Mulheres adultas (ACSM 2022)",
  reference: "ACSM. Guidelines for Exercise Testing and Prescription. 11th ed. 2022.",
  direction: "LOWER_IS_BETTER",
  sexSpecific: true,
  ageGroups: [
    {
      ageMin: 18, ageMax: 25, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 14 },
        { label: "LOW", min: 14, max: 17 },
        { label: "BELOW_AVERAGE", min: 17, max: 20 },
        { label: "AVERAGE", min: 20, max: 24 },
        { label: "ABOVE_AVERAGE", min: 24, max: 27 },
        { label: "LOW", min: 27, max: 32 },
        { label: "VERY_LOW", min: 32, max: undefined },
      ],
    },
    {
      ageMin: 26, ageMax: 35, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 16 },
        { label: "LOW", min: 16, max: 19 },
        { label: "BELOW_AVERAGE", min: 19, max: 22 },
        { label: "AVERAGE", min: 22, max: 26 },
        { label: "ABOVE_AVERAGE", min: 26, max: 29 },
        { label: "LOW", min: 29, max: 34 },
        { label: "VERY_LOW", min: 34, max: undefined },
      ],
    },
    {
      ageMin: 36, ageMax: 45, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 18 },
        { label: "LOW", min: 18, max: 21 },
        { label: "BELOW_AVERAGE", min: 21, max: 24 },
        { label: "AVERAGE", min: 24, max: 28 },
        { label: "ABOVE_AVERAGE", min: 28, max: 31 },
        { label: "LOW", min: 31, max: 36 },
        { label: "VERY_LOW", min: 36, max: undefined },
      ],
    },
    {
      ageMin: 46, ageMax: 99, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 20 },
        { label: "LOW", min: 20, max: 23 },
        { label: "BELOW_AVERAGE", min: 23, max: 26 },
        { label: "AVERAGE", min: 26, max: 30 },
        { label: "ABOVE_AVERAGE", min: 30, max: 33 },
        { label: "LOW", min: 33, max: 38 },
        { label: "VERY_LOW", min: 38, max: undefined },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// VO₂MÁX
// ─────────────────────────────────────────────────────────────────────────────

const VO2MAX_ADULT: NormativeTable = {
  key: "VO2MAX_ADULT",
  description: "VO₂máx — Adultos por sexo e faixa etária (ACSM 2022)",
  reference: "ACSM. Guidelines for Exercise Testing and Prescription. 11th ed. 2022.",
  direction: "HIGHER_IS_BETTER",
  ageGroups: [
    {
      ageMin: 20, ageMax: 29, sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 31 },
        { label: "LOW", min: 31, max: 37 },
        { label: "AVERAGE", min: 37, max: 44 },
        { label: "GOOD", min: 44, max: 51 },
        { label: "EXCELLENT", min: 51, max: undefined },
      ],
    },
    {
      ageMin: 30, ageMax: 39, sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 28 },
        { label: "LOW", min: 28, max: 34 },
        { label: "AVERAGE", min: 34, max: 40 },
        { label: "GOOD", min: 40, max: 47 },
        { label: "EXCELLENT", min: 47, max: undefined },
      ],
    },
    {
      ageMin: 40, ageMax: 49, sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 25 },
        { label: "LOW", min: 25, max: 30 },
        { label: "AVERAGE", min: 30, max: 36 },
        { label: "GOOD", min: 36, max: 43 },
        { label: "EXCELLENT", min: 43, max: undefined },
      ],
    },
    {
      ageMin: 50, ageMax: 59, sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 21 },
        { label: "LOW", min: 21, max: 26 },
        { label: "AVERAGE", min: 26, max: 32 },
        { label: "GOOD", min: 32, max: 39 },
        { label: "EXCELLENT", min: 39, max: undefined },
      ],
    },
    {
      ageMin: 60, ageMax: 99, sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 18 },
        { label: "LOW", min: 18, max: 22 },
        { label: "AVERAGE", min: 22, max: 28 },
        { label: "GOOD", min: 28, max: 35 },
        { label: "EXCELLENT", min: 35, max: undefined },
      ],
    },
    {
      ageMin: 20, ageMax: 29, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 24 },
        { label: "LOW", min: 24, max: 29 },
        { label: "AVERAGE", min: 29, max: 36 },
        { label: "GOOD", min: 36, max: 43 },
        { label: "EXCELLENT", min: 43, max: undefined },
      ],
    },
    {
      ageMin: 30, ageMax: 39, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 20 },
        { label: "LOW", min: 20, max: 25 },
        { label: "AVERAGE", min: 25, max: 31 },
        { label: "GOOD", min: 31, max: 37 },
        { label: "EXCELLENT", min: 37, max: undefined },
      ],
    },
    {
      ageMin: 40, ageMax: 49, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 17 },
        { label: "LOW", min: 17, max: 21 },
        { label: "AVERAGE", min: 21, max: 27 },
        { label: "GOOD", min: 27, max: 33 },
        { label: "EXCELLENT", min: 33, max: undefined },
      ],
    },
    {
      ageMin: 50, ageMax: 59, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 15 },
        { label: "LOW", min: 15, max: 18 },
        { label: "AVERAGE", min: 18, max: 23 },
        { label: "GOOD", min: 23, max: 29 },
        { label: "EXCELLENT", min: 29, max: undefined },
      ],
    },
    {
      ageMin: 60, ageMax: 99, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 13 },
        { label: "LOW", min: 13, max: 16 },
        { label: "AVERAGE", min: 16, max: 21 },
        { label: "GOOD", min: 21, max: 27 },
        { label: "EXCELLENT", min: 27, max: undefined },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// FTP
// ─────────────────────────────────────────────────────────────────────────────

const FTP_CYCLISTS: NormativeTable = {
  key: "FTP_CYCLISTS",
  description: "FTP W/kg — Ciclistas por nível (Allen & Coggan 2010)",
  reference: "Allen H, Coggan A. Training and Racing with a Power Meter. VeloPress; 2010.",
  direction: "HIGHER_IS_BETTER",
  ranges: [
    { label: "VERY_LOW", min: undefined, max: 2.0 },
    { label: "LOW", min: 2.0, max: 2.5 },
    { label: "AVERAGE", min: 2.5, max: 3.2 },
    { label: "ABOVE_AVERAGE", min: 3.2, max: 4.0 },
    { label: "GOOD", min: 4.0, max: 4.8 },
    { label: "EXCELLENT", min: 4.8, max: undefined },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CMJ
// ─────────────────────────────────────────────────────────────────────────────

const CMJ_ADULTS: NormativeTable = {
  key: "CMJ_ADULTS",
  description: "CMJ — Altura de salto por sexo (Bosco 1983 / dados normativos)",
  reference: "Bosco C et al. Eur J Appl Physiol. 1983. Markovic et al. Br J Sports Med. 2004.",
  direction: "HIGHER_IS_BETTER",
  ageGroups: [
    {
      ageMin: 14, ageMax: 99, sex: "M",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 25 },
        { label: "LOW", min: 25, max: 33 },
        { label: "AVERAGE", min: 33, max: 40 },
        { label: "ABOVE_AVERAGE", min: 40, max: 47 },
        { label: "GOOD", min: 47, max: 54 },
        { label: "EXCELLENT", min: 54, max: undefined },
      ],
    },
    {
      ageMin: 14, ageMax: 99, sex: "F",
      ranges: [
        { label: "VERY_LOW", min: undefined, max: 18 },
        { label: "LOW", min: 18, max: 24 },
        { label: "AVERAGE", min: 24, max: 30 },
        { label: "ABOVE_AVERAGE", min: 30, max: 37 },
        { label: "GOOD", min: 37, max: 44 },
        { label: "EXCELLENT", min: 44, max: undefined },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// PREENSÃO MANUAL
// ─────────────────────────────────────────────────────────────────────────────

const HANDGRIP_ADULT: NormativeTable = {
  key: "HANDGRIP_ADULT",
  description: "Preensão manual — Adultos por sexo e idade (Mathiowetz 1985)",
  reference: "Mathiowetz V et al. Arch Phys Med Rehabil. 1985;66(2):69-74.",
  direction: "HIGHER_IS_BETTER",
  ageGroups: [
    { ageMin: 20, ageMax: 24, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 43 }, { label: "LOW", min: 43, max: 52 },
      { label: "AVERAGE", min: 52, max: 58 }, { label: "GOOD", min: 58, max: 65 }, { label: "EXCELLENT", min: 65, max: undefined },
    ]},
    { ageMin: 25, ageMax: 39, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 46 }, { label: "LOW", min: 46, max: 54 },
      { label: "AVERAGE", min: 54, max: 60 }, { label: "GOOD", min: 60, max: 68 }, { label: "EXCELLENT", min: 68, max: undefined },
    ]},
    { ageMin: 40, ageMax: 54, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 41 }, { label: "LOW", min: 41, max: 50 },
      { label: "AVERAGE", min: 50, max: 56 }, { label: "GOOD", min: 56, max: 63 }, { label: "EXCELLENT", min: 63, max: undefined },
    ]},
    { ageMin: 55, ageMax: 99, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 33 }, { label: "LOW", min: 33, max: 43 },
      { label: "AVERAGE", min: 43, max: 50 }, { label: "GOOD", min: 50, max: 57 }, { label: "EXCELLENT", min: 57, max: undefined },
    ]},
    { ageMin: 20, ageMax: 24, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 24 }, { label: "LOW", min: 24, max: 29 },
      { label: "AVERAGE", min: 29, max: 34 }, { label: "GOOD", min: 34, max: 39 }, { label: "EXCELLENT", min: 39, max: undefined },
    ]},
    { ageMin: 25, ageMax: 39, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 26 }, { label: "LOW", min: 26, max: 32 },
      { label: "AVERAGE", min: 32, max: 36 }, { label: "GOOD", min: 36, max: 41 }, { label: "EXCELLENT", min: 41, max: undefined },
    ]},
    { ageMin: 40, ageMax: 54, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 22 }, { label: "LOW", min: 22, max: 27 },
      { label: "AVERAGE", min: 27, max: 31 }, { label: "GOOD", min: 31, max: 36 }, { label: "EXCELLENT", min: 36, max: undefined },
    ]},
    { ageMin: 55, ageMax: 99, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 18 }, { label: "LOW", min: 18, max: 22 },
      { label: "AVERAGE", min: 22, max: 27 }, { label: "GOOD", min: 27, max: 32 }, { label: "EXCELLENT", min: 32, max: undefined },
    ]},
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BANCO DE WELLS
// ─────────────────────────────────────────────────────────────────────────────

const WELLS_ADULT: NormativeTable = {
  key: "WELLS_ADULT",
  description: "Banco de Wells — Adultos por sexo (CSEP 2013)",
  reference: "Canadian Society for Exercise Physiology (CSEP). Physical Activity Training. 2013.",
  direction: "HIGHER_IS_BETTER",
  ageGroups: [
    { ageMin: 20, ageMax: 29, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 12 }, { label: "LOW", min: 12, max: 15 },
      { label: "AVERAGE", min: 15, max: 20 }, { label: "GOOD", min: 20, max: 27 }, { label: "EXCELLENT", min: 27, max: undefined },
    ]},
    { ageMin: 30, ageMax: 39, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 10 }, { label: "LOW", min: 10, max: 13 },
      { label: "AVERAGE", min: 13, max: 18 }, { label: "GOOD", min: 18, max: 24 }, { label: "EXCELLENT", min: 24, max: undefined },
    ]},
    { ageMin: 40, ageMax: 99, sex: "M", ranges: [
      { label: "VERY_LOW", min: undefined, max: 7 }, { label: "LOW", min: 7, max: 11 },
      { label: "AVERAGE", min: 11, max: 15 }, { label: "GOOD", min: 15, max: 22 }, { label: "EXCELLENT", min: 22, max: undefined },
    ]},
    { ageMin: 20, ageMax: 29, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 18 }, { label: "LOW", min: 18, max: 21 },
      { label: "AVERAGE", min: 21, max: 28 }, { label: "GOOD", min: 28, max: 34 }, { label: "EXCELLENT", min: 34, max: undefined },
    ]},
    { ageMin: 30, ageMax: 39, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 16 }, { label: "LOW", min: 16, max: 20 },
      { label: "AVERAGE", min: 20, max: 25 }, { label: "GOOD", min: 25, max: 32 }, { label: "EXCELLENT", min: 32, max: undefined },
    ]},
    { ageMin: 40, ageMax: 99, sex: "F", ranges: [
      { label: "VERY_LOW", min: undefined, max: 13 }, { label: "LOW", min: 13, max: 17 },
      { label: "AVERAGE", min: 17, max: 23 }, { label: "GOOD", min: 23, max: 29 }, { label: "EXCELLENT", min: 29, max: undefined },
    ]},
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Registro completo
// ─────────────────────────────────────────────────────────────────────────────

export const NORMATIVE_REGISTRY: NormativeTable[] = [
  BODY_FAT_MALE_ADULT,
  BODY_FAT_FEMALE_ADULT,
  VO2MAX_ADULT,
  FTP_CYCLISTS,
  CMJ_ADULTS,
  HANDGRIP_ADULT,
  WELLS_ADULT,
  {
    key: "BODY_FAT_ADULT_GENERIC",
    description: "% Gordura corporal genérico (sem sexo/idade específicos)",
    reference: "ACSM 2022 — referência conservadora.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 6 },
      { label: "LOW", min: 6, max: 14 },
      { label: "AVERAGE", min: 14, max: 25 },
      { label: "ABOVE_AVERAGE", min: 25, max: 32 },
      { label: "VERY_LOW", min: 32, max: undefined },
    ],
  },
  {
    key: "BODY_FAT_ADULT_GUEDES",
    description: "% Gordura — Referência de Guedes para adultos brasileiros",
    reference: "Guedes DP, Guedes JERP. Rev Paul Educ Fís. 1994.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 5 },
      { label: "LOW", min: 5, max: 12 },
      { label: "AVERAGE", min: 12, max: 22 },
      { label: "ABOVE_AVERAGE", min: 22, max: 30 },
      { label: "VERY_LOW", min: 30, max: undefined },
    ],
  },
  {
    key: "BODY_FAT_ADULT_FAULKNER",
    description: "% Gordura — Referência de Faulkner",
    reference: "Faulkner JA. Res Q. 1968.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 6 },
      { label: "LOW", min: 6, max: 12 },
      { label: "AVERAGE", min: 12, max: 20 },
      { label: "ABOVE_AVERAGE", min: 20, max: 28 },
      { label: "VERY_LOW", min: 28, max: undefined },
    ],
  },
  {
    key: "BODY_FAT_DEXA",
    description: "% Gordura DEXA — padrão-ouro (WHO 2000)",
    reference: "WHO. Obesity: preventing and managing the global epidemic. 2000.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 5 },
      { label: "LOW", min: 5, max: 15 },
      { label: "AVERAGE", min: 15, max: 25 },
      { label: "ABOVE_AVERAGE", min: 25, max: 35 },
      { label: "VERY_LOW", min: 35, max: undefined },
    ],
  },
  {
    key: "SIX_MIN_WALK_ADULT",
    description: "TC6M — Adultos 40–80 anos (Enright & Sherrill 1998)",
    reference: "Enright PL, Sherrill DL. Am J Respir Crit Care Med. 1998.",
    direction: "HIGHER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 300 },
      { label: "LOW", min: 300, max: 400 },
      { label: "AVERAGE", min: 400, max: 500 },
      { label: "GOOD", min: 500, max: 580 },
      { label: "EXCELLENT", min: 580, max: undefined },
    ],
  },
  {
    key: "VDOT_RUNNERS",
    description: "VDOT — Níveis de corredores por Daniels",
    reference: "Daniels J. Daniels' Running Formula. 3rd ed. Human Kinetics; 2014.",
    direction: "HIGHER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 30 },
      { label: "LOW", min: 30, max: 40 },
      { label: "AVERAGE", min: 40, max: 52 },
      { label: "ABOVE_AVERAGE", min: 52, max: 62 },
      { label: "GOOD", min: 62, max: 75 },
      { label: "EXCELLENT", min: 75, max: undefined },
    ],
  },
  {
    key: "STRENGTH_RELATIVE",
    description: "Força relativa (kg/kg) — contexto geral",
    reference: "NSCA. Essentials of Strength Training and Conditioning. 2008.",
    direction: "HIGHER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 0.5 },
      { label: "LOW", min: 0.5, max: 0.75 },
      { label: "AVERAGE", min: 0.75, max: 1.0 },
      { label: "ABOVE_AVERAGE", min: 1.0, max: 1.3 },
      { label: "GOOD", min: 1.3, max: 1.7 },
      { label: "EXCELLENT", min: 1.7, max: undefined },
    ],
  },
  {
    key: "SPRINT_10M_ADULTS",
    description: "Sprint 10m — atletas adultos (referência por esporte)",
    reference: "Haugen TA et al. Int J Sports Physiol Perform. 2012.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "EXCELLENT", min: undefined, max: 1.70 },
      { label: "GOOD", min: 1.70, max: 1.90 },
      { label: "ABOVE_AVERAGE", min: 1.90, max: 2.10 },
      { label: "AVERAGE", min: 2.10, max: 2.30 },
      { label: "LOW", min: 2.30, max: undefined },
    ],
  },
  {
    key: "SPRINT_30M_ADULTS",
    description: "Sprint 30m — atletas adultos",
    reference: "Haugen TA et al. Int J Sports Physiol Perform. 2012.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "EXCELLENT", min: undefined, max: 3.9 },
      { label: "GOOD", min: 3.9, max: 4.3 },
      { label: "ABOVE_AVERAGE", min: 4.3, max: 4.7 },
      { label: "AVERAGE", min: 4.7, max: 5.2 },
      { label: "LOW", min: 5.2, max: undefined },
    ],
  },
  {
    key: "ILLINOIS_ADULTS",
    description: "Teste de Illinois — adultos ativos",
    reference: "Pauole K et al. J Strength Cond Res. 2000.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "EXCELLENT", min: undefined, max: 15.2 },
      { label: "GOOD", min: 15.2, max: 16.0 },
      { label: "AVERAGE", min: 16.0, max: 17.0 },
      { label: "LOW", min: 17.0, max: 18.5 },
      { label: "VERY_LOW", min: 18.5, max: undefined },
    ],
  },
  {
    key: "T_TEST_ADULTS",
    description: "Teste T — adultos ativos",
    reference: "Pauole K et al. J Strength Cond Res. 2000.",
    direction: "LOWER_IS_BETTER",
    ranges: [
      { label: "EXCELLENT", min: undefined, max: 9.5 },
      { label: "GOOD", min: 9.5, max: 10.5 },
      { label: "AVERAGE", min: 10.5, max: 11.5 },
      { label: "LOW", min: 11.5, max: 13.0 },
      { label: "VERY_LOW", min: 13.0, max: undefined },
    ],
  },
  {
    key: "DORSIFLEXION_ADULT",
    description: "Dorsiflexão de tornozelo — lunge test (Bennell 1998)",
    reference: "Bennell K et al. Br J Sports Med. 1998;32(2):138-143.",
    direction: "HIGHER_IS_BETTER",
    ranges: [
      { label: "VERY_LOW", min: undefined, max: 9 },
      { label: "LOW", min: 9, max: 12 },
      { label: "AVERAGE", min: 12, max: 16 },
      { label: "GOOD", min: 16, max: 20 },
      { label: "EXCELLENT", min: 20, max: undefined },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function findNormativeTable(key: string): NormativeTable | undefined {
  return NORMATIVE_REGISTRY.find((t) => t.key === key);
}

/**
 * Classifica um valor usando a tabela normativa.
 * @param tableKey chave da NormativeTable
 * @param value valor numérico medido
 * @param age idade em anos (para tabelas com ageGroups)
 * @param sex "M" | "F" (para tabelas sexo-específicas)
 */
export function classifyResult(
  tableKey: string,
  value: number,
  age?: number,
  sex?: "M" | "F",
): { label: ClassificationLabel; labelPt: string; reference: string; ageGroupUsed?: string } | null {
  const table = findNormativeTable(tableKey);
  if (!table) return null;

  let ranges = table.ranges;

  if (table.ageGroups && table.ageGroups.length > 0) {
    const group = table.ageGroups.find(
      (g) =>
        (age === undefined || (age >= g.ageMin && age <= g.ageMax)) &&
        (g.sex === undefined || g.sex === sex),
    );
    if (!group) return null;
    ranges = group.ranges;
  }

  if (!ranges) return null;

  for (const range of ranges) {
    const aboveMin = range.min === undefined || value >= range.min;
    const belowMax = range.max === undefined || value < range.max;
    if (aboveMin && belowMax) {
      return {
        label: range.label,
        labelPt: CLASSIFICATION_LABEL_PT[range.label],
        reference: table.reference,
      };
    }
  }

  return null;
}
