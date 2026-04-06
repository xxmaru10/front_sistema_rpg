/**
 * @file: src/lib/projections.ts
 * @summary: Core logic for computing the current session state from the event log (Event Sourcing). 
 * Contains the initial state and the 'reduce' function that processes each ActionEvent.
 * @note: This is a synthesis guide for architectural understanding.
 */
import { ActionEvent, SessionState, Character, Aspect, DEFAULT_SKILLS, StressBox } from "@/types/domain";

/** 
 * Normalizes a stress track (array of booleans or StressBoxes) into current StressBox[] format.
 * Ensures backward compatibility with older characters.
 */
function normalizeStressTrack(track: (boolean | StressBox)[] | undefined): StressBox[] {
    if (!track) return [];
    return track.map((item, i) => {
        if (typeof item === 'boolean') {
            return { value: i + 1, checked: item };
        }
        return item;
    });
}

function normalizeStress(stress: { physical: (boolean | StressBox)[], mental: (boolean | StressBox)[] } | undefined) {
    return {
        physical: normalizeStressTrack(stress?.physical),
        mental: normalizeStressTrack(stress?.mental)
    };
}


/** The initial state for a new game session */
export const initialState: SessionState = {
    id: "",
    seats: [],
    characters: {},
    aspects: {},
    zones: {},
    links: [],
    headerImages: {},
    currentRound: 1,
    notes: [],
    themeColor: "#C5A059",
    themePreset: "medieval",
    missions: [],
    timeline: [],
    skills: [],
    items: [],
    sessionNumber: 1,
    stickyNotes: [],

    soundSettings: {

        victory: "audio/Effects/vitoria.mp3",
        defeat: "audio/Effects/derrota.mp3",
        death: "audio/Effects/morte.mp3",
        battleStart: "audio/Effects/battle_start.mp3"
    },
};

