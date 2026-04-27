/**
 * @file: src/types/domain.ts
 * @summary: Central definition of the project's data models, interfaces, and Event types. 
 * Defines the contract for all data structures in the game.
 * @note: This is a synthesis guide for architectural understanding.
 */
export type Visibility =
  | "PUBLIC"
  | "GM_ONLY"
  | { kind: "PLAYER_ONLY"; userId: string };

export type EventEnvelope<TType extends string, TPayload> = {
  id: string;           // UUID
  sessionId: string;
  seq: number;          // Global ordering (emitted by GM/Server)
  type: TType;
  actorUserId: string;
  actorCharacterId?: string;
  visibility: Visibility;
  createdAt: string;    // ISO
  payload: TPayload;
};

export interface StickyNote {
    id: string;
    text: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    minimized: boolean;
    zIndex: number;
    ownerId: string;
}

export type Note = {
  id: string;
  authorId: string;
  authorName: string;
  content: string; // HTML/RichText
  createdAt: string;
  isPrivate?: boolean;
  sessionNumber?: number;
  folderId?: string;
};

export type EntityNote = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  isPrivate?: boolean;
};

export type NoteFolder = {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
};


// Fate-specific types are now in src/systems/fate/types.ts.
// Re-exported here for backward compatibility with existing imports.
export { DEFAULT_SKILLS } from "@/systems/fate/types";
import type { Item, ItemSize, Stunt, Spell, ConsequenceDebuff, ConsequenceData, StressTrackValues } from "@/systems/fate/types";
export type { Item, ItemSize, Stunt, Spell, ConsequenceDebuff, ConsequenceData, StressTrackValues };

export type ArenaPortraitFocus = {
  x: number; // percent 0..100
  y: number; // percent 0..100
  zoom: number; // multiplier >= 1
};

// Generic platform character — only platform-level fields.
// System-specific data lives in systemData (typed by the plugin).
export type Character = {
  id: string;
  name: string;
  ownerUserId: string;
  systemData: Record<string, unknown>;
  currentZoneId?: string;
  isNPC?: boolean;
  source?: "active" | "bestiary";
  scope?: "session" | "global";
  npcType?: "capanga" | "batedor" | "ameaca" | "boss" | "vilao";
  imageUrl?: string;
  arenaPortraitFocus?: ArenaPortraitFocus;
  activeInArena?: boolean;
  arenaSide?: 'HERO' | 'THREAT';
  isHazard?: boolean;
  difficulty?: number;
  impulseArrows?: number;
  linkedNotes?: EntityNote[];
  religionId?: string;
  // Legacy Fate fields — kept for transition. Will be removed in a follow-up pass.
  fatePoints?: number;
  refresh?: number;
  stress?: Record<string, boolean[]>;
  stressValues?: import("@/systems/fate/types").StressTrackValues;
  consequences?: { [key: string]: import("@/systems/fate/types").ConsequenceData | undefined };
  skills?: Record<string, number>;
  skillResources?: Record<string, { current: number; max: number }>;
  inventory?: import("@/systems/fate/types").Item[];
  stunts?: import("@/systems/fate/types").Stunt[];
  spells?: import("@/systems/fate/types").Spell[];
  magicLevel?: number;
  biography?: string;
  sheetAspects?: string[];
  removedDefaultSlots?: string[];
  extraConsequenceSlots?: string[];
  money?: number;
};

// Aspect State
export type AspectScope = "CHARACTER" | "SCENE" | "ZONE" | "CONSEQUENCE";
export type Aspect = {
  id: string;
  name: string;
  description?: string;
  scope: AspectScope;
  ownerId?: string; // characterId, sceneId, or zoneId
  freeInvokes: number;
  revealed: boolean;
};

// Zone & Scene
export type Zone = {
  id: string;
  name: string;
  description?: string;
  sceneId: string;
};

export type ZoneLink = {
  sceneId: string;
  fromZoneId: string;
  toZoneId: string;
  bidirectional: boolean;
};

