import type { Character } from "@/types/domain";
import type { VampireCharacter, VampireSystemData } from "./types";
import { VAMPIRE_SKILLS } from "./utils";

export function createVampireCharacter(overrides: Partial<Character> = {}): VampireCharacter {
  const systemData: VampireSystemData = {
    fatePoints: 3,
    refresh: 3,
    generation: 13,
    stress: {
      physical: [false, false],
      mental: [false, false],
      blood: [false, false, false],
    },
    stressValues: {
      physical: [1, 2],
      mental: [1, 2],
      blood: [1, 2, 3],
    },
    consequences: {},
    hungerConsequences: {},
    skills: VAMPIRE_SKILLS.reduce<Record<string, number>>(
      (acc, sk) => ({ ...acc, [sk]: 0 }),
      {}
    ),
    disciplines: [],
    stunts: [],
    inventory: [],
    sheetAspects: ["", "", "", ""],
    removedDefaultSlots: [],
    extraConsequenceSlots: [],
    removedDefaultHungerSlots: [],
    extraHungerSlots: [],
  };

  return {
    id: "",
    name: "Novo Vampiro",
    ownerUserId: "",
    systemData,
    // Legacy flat fields kept for transition compatibility
    fatePoints: systemData.fatePoints,
    refresh: systemData.refresh,
    stress: { physical: systemData.stress.physical, mental: systemData.stress.mental, blood: systemData.stress.blood },
    stressValues: { physical: systemData.stressValues.physical, mental: systemData.stressValues.mental, blood: systemData.stressValues.blood },
    consequences: systemData.consequences,
    skills: systemData.skills,
    stunts: systemData.stunts,
    inventory: systemData.inventory,
    sheetAspects: systemData.sheetAspects,
    removedDefaultSlots: systemData.removedDefaultSlots,
    extraConsequenceSlots: systemData.extraConsequenceSlots,
    spells: [],
    magicLevel: 0,
    activeInArena: false,
    source: "active",
    ...overrides,
  } as VampireCharacter;
}
