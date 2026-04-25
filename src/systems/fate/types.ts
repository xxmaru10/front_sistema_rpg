import type { Character, EntityNote } from "@/types/domain";

// ─── Fate-specific auxiliary types ───────────────────────────────────────────

export type ItemSize = "L" | "M" | "G";

export type Item = {
  id: string;
  name: string;
  description?: string;
  bonus: number;
  quantityCurrent?: number;
  quantityTotal?: number;
  size?: ItemSize;
  url?: string;
  isContainer?: boolean;
  contents?: Item[];
  capacity?: number;
  maxSize?: ItemSize;
};

export type Stunt = {
  id: string;
  name: string;
  description: string;
  cost: string;
};

export type Spell = {
  id: string;
  name: string;
  description: string;
  cost: string;
};

export type ConsequenceDebuff = {
  skill: string;
  value: number;
};

export type ConsequenceData = {
  text: string;
  debuff?: ConsequenceDebuff;
};

export type StressTrackValues = {
  physical: number[];
  mental: number[];
};

export const DEFAULT_SKILLS = [
  "Atirar", "Atletismo", "Comunicação", "Condução",
  "Conhecimentos", "Contatos", "Empatia", "Enganar",
  "Furtividade", "Investigar", "Lutar", "Ofícios",
  "Percepção", "Provocar", "Recursos", "Roubo",
  "Ocultismo", "Vigor", "Vontade"
] as const;

// ─── FateCharacter — extends the generic Character ───────────────────────────
// The generic Character has systemData: Record<string, unknown>.
// In a Fate session, systemData carries all of these fields.
// Components in fate/ui/ can cast Character → FateCharacter to access them.
export interface FateSystemData {
  fatePoints: number;
  refresh?: number;
  stress: {
    physical: boolean[];
    mental: boolean[];
  };
  stressValues?: StressTrackValues;
  consequences: {
    [key: string]: ConsequenceData | undefined;
    mild?: ConsequenceData;
    mild2?: ConsequenceData;
    moderate?: ConsequenceData;
    severe?: ConsequenceData;
    extreme?: ConsequenceData;
  };
  skills: Record<string, number>;
  skillResources?: Record<string, { current: number; max: number }>;
  inventory: Item[];
  stunts: Stunt[];
  spells: Spell[];
  magicLevel: number;
  sheetAspects?: string[];
  removedDefaultSlots?: string[];
  extraConsequenceSlots?: string[];
  biography?: string;
}

export interface FateCharacter extends Character {
  systemData: FateSystemData;
}
