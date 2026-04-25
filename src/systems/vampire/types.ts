import type { Character } from "@/types/domain";
import type { ConsequenceData } from "@/systems/fate/types";

export type { ConsequenceData };

export interface Discipline {
  id: string;
  name: string;
  description: string;
  cost: string;
}

export type VampireSystemData = {
  fatePoints: number;
  refresh: number;
  generation: number;
  stress: {
    physical: boolean[];
    mental: boolean[];
    blood: boolean[];
  };
  stressValues: {
    physical: number[];
    mental: number[];
    blood: number[];
  };
  consequences: Record<string, ConsequenceData>;
  hungerConsequences: Record<string, ConsequenceData>;
  skills: Record<string, number>;
  disciplines: Discipline[];
  stunts: import("@/systems/fate/types").Stunt[];
  inventory: import("@/systems/fate/types").Item[];
  sheetAspects: string[];
  removedDefaultSlots: string[];
  extraConsequenceSlots: string[];
  removedDefaultHungerSlots: string[];
  extraHungerSlots: string[];
  blinkmotion?: {
    username?: string;
    password?: string;
  };
}

export interface VampireCharacter extends Character {
  systemData: VampireSystemData;
}
