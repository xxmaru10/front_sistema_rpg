import type { SystemPlugin } from "../index";
import { reduceVampire } from "./reducer";
import { isCharacterEliminated } from "./gameLogic";
import { createVampireCharacter } from "./characterTemplate";
import { VAMPIRE_EVENT_TYPES } from "./events";
import { CharacterCard, CombatTab, DiceRoller } from "./ui";

const plugin: SystemPlugin = {
  id: "vampire",
  name: "Fate – Homebrew: Vampire",
  features: { 
    fatePoints: true,
    // Note: spellSlots is false for Vampire as it uses Disciplines instead
  },
  characterTemplate: createVampireCharacter,
  reducer: reduceVampire,
  eventTypes: VAMPIRE_EVENT_TYPES,
  ui: {
    CharacterCard: CharacterCard as any,
    CombatTab: CombatTab as any,
    DiceRoller: DiceRoller as any,
  },
  gameLogic: { 
    isCharacterEliminated 
  },
};

export default plugin;