export function reduce(state: SessionState, event: ActionEvent): SessionState {
    const { type, payload } = event;

    // Safety check: if payload is somehow missing (e.g., stripped by Supabase Realtime size limits),
    // ignore this event to prevent application crashes, waiting for an explicit historical reload.
    if (!payload && type !== "ALL_NOTES_DELETED") {
        return state;
    }

    switch (type) {
        case "SESSION_CREATED":
            return { ...state, id: payload.sessionId, name: payload.name };

        case "TURN_GRANTED":
            return { ...state, currentTurnUserId: payload.userId };

        case "TURN_REVOKED":
            return { ...state, currentTurnUserId: undefined };
            
        case "SESSION_NUMBER_UPDATED":
            return { ...state, sessionNumber: payload.number };

        case "SESSION_HEADER_UPDATED":
            return {
                ...state,
                headerImages: {
                    ...state.headerImages,
                    [payload.tab]: payload.imageUrl
                }
            };

        case "SEAT_STATE_CHANGED":
            return {
                ...state,
                seats: state.seats.some(s => s.userId === payload.userId)
                    ? state.seats.map(s => s.userId === payload.userId ? { ...s, state: payload.state } : s)
                    : [...state.seats, { userId: payload.userId, state: payload.state, role: "PLAYER" }]
            };

        case "CHARACTER_CREATED":
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.id]: {
                        ...payload,
                        activeInArena: payload.activeInArena ?? false,
                        fatePoints: payload.fatePoints ?? 3,
                        stress: normalizeStress(payload.stress),
                        skills: payload.skills ?? DEFAULT_SKILLS.reduce((acc: Record<string, number>, sk: string) => ({ ...acc, [sk]: 0 }), {}),
                        consequences: payload.consequences ?? {},
                        inventory: payload.inventory ?? [],
                        stunts: payload.stunts ?? [],
                        spells: payload.spells ?? [],
                        magicLevel: payload.magicLevel ?? 0,
                        imageUrl: payload.imageUrl,
                        source: payload.source ?? "active",
                    }
                }
            };

        case "CHARACTER_MOVED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, currentZoneId: payload.toZoneId }
                }
            };
        }

        case "CHARACTER_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, ...payload.changes }
                }
            };
        }

        case "CHARACTER_DELETED": {
            const { [payload.characterId]: _, ...remainingCharacters } = state.characters;
            return {
                ...state,
                characters: remainingCharacters,
                turnOrder: (state.turnOrder || []).filter(id => id !== payload.characterId)
            };
        }

        case "FP_SPENT": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, fatePoints: Math.max(0, char.fatePoints - payload.amount) }
                }
            };
        }

        case "FP_GAINED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, fatePoints: char.fatePoints + payload.amount }
                }
            };
        }

        case "STRESS_MARKED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const trackType = payload.track.toLowerCase() as "physical" | "mental";
            const newTrack = normalizeStressTrack(char.stress[trackType]);
            if (payload.boxIndex >= 0 && payload.boxIndex < newTrack.length) {
                newTrack[payload.boxIndex].checked = true;
            }
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stress: { ...char.stress, [trackType]: newTrack }
                    }
                }
            };
        }

        case "STRESS_CLEARED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const trackType = payload.track.toLowerCase() as "physical" | "mental";
            const newTrack = normalizeStressTrack(char.stress[trackType]);
            if (payload.boxIndex >= 0 && payload.boxIndex < newTrack.length) {
                newTrack[payload.boxIndex].checked = false;
            }
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stress: { ...char.stress, [trackType]: newTrack }
                    }
                }
            };
        }

        case "STRESS_BOX_VALUE_CHANGED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const trackType = payload.track.toLowerCase() as "physical" | "mental";
            const newTrack = normalizeStressTrack(char.stress[trackType]);
            if (payload.boxIndex >= 0 && payload.boxIndex < newTrack.length) {
                newTrack[payload.boxIndex].value = payload.value;
            }
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stress: { ...char.stress, [trackType]: newTrack }
                    }
                }
            };
        }


        case "CHARACTER_CONSEQUENCE_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;


            // Build ConsequenceData object - handle null/empty values
            const consequenceData = (!payload.value || payload.value.trim() === "")
                ? undefined
                : {
                    text: payload.value,
                    debuff: payload.debuff
                };

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        consequences: {
                            ...char.consequences,
                            [payload.slot]: consequenceData
                        }
                    }
                }
            };
        }

        case "CHARACTER_CONSEQUENCE_DELETED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const newConsequences = { ...char.consequences };
            delete newConsequences[payload.slot];

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        consequences: newConsequences
                    }
                }
            };
        }

        case "CHARACTER_INVENTORY_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const currentInventory = char.inventory || [];
            const itemIndex = currentInventory.findIndex(i => i.id === payload.item.id);

            let newInventory;
            if (itemIndex >= 0) {
                newInventory = [...currentInventory];
                newInventory[itemIndex] = payload.item;
            } else {
                newInventory = [...currentInventory, payload.item];
            }

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        inventory: newInventory
                    }
                }
            };
        }

        case "CHARACTER_STUNT_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const currentStunts = char.stunts || [];
            const stuntIndex = currentStunts.findIndex(s => s.id === payload.stunt.id);

            let newStunts;
            if (stuntIndex >= 0) {
                newStunts = [...currentStunts];
                newStunts[stuntIndex] = payload.stunt;
            } else {
                newStunts = [...currentStunts, payload.stunt];
            }

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stunts: newStunts
                    }
                }
            };
        }

        case "CHARACTER_STUNT_DELETED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const currentStunts = char.stunts || [];
            const newStunts = currentStunts.filter(s => s.id !== payload.stuntId);

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stunts: newStunts
                    }
                }
            };
        }

        case "CHARACTER_SPELL_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const currentSpells = char.spells || [];
            const spellIndex = currentSpells.findIndex(s => s.id === payload.spell.id);

            let newSpells;
            if (spellIndex >= 0) {
                newSpells = [...currentSpells];
                newSpells[spellIndex] = payload.spell;
            } else {
                newSpells = [...currentSpells, payload.spell];
            }

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        spells: newSpells
                    }
                }
            };
        }

        case "CHARACTER_SPELL_DELETED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const currentSpells = char.spells || [];
            const newSpells = currentSpells.filter(s => s.id !== payload.spellId);

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        spells: newSpells
                    }
                }
            };
        }

        case "CHARACTER_MAGIC_LEVEL_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        magicLevel: payload.level
                    }
                }
            };
        }

        case "CHARACTER_SKILL_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        skills: { ...char.skills, [payload.skill]: payload.rank }
                    }
                }
            };
        }

        case "CHARACTER_IMAGE_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, imageUrl: payload.imageUrl }
                }
            };
        }



        case "STRESS_TRACK_EXPANDED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const trackType = payload.track.toLowerCase() as "physical" | "mental";
            const currentTrack = normalizeStressTrack(char.stress[trackType]);
            const nextValue = payload.value ?? (currentTrack.length > 0 ? (Math.max(...currentTrack.map(b => b.value)) + 1) : 1);
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stress: {
                            ...char.stress,
                            [trackType]: [...currentTrack, { value: nextValue, checked: false }]
                        }
                    }
                }
            };
        }



        case "STRESS_TRACK_REDUCED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const trackType = payload.track.toLowerCase() as "physical" | "mental";
            const currentTrack = char.stress[trackType];
            if (currentTrack.length === 0) return state;

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        stress: {
                            ...char.stress,
                            [trackType]: currentTrack.slice(0, -1)
                        }
                    }
                }
            };
        }

        case "CHARACTER_IMPULSE_ADDED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        impulses: (char.impulses || 0) + 1
                    }
                }
            };
        }

        case "CHARACTER_IMPULSE_REMOVED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        impulses: Math.max(0, (char.impulses || 0) - 1)
                    }
                }
            };
        }

        case "CHARACTER_REFRESH_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, refresh: payload.refresh }
                }
            };
        }

        case "CHARACTER_NAME_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, name: payload.name }
                }
            };
        }

        case "CHARACTER_BIO_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, biography: payload.biography }
                }
            };
        }

        case "CHARACTER_SHEET_ASPECT_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;

            const idx = payload.index;
            const newAspects = [...(char.sheetAspects || ["", "", "", ""])];
            newAspects[idx] = payload.value;

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: { ...char, sheetAspects: newAspects }
                }
            };
        }

        case "SKILL_RESOURCE_INIT": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const resources = char.skillResources || {};
            // If already exists, do nothing? Or maybe re-init? Safer to check.
            if (resources[payload.skill]) return state;

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        skillResources: {
                            ...resources,
                            [payload.skill]: { current: payload.initialMax, max: payload.initialMax }
                        }
                    }
                }
            };
        }

        case "SKILL_RESOURCE_UPDATED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            const resources = char.skillResources || {};

            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        skillResources: {
                            ...resources,
                            [payload.skill]: { current: payload.current, max: payload.max }
                        }
                    }
                }
            };
        }

        case "ASPECT_CREATED":
            return {
                ...state,
                aspects: {
                    ...state.aspects,
                    [payload.id]: {
                        id: payload.id,
                        name: payload.name,
                        scope: payload.scope || "SCENE",
                        freeInvokes: payload.freeInvokes || 0,
                        revealed: payload.revealed ?? true,
                        ownerId: payload.ownerId,
                        description: payload.description,
                    }
                }
            };

        case "ASPECT_UPDATED": {
            const aspect = state.aspects[payload.aspectId];
            if (!aspect) return state;
            return {
                ...state,
                aspects: {
                    ...state.aspects,
                    [payload.aspectId]: { ...aspect, ...payload.patch }
                }
            };
        }

        case "FREE_INVOKE_CONSUMED": {
            const aspect = state.aspects[payload.aspectId];
            if (!aspect) return state;
            return {
                ...state,
                aspects: {
                    ...state.aspects,
                    [payload.aspectId]: { ...aspect, freeInvokes: Math.max(0, aspect.freeInvokes - payload.amount) }
                }
            };
        }

        case "FREE_INVOKE_PRODUCED": {
            const aspect = state.aspects[payload.aspectId];
            if (!aspect) return state;
            return {
                ...state,
                aspects: {
                    ...state.aspects,
                    [payload.aspectId]: { ...aspect, freeInvokes: aspect.freeInvokes + payload.amount }
                }
            };
        }

        case "ZONE_CREATED":
            return {
                ...state,
                zones: {
                    ...state.zones,
                    [payload.id]: payload
                }
            };

        case "ZONE_LINKED":
            return {
                ...state,
                links: [...state.links, payload]
            };

        case "SCENE_CREATED":
            return {
                ...state,
                activeSceneId: payload.id // Auto-activate for MVP
            };

        case "CHALLENGE_UPDATED":
            return {
                ...state,
                challenge: {
                    isActive: payload.isActive,
                    text: payload.text,
                    difficulty: payload.difficulty,
                    aspects: payload.aspects || []
                }
            };

        case "TURN_ORDER_UPDATED": {
            const charIds = payload?.characterIds ?? [];
            const currentIdx = state.currentTurnIndex || 0;
            const currentActorId = (state.turnOrder && state.turnOrder[currentIdx]) ? state.turnOrder[currentIdx] : null;

            let newIdx = 0;
            if (currentActorId) {
                const foundIdx = charIds.indexOf(currentActorId);
                // If the current actor is still in the list, keep the turn with them
                if (foundIdx !== -1) {
                    newIdx = foundIdx;
                }
                // If not found (removed), we default to 0 (start of list), which is standard behavior
            }

            return {
                ...state,
                turnOrder: charIds,
                currentTurnIndex: newIdx,
                // If Turn Order is cleared (empty), reset round counter to 1 (or 0 if preferred, but 1 is start)
                currentRound: (charIds.length === 0) ? 1 : state.currentRound,
                lastTurnChangeTimestamp: event.createdAt // Reset timer on order change (usually implies new combat state)
            };
        }

        case "TURN_STEPPED": {
            const currentIdx = state.currentTurnIndex || 0;
            const nextIdx = payload.index;
            let nextRound = state.currentRound || 1;

            // Simple round increment check: if we restart at 0 from a non-zero, or just if next < current (wrap around)
            // But relying on index 0 is safer if we assume strict order
            if (nextIdx === 0 && (state.turnOrder?.length || 0) > 0) {
                nextRound++;
            }

            return {
                ...state,
                currentTurnIndex: nextIdx,
                currentRound: nextRound,
                timerPaused: false, // Auto-resume on new turn
                lastTurnChangeTimestamp: event.createdAt
            };
        }

        case "COMBAT_TARGET_SET":
            return {
                ...state,
                targetId: payload.targetId || (payload.targetIds?.[0]) || undefined,
                pendingTargetIds: payload.targetIds || [],
                damageType: payload.damageType || state.damageType,
                isReaction: payload.isReaction ?? !!(payload.targetId || payload.targetIds?.length)
            };

        case "COMBAT_REACTION_ENDED":
            return {
                ...state,
                isReaction: false,
                targetId: undefined,
                pendingTargetIds: [],
                damageType: undefined,
                timerPaused: false // Auto-resume on new turn
            };

        case "ROLL_RESOLVED": {
            // Handle sequential reaction advancing
            if (state.isReaction && payload.actionType === "DEFEND") {
                const remaining = (state.pendingTargetIds || []).filter(id => id !== payload.characterId);
                if (remaining.length > 0) {
                    return {
                        ...state,
                        targetId: remaining[0],
                        pendingTargetIds: remaining,
                        isReaction: true
                    };
                } else {
                    return {
                        ...state,
                        isReaction: false,
                        targetId: undefined,
                        pendingTargetIds: [],
                        timerPaused: false
                    };
                }
            }
            return state;
        }

        case "TIMER_PAUSED":
            return {
                ...state,
                timerPaused: true,
                timerPausedAt: payload.pausedAt
            };

        case "TIMER_RESUMED":
            return {
                ...state,
                timerPaused: false,
                timerPausedAt: undefined
            };



        case "TURN_FORCED_PASS":
            // Marker event, but crucial for timestamp tracking if handled explicitly here.
            // Actually, usually accompanies TURN_STEPPED. 
            // If used alone to force a re-render or logic check, we might want to update timestamp.
            return {
                ...state,
                lastTurnChangeTimestamp: event.createdAt
            };

        case "NOTE_ADDED":
            return {
                ...state,
                notes: [...(state.notes || []), payload]
            };

        case "NOTE_DELETED":
            return {
                ...state,
                notes: (state.notes || []).filter(n => n.id !== payload.noteId)
            };

        case "ALL_NOTES_DELETED":
            return {
                ...state,
                notes: []
            };

        case "SESSION_THEME_UPDATED":
            return {
                ...state,
                themeColor: payload.color || undefined
            };

        case "SESSION_THEME_PRESET_UPDATED":
            return {
                ...state,
                themePreset: payload.preset,
                themeColor: undefined
            };

        case "SESSION_SOUNDS_UPDATED":
            return {
                ...state,
                soundSettings: {
                    ...state.soundSettings,
                    ...payload
                }
            };

        case "MUSIC_PLAYBACK_CHANGED":
            if (payload.isTemporary) return state; // Don't save temporary tracks as "current" state
            return {
                ...state,
                currentMusic: {
                    url: payload.url,
                    loop: payload.loop,
                    playing: payload.playing
                }
            };

        case "ATMOSPHERIC_EFFECT_UPDATED":
            return {
                ...state,
                atmosphericEffect: payload.type
            };

        case "WORLD_ENTITY_CREATED": {
            const entity = payload;
            if (!entity?.id) return state;
            return {
                ...state,
                worldEntities: {
                    ...(state.worldEntities || {}),
                    [entity.id]: entity
                }
            };
        }

        case "WORLD_ENTITY_UPDATED": {
            const entity = (state.worldEntities || {})[payload.entityId];
            if (!entity) return state;
            return {
                ...state,
                worldEntities: {
                    ...state.worldEntities,
                    [payload.entityId]: { ...entity, ...payload.patch }
                }
            };
        }

        case "WORLD_ENTITY_DELETED": {
            const { [payload.entityId]: _, ...remainingEntities } = state.worldEntities || {};
            return {
                ...state,
                worldEntities: remainingEntities
            };
        }

        case "MISSION_CREATED":
            return {
                ...state,
                missions: [...(state.missions || []), payload]
            };

        case "MISSION_UPDATED": {
            const missions = state.missions || [];
            return {
                ...state,
                missions: missions.map(m => m.id === payload.missionId ? { ...m, ...payload.patch } : m)
            };
        }

        case "MISSION_DELETED": {
            return {
                ...state,
                missions: (state.missions || []).filter(m => m.id !== payload.missionId)
            };
        }

        case "TIMELINE_EVENT_CREATED":
            return {
                ...state,
                timeline: [...(state.timeline || []), payload]
            };

        case "TIMELINE_EVENT_UPDATED": {
            const timeline = state.timeline || [];
            return {
                ...state,
                timeline: timeline.map(e => e.id === payload.eventId ? { ...e, ...payload.patch } : e)
            };
        }

        case "TIMELINE_EVENT_DELETED": {
            return {
                ...state,
                timeline: (state.timeline || []).filter(e => e.id !== payload.eventId)
            };
        }

        case "GLOBAL_SKILL_CREATED":
            return { ...state, skills: [...(state.skills || []), payload] };
        case "GLOBAL_SKILL_UPDATED":
            return {
                ...state,
                skills: (state.skills || []).map(s => s.id === payload.skillId ? { ...s, ...payload.patch } : s)
            };
        case "GLOBAL_SKILL_DELETED":
            return { ...state, skills: (state.skills || []).filter(s => s.id !== payload.skillId) };

        case "GLOBAL_ITEM_CREATED":
            return { ...state, items: [...(state.items || []), payload] };
        case "GLOBAL_ITEM_UPDATED":
            return {
                ...state,
                items: (state.items || []).map(i => i.id === payload.itemId ? { ...i, ...payload.patch } : i)
            };
        case "GLOBAL_ITEM_DELETED":
            return { ...state, items: (state.items || []).filter(i => i.id !== payload.itemId) };

        case "WORLD_ENTITY_NOTE_ADDED": {
            const entities = state.worldEntities || {};
            const entity = entities[payload.entityId];
            if (!entity) return state;
            return {
                ...state,
                worldEntities: {
                    ...entities,
                    [payload.entityId]: {
                        ...entity,
                        linkedNotes: [...(entity.linkedNotes || []), payload.note]
                    }
                }
            };
        }

        case "WORLD_ENTITY_NOTE_DELETED": {
            const entities = state.worldEntities || {};
            const entity = entities[payload.entityId];
            if (!entity) return state;
            return {
                ...state,
                worldEntities: {
                    ...entities,
                    [payload.entityId]: {
                        ...entity,
                        linkedNotes: (entity.linkedNotes || []).filter(n => n.id !== payload.noteId)
                    }
                }
            };
        }

        case "MISSION_NOTE_ADDED": {
            const missions = state.missions || [];
            return {
                ...state,
                missions: missions.map(m => m.id === payload.missionId ? {
                    ...m,
                    linkedNotes: [...(m.linkedNotes || []), payload.note]
                } : m)
            };
        }

        case "MISSION_NOTE_DELETED": {
            const missions = state.missions || [];
            return {
                ...state,
                missions: missions.map(m => m.id === payload.missionId ? {
                    ...m,
                    linkedNotes: (m.linkedNotes || []).filter(n => n.id !== payload.noteId)
                } : m)
            };
        }

        case "TIMELINE_EVENT_NOTE_ADDED": {
            const timeline = state.timeline || [];
            return {
                ...state,
                timeline: timeline.map(e => e.id === payload.eventId ? {
                    ...e,
                    linkedNotes: [...(e.linkedNotes || []), payload.note]
                } : e)
            };
        }

        case "TIMELINE_EVENT_NOTE_DELETED": {
            const timeline = state.timeline || [];
            return {
                ...state,
                timeline: timeline.map(e => e.id === payload.eventId ? {
                    ...e,
                    linkedNotes: (e.linkedNotes || []).filter(n => n.id !== payload.noteId)
                } : e)
            };
        }

        case "GLOBAL_SKILL_NOTE_ADDED": {
            const skills = state.skills || [];
            return {
                ...state,
                skills: skills.map(s => s.id === payload.skillId ? {
                    ...s,
                    linkedNotes: [...(s.linkedNotes || []), payload.note]
                } : s)
            };
        }

        case "GLOBAL_SKILL_NOTE_DELETED": {
            const skills = state.skills || [];
            return {
                ...state,
                skills: skills.map(s => s.id === payload.skillId ? {
                    ...s,
                    linkedNotes: (s.linkedNotes || []).filter(n => n.id !== payload.noteId)
                } : s)
            };
        }

        case "GLOBAL_ITEM_NOTE_ADDED": {
            const items = state.items || [];
            return {
                ...state,
                items: items.map(i => i.id === payload.itemId ? {
                    ...i,
                    linkedNotes: [...(i.linkedNotes || []), payload.note]
                } : i)
            };
        }

        case "GLOBAL_ITEM_NOTE_DELETED": {
            const items = state.items || [];
            return {
                ...state,
                items: items.map(i => i.id === payload.itemId ? {
                    ...i,
                    linkedNotes: (i.linkedNotes || []).filter(n => n.id !== payload.noteId)
                } : i)
            };
        }

        case "STICKY_NOTE_CREATED":
            return {
                ...state,
                stickyNotes: [...(state.stickyNotes || []), { ...payload, ownerId: event.actorUserId }]
            };

        case "STICKY_NOTE_UPDATED": {
            return {
                ...state,
                stickyNotes: (state.stickyNotes || []).map(n => n.id === payload.id ? { ...n, ...payload.patch } : n)
            };
        }

        case "STICKY_NOTE_DELETED": {
            return {
                ...state,
                stickyNotes: (state.stickyNotes || []).filter(n => n.id !== payload.id)
            };
        }

        case "CHARACTER_NOTE_ADDED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        linkedNotes: [...(char.linkedNotes || []), payload.note]
                    }
                }
            };
        }

        case "CHARACTER_NOTE_DELETED": {
            const char = state.characters[payload.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [payload.characterId]: {
                        ...char,
                        linkedNotes: (char.linkedNotes || []).filter(n => n.id !== payload.noteId)
                    }
                }
            };
        }

        case "BATTLEMAP_UPDATED": {
            return {
                ...state,
                battlemap: {
                    ...(state.battlemap || {
                        isActive: false,
                        imageUrl: "",
                        gridSize: 50,
                        gridColor: "rgba(255,255,255,0.1)",
                        gridThickness: 1,
                        offsetX: 0,
                        offsetY: 0,
                        zoom: 1,
                        strokes: [],
                        objects: []
                    }),
                    ...payload
                }
            };
        }

        default:
            return state;
    }
}


export function computeState(events: ActionEvent[], baseState?: SessionState): SessionState {
  return events.reduce(reduce, baseState ?? initialState);
}

// Add a separate function only used when saving snapshot
export function sanitizeStateForSnapshot(state: SessionState): SessionState {
  const sanitizedCharacters: Record<string, any> = {};
  for (const [id, char] of Object.entries(state.characters || {})) {
    if ((char as any).imageUrl?.startsWith('data:')) {
      const { imageUrl, ...rest } = char as any;
      sanitizedCharacters[id] = rest;
    } else {
      sanitizedCharacters[id] = char;
    }
  }
  return { ...state, characters: sanitizedCharacters };
}