export type Scene = {
  id: string;
  title: string;
  active: boolean;
};

// Session & Seat
export type SeatState = "SPECTATOR" | "ENABLED" | "LOCKED";
export type PlayerSeat = {
  userId: string;
  characterId?: string;
  state: SeatState;
  role: "GM" | "PLAYER";
};

export type Challenge = {
  isActive: boolean;
  text: string;
  difficulty: number;
  aspects?: string[];
};

// Session State - The core state of a game session
export type SessionState = {
  id: string;
  system: string;
  seats: PlayerSeat[];
  characters: Record<string, Character>;
  aspects: Record<string, Aspect>;
  zones: Record<string, Zone>;
  links: ZoneLink[];
  activeSceneId?: string;
  currentTurnUserId?: string;
  headerImages: {
    characters?: string;
    combat?: string;
    log?: string;
    bestiary?: string;
    notes?: string;
    vi?: string;
  };
  challenge?: Challenge;
  turnOrder?: string[]; // Array of character IDs
  currentTurnIndex?: number;
  currentRound?: number;
  isReaction?: boolean;
  targetId?: string;
  pendingTargetIds?: string[];
  damageType?: "PHYSICAL" | "MENTAL";
  timerPaused?: boolean;
  timerPausedAt?: string; // ISO string when paused
  notes?: Note[];
  noteFolders?: NoteFolder[];
  themeColor?: string;
  themeTitleColor?: string | null;
  themePreset?: string;
  soundSettings?: {
    victory?: string;
    defeat?: string;
    hit?: string;
    death?: string;
    defense?: string;
    dice?: string;
    portrait?: string;
    battleStart?: string;
  };
  currentMusic?: {
    url: string;
    loop: boolean;
    playing: boolean;
  };
    atmosphericEffect?: "none" | "rain" | "leaves_green" | "leaves_orange" | "fog" | "sparks" | "snow" | "blizzard" | "inferno" | "acid_rain" | "blood_rain";
    worldEntities?: Record<string, WorldEntity>;
    missions?: Mission[];
    timeline?: TimelineEvent[];
    skills?: GlobalSkill[];
    items?: GlobalItem[];
    lastTurnChangeTimestamp?: string;
    sessionNumber?: number;
    battlemap?: BattlemapState;
    name?: string;
    stickyNotes?: StickyNote[];
    themeLocked?: boolean;
    rollVisibilityOverrides?: Record<string, { hiddenForPlayers: boolean }>;
};

export type Stroke = {
    id: string;
    points: {x: number, y: number}[];
    color: string;
    width: number;
};
export type BattlemapObject = {
    id: string;
    imageUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    locked: boolean;
};

export type BattlemapLayerKind = "BACKGROUND_COLOR" | "IMAGE" | "DRAWING" | "OBJECTS";

export type BattlemapLayer = {
    id: string;
    kind: BattlemapLayerKind;
    name: string;
    order: number;
    visible: boolean;
    locked: boolean;
    color?: string;
    imageUrl?: string;
    strokeIds?: string[];
    objectIds?: string[];
    shapeIds?: string[];
};

export type BattlemapShapeKind = "FREEHAND" | "RECT" | "CIRCLE" | "DIAMOND" | "TRIANGLE";

export type BattlemapShape = {
    id: string;
    kind: Exclude<BattlemapShapeKind, "FREEHAND">;
    color: string;
    strokeWidth: number;
    x: number;
    y: number;
    width: number;
    height: number;
};

export type BattlemapState = {
    isActive: boolean;
    imageUrl: string;
    gridSize: number;
    gridColor: string;
    gridThickness: number;
    offsetX: number;
    offsetY: number;
    zoom: number;
    strokes: Stroke[];
    objects: BattlemapObject[];
    shapes?: BattlemapShape[];
    layers?: BattlemapLayer[];
    activeLayerId?: string;
};


export type MissionSubTask = {
    id: string;
    text: string;
    completed: boolean;
};

