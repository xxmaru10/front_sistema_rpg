import type { SystemPlugin } from "../index";
import { reduceFate } from "./reducer";
import { isCharacterEliminated } from "./gameLogic";
import { createFateCharacter } from "./characterTemplate";
import { FATE_EVENT_TYPES } from "./events";
import { CharacterCard, CombatTab, DiceRoller } from "./ui";

const plugin: SystemPlugin = {
  id: "fate",
  name: "Fate Core",
  features: { fatePoints: true },
  characterTemplate: createFateCharacter,
  reducer: reduceFate,
  eventTypes: FATE_EVENT_TYPES,
  ui: {
    CharacterCard: CharacterCard as any,
    CombatTab: CombatTab as any,
    DiceRoller: DiceRoller as any,
  },
  gameLogic: { isCharacterEliminated },
};

export default plugin;
