import type { Character } from "@/types/domain";
import type { VampireCharacter, VampireSystemData } from "./types";
import { VAMPIRE_SKILLS } from "./utils";

export function migrateLegacyVampireCharacter(char: Character): VampireCharacter {
  const c = char as any;
  // Already migrated
  if (c.systemData?.generation !== undefined) return char as VampireCharacter;

  const existing: VampireSystemData = {
    fatePoints: c.fatePoints ?? 3,
    refresh: c.refresh ?? 3,
    generation: c.generation ?? 13,
    stress: {
      blood: c.stress?.blood ?? [false, false, false],
    },
    stressValues: {
      blood: c.stressValues?.blood ?? [1, 2, 3],
    },
    consequences: c.consequences ?? {},
    hungerConsequences: c.hungerConsequences ?? {},
    skills: c.skills ?? VAMPIRE_SKILLS.reduce<Record<string, number>>((a, sk) => ({ ...a, [sk]: 0 }), {}),
    disciplines: c.disciplines ?? [],
    stunts: c.stunts ?? [],
    inventory: c.inventory ?? [],
    sheetAspects: c.sheetAspects ?? ["", "", "", ""],
    removedDefaultSlots: c.removedDefaultSlots ?? [],
    extraConsequenceSlots: c.extraConsequenceSlots ?? [],
    removedDefaultHungerSlots: c.removedDefaultHungerSlots ?? [],
    extraHungerSlots: c.extraHungerSlots ?? [],
  };

  return { ...char, systemData: existing } as VampireCharacter;
}
