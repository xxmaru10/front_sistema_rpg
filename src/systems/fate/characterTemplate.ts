import type { Character } from "@/types/domain";
import { DEFAULT_SKILLS } from "./types";
import { v4 as uuidv4 } from "uuid";

export function createFateCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: uuidv4(),
    name: "Novo Personagem",
    ownerUserId: "",
    fatePoints: 3,
    refresh: 3,
    stress: { physical: [false, false], mental: [false, false] },
    consequences: {},
    skills: DEFAULT_SKILLS.reduce((acc: Record<string, number>, sk) => ({ ...acc, [sk]: 0 }), {}),
    inventory: [],
    stunts: [],
    spells: [],
    magicLevel: 0,
    systemData: {},
    ...overrides,
  };
}