export type Mission = {
    id: string;
    name: string;
    description: string;
    subTasks: MissionSubTask[];
    completed: boolean;
    createdAt: string;
    // For timeline integration (optional)
    day?: number;
    month?: number;
    year?: number;
    hideFromTimeline?: boolean;
    linkedNotes?: EntityNote[];
};


export type TimelineEvent = {
    id: string;
    name: string;
    description: string;
    day?: number;
    month?: number;
    year: number;
    type: "MANUAL" | "MISSION";
    missionId?: string; // If type is MISSION
    createdAt: string;
    linkedNotes?: EntityNote[];
};

export type GlobalSkill = {
    id: string;
    name: string;
    description: string;
    requirement: string;
    color?: string;
    createdAt: string;
    linkedNotes?: EntityNote[];
};

export type GlobalItem = {
    id: string;
    name: string;
    description: string;
    price: number;
    quantity: number;
    bonus?: number;
    size?: ItemSize;
    requirement: string;
    imageUrl?: string;
    createdAt: string;
    linkedNotes?: EntityNote[];
};





// Event Payloads
export type DieType = "dF" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export type DicePoolEntry = {
  type: DieType;
  count: number;
};

export type DiceBreakdownEntry = {
  type: DieType;
  values: number[];
};

export type RollPayload = {
  characterId: string;
  dice: number[]; // Flat array of all values for legacy compatibility
  diceSum: number;
  diceBreakdown?: DiceBreakdownEntry[]; // Detailed breakdown by die type
  skill?: { name: string; rank: number };
  modifier: number; // Total modifier (Skill + Manual + Item)
  manualBonus?: number; // The manual bonus input
  item?: { name: string; bonus: number }; // Item bonus
  total: number;
  actionType?: "ATTACK" | "DEFEND" | "OVERCOME" | "CREATE_ADVANTAGE";
  targetCharacterId?: string; // Legacy single target
  targetCharacterIds?: string[]; // New multiple targets
  damageType?: "PHYSICAL" | "MENTAL";
  note?: string;
  targetDiff?: number;
  challengeDescription?: string;
  hiddenForPlayers?: boolean;
};

export type WorldEntityType = 
    | "PERSONAGEM" 
    | "LOCALIZACAO" 
    | "MAPA" 
    | "FACAO" 
    | "FAMILIA" 
    | "RELIGIAO"
    | "BESTIARIO" 
    | "RACA"
    | "OUTROS";

export type DescriptionBlock = {
    id: string;
    content: string;
    hidden: boolean;
};

export type WorldEntity = {
    id: string;
    name: string;
    type: WorldEntityType;
    color: string;
    tags: string[];
    description: string;
    createdAt: string;
    familyId?: string;
    factionId?: string;
    raceId?: string;
    originId?: string;
    religionId?: string;
    currentLocationId?: string;
    locationType?: string;
    linkedLocationId?: string;
    imageUrl?: string;
    profession?: string;
    linkedNotes?: EntityNote[];
    fieldVisibility?: Record<string, boolean>; // if true, field is HIDDEN from players
    descriptionBlocks?: DescriptionBlock[];
};

