import type { ComponentType } from "react";
import type { Character, SessionState, ActionEvent } from "@/types/domain";

export type SystemId = string;

export interface SystemFeatures {
  fatePoints?: boolean;
  spellSlots?: boolean;
  hpTrack?: boolean;
  sanity?: boolean;
}

export interface DiceRollerProps {
  sessionId: string;
  actorUserId: string;
  userRole: "GM" | "PLAYER";
  characterId?: string;
}

export interface SystemPlugin {
  id: SystemId;
  name: string;
  features: SystemFeatures;
  characterTemplate: () => Character;
  reducer: (state: SessionState, event: ActionEvent) => SessionState;
  eventTypes: readonly string[];
  ui: {
    CharacterCard: ComponentType<any>;
    CombatTab: ComponentType<any>;
    DiceRoller: ComponentType<any>;
  };
  gameLogic: {
    isCharacterEliminated: (c: Character) => boolean;
  };
}