export type ActionEvent =
  | EventEnvelope<"SESSION_CREATED", { sessionId: string; name?: string; gmCode?: string; playerCode?: string; system?: string }>
  | EventEnvelope<"TURN_GRANTED", { userId: string }>
  | EventEnvelope<"TURN_REVOKED", { userId: string }>
  | EventEnvelope<"SEAT_STATE_CHANGED", { userId: string; state: SeatState }>
  | EventEnvelope<"ROLL_RESOLVED", RollPayload>
  | EventEnvelope<"ROLL_VISIBILITY_UPDATED", { rollEventId: string; hiddenForPlayers: boolean }>
  | EventEnvelope<"CHARACTER_CREATED", Character>
  | EventEnvelope<"FP_SPENT", { characterId: string; amount: number; reason: string }>
  | EventEnvelope<"FP_GAINED", { characterId: string; amount: number; reason: string }>
  | EventEnvelope<"STRESS_MARKED", { characterId: string; track: "PHYSICAL" | "MENTAL"; boxIndex: number }>
  | EventEnvelope<"STRESS_CLEARED", { characterId: string; track: "PHYSICAL" | "MENTAL"; boxIndex: number }>
  | EventEnvelope<"CHARACTER_SKILL_UPDATED", { characterId: string; skill: string; rank: number }>
  | EventEnvelope<"ASPECT_CREATED", Partial<Aspect> & { id: string; name: string; scope: AspectScope }>
  | EventEnvelope<"ASPECT_UPDATED", { aspectId: string; patch: Partial<Aspect> }>
  | EventEnvelope<"ASPECT_REVEALED", { aspectId: string }>
  | EventEnvelope<"FREE_INVOKE_PRODUCED", { aspectId: string; amount: number }>
  | EventEnvelope<"FREE_INVOKE_CONSUMED", { aspectId: string; amount: number }>
  | EventEnvelope<"ZONE_CREATED", Zone>
  | EventEnvelope<"ZONE_LINKED", ZoneLink>
  | EventEnvelope<"CHARACTER_MOVED", { characterId: string; fromZoneId?: string; toZoneId: string; cost?: string }>
  | EventEnvelope<"SCENE_CREATED", { id: string; title: string }>
  | EventEnvelope<"SCENE_ACTIVATED", { id: string }>
  | EventEnvelope<"CHARACTER_CONSEQUENCE_UPDATED", { characterId: string; slot: string; value: string | null; debuff?: ConsequenceDebuff }>
  | EventEnvelope<"CHARACTER_CONSEQUENCE_DELETED", { characterId: string; slot: string }>
  | EventEnvelope<"CHARACTER_CONSEQUENCE_SLOT_ADDED", { characterId: string; slot: string }>
  | EventEnvelope<"CHARACTER_INVENTORY_UPDATED", { characterId: string; item: Item }>
  | EventEnvelope<"CHARACTER_STUNT_UPDATED", { characterId: string; stunt: Stunt }>
  | EventEnvelope<"CHARACTER_STUNT_DELETED", { characterId: string; stuntId: string }>
  | EventEnvelope<"CHARACTER_SPELL_UPDATED", { characterId: string; spell: Spell }>
  | EventEnvelope<"CHARACTER_SPELL_DELETED", { characterId: string; spellId: string }>
  | EventEnvelope<"CHARACTER_MAGIC_LEVEL_UPDATED", { characterId: string; level: number }>
  | EventEnvelope<"CHARACTER_IMAGE_UPDATED", { characterId: string; imageUrl: string }>
  | EventEnvelope<"STRESS_TRACK_EXPANDED", { characterId: string; track: "PHYSICAL" | "MENTAL"; value?: number }>
  | EventEnvelope<"STRESS_TRACK_REDUCED", { characterId: string; track: "PHYSICAL" | "MENTAL" }>
  | EventEnvelope<"STRESS_BOX_VALUE_UPDATED", { characterId: string; track: "PHYSICAL" | "MENTAL"; boxIndex: number; value: number }>
  | EventEnvelope<"CHARACTER_REFRESH_UPDATED", { characterId: string; refresh: number }>
  | EventEnvelope<"CHARACTER_BIO_UPDATED", { characterId: string; biography: string }>
  | EventEnvelope<"CHARACTER_SHEET_ASPECT_UPDATED", { characterId: string; index: number; value: string }>
  | EventEnvelope<"CHARACTER_NAME_UPDATED", { characterId: string; name: string }>
  | EventEnvelope<"SKILL_RESOURCE_INIT", { characterId: string; skill: string; initialMax: number }>
  | EventEnvelope<"SKILL_RESOURCE_UPDATED", { characterId: string; skill: string; current: number; max: number }>
  | EventEnvelope<"CHARACTER_DELETED", { characterId: string }>
  | EventEnvelope<"CHARACTER_UPDATED", { characterId: string; changes: Partial<Character> }>
  | EventEnvelope<"SESSION_HEADER_UPDATED", { tab: "characters" | "combat" | "log" | "bestiary" | "notes" | "vi"; imageUrl: string }>
  | EventEnvelope<"SFX_TRIGGERED", { url: string }>
  | EventEnvelope<"MUSIC_PLAYBACK_CHANGED", { url: string; playing: boolean; loop: boolean; volume?: number; startedAt?: string; isTemporary?: boolean; restoreUrl?: string; restoreLoop?: boolean }>
  | EventEnvelope<"CHALLENGE_UPDATED", { isActive: boolean; text: string; difficulty: number; aspects?: string[] }>
  | EventEnvelope<"TURN_ORDER_UPDATED", { characterIds: string[] }>
  | EventEnvelope<"TURN_STEPPED", { index: number }>
  | EventEnvelope<"COMBAT_TARGET_SET", { targetId: string | null; targetIds?: string[]; damageType?: "PHYSICAL" | "MENTAL"; isReaction?: boolean }>
  | EventEnvelope<"COMBAT_REACTION_ENDED", { characterId?: string }>
  | EventEnvelope<"COMBAT_OUTCOME", { attackerId: string; defenderId: string; attackTotal: number; defenseTotal: number; result: number; message: string; track?: "PHYSICAL" | "MENTAL" }>
  | EventEnvelope<"TIMER_PAUSED", { pausedAt: string }>
  | EventEnvelope<"TIMER_RESUMED", { resumedAt: string }>
  | EventEnvelope<"TURN_FORCED_PASS", { characterId: string; isReaction: boolean }>
  | EventEnvelope<"NOTE_ADDED", Note>
  | EventEnvelope<"NOTE_DELETED", { noteId: string }>
  | EventEnvelope<"NOTE_UPDATED", { noteId: string; content?: string; patch?: Partial<Note> }>
  | EventEnvelope<"ALL_NOTES_DELETED", {}>
  | EventEnvelope<"NOTE_FOLDER_CREATED", NoteFolder>
  | EventEnvelope<"NOTE_FOLDER_UPDATED", { folderId: string; patch: Partial<NoteFolder> }>
  | EventEnvelope<"NOTE_FOLDER_DELETED", { folderId: string }>

  | EventEnvelope<"SESSION_THEME_UPDATED", { color: string }>
  | EventEnvelope<"SESSION_THEME_TITLE_COLOR_UPDATED", { color: string | null }>
  | EventEnvelope<"SESSION_THEME_PRESET_UPDATED", { preset: string }>
  | EventEnvelope<"SESSION_THEME_LOCK_UPDATED", { locked: boolean }>
  | EventEnvelope<"SESSION_SOUNDS_UPDATED", {
    victory?: string;
    defeat?: string;
    hit?: string;
    death?: string;
    defense?: string;
    dice?: string;
    portrait?: string;
    battleStart?: string;
  }>
  | EventEnvelope<"SESSION_CODES_UPDATED", { gmCode: string; playerCode: string }>
  | EventEnvelope<"ATMOSPHERIC_PLAYBACK_CHANGED", { url: string; playing: boolean; loop: boolean; startedAt?: string }>
  | EventEnvelope<"ATMOSPHERIC_EFFECT_UPDATED", { type: "none" | "rain" | "leaves_green" | "leaves_orange" | "fog" | "sparks" | "snow" | "blizzard" | "inferno" | "acid_rain" | "blood_rain" }>
  | EventEnvelope<"WORLD_ENTITY_CREATED", WorldEntity>
  | EventEnvelope<"WORLD_ENTITY_UPDATED", { entityId: string; patch: Partial<WorldEntity> }>
  | EventEnvelope<"WORLD_ENTITY_DELETED", { entityId: string }>
  
  | EventEnvelope<"MISSION_CREATED", Mission>
  | EventEnvelope<"MISSION_UPDATED", { missionId: string; patch: Partial<Mission> }>
  | EventEnvelope<"MISSION_DELETED", { missionId: string }>
  
  | EventEnvelope<"TIMELINE_EVENT_CREATED", TimelineEvent>
  | EventEnvelope<"TIMELINE_EVENT_UPDATED", { eventId: string; patch: Partial<TimelineEvent> }>
  | EventEnvelope<"TIMELINE_EVENT_DELETED", { eventId: string }>

  | EventEnvelope<"GLOBAL_SKILL_CREATED", GlobalSkill>
  | EventEnvelope<"GLOBAL_SKILL_UPDATED", { skillId: string; patch: Partial<GlobalSkill> }>
  | EventEnvelope<"GLOBAL_SKILL_DELETED", { skillId: string }>

  | EventEnvelope<"GLOBAL_ITEM_CREATED", GlobalItem>
  | EventEnvelope<"GLOBAL_ITEM_UPDATED", { itemId: string; patch: Partial<GlobalItem> }>
  | EventEnvelope<"GLOBAL_ITEM_DELETED", { itemId: string }>
  
  | EventEnvelope<"WORLD_ENTITY_NOTE_ADDED", { entityId: string; note: EntityNote }>
  | EventEnvelope<"WORLD_ENTITY_NOTE_DELETED", { entityId: string; noteId: string }>
  | EventEnvelope<"MISSION_NOTE_ADDED", { missionId: string; note: EntityNote }>
  | EventEnvelope<"MISSION_NOTE_DELETED", { missionId: string; noteId: string }>
  | EventEnvelope<"TIMELINE_EVENT_NOTE_ADDED", { eventId: string; note: EntityNote }>
  | EventEnvelope<"TIMELINE_EVENT_NOTE_DELETED", { eventId: string; noteId: string }>
  | EventEnvelope<"GLOBAL_SKILL_NOTE_ADDED", { skillId: string; note: EntityNote }>
  | EventEnvelope<"GLOBAL_SKILL_NOTE_DELETED", { skillId: string; noteId: string }>
  | EventEnvelope<"GLOBAL_ITEM_NOTE_ADDED", { itemId: string; note: EntityNote }>
  | EventEnvelope<"GLOBAL_ITEM_NOTE_DELETED", { itemId: string; noteId: string }>
  | EventEnvelope<"CHARACTER_NOTE_ADDED", { characterId: string; note: EntityNote }>
  | EventEnvelope<"CHARACTER_NOTE_UPDATED", { characterId: string; noteId: string; patch: Partial<EntityNote> }>
  | EventEnvelope<"CHARACTER_NOTE_DELETED", { characterId: string; noteId: string }>
  | EventEnvelope<"SESSION_NUMBER_UPDATED", { number: number }>
  | EventEnvelope<"BATTLEMAP_UPDATED", Partial<BattlemapState>>
  | EventEnvelope<"STICKY_NOTE_CREATED", StickyNote>
  | EventEnvelope<"STICKY_NOTE_UPDATED", { id: string; patch: Partial<StickyNote> }>
  | EventEnvelope<"STICKY_NOTE_DELETED", { id: string }>
  
  // Plugin: Vampire
  | EventEnvelope<"VAMPIRE_GENERATION_UPDATED", { characterId: string; generation: number }>
  | EventEnvelope<"VAMPIRE_DISCIPLINE_UPDATED", { characterId: string; discipline: import("@/systems/vampire/types").Discipline }>
  | EventEnvelope<"VAMPIRE_DISCIPLINE_DELETED", { characterId: string; disciplineId: string }>
  | EventEnvelope<"VAMPIRE_HUNGER_CONSEQUENCE_UPDATED", { characterId: string; slot: string; value: string | null; debuff?: import("@/systems/fate/types").ConsequenceDebuff }>
  | EventEnvelope<"VAMPIRE_HUNGER_CONSEQUENCE_DELETED", { characterId: string; slot: string }>
  | EventEnvelope<"VAMPIRE_HUNGER_CONSEQUENCE_SLOT_ADDED", { characterId: string; slot: string }>
  | EventEnvelope<"CHARACTER_MONEY_UPDATED", { characterId: string; value: number }>;
