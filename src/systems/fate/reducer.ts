import type { ActionEvent, SessionState, Character } from "@/types/domain";
import type { StressTrackValues } from "./types";
import { DEFAULT_SKILLS } from "./types";
import { migrateLegacyFateCharacter } from "./migrations";

// ─── helpers (copied from projections.ts, Fate-only subset) ──────────────────

function clampStressValue(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, Math.min(1000, Math.trunc(value)));
}

function deriveStressValues(char: Character, track: "physical" | "mental"): number[] {
    const c = char as any;
    const fallback = (c.stress?.[track] || []).map((_: boolean, index: number) => index + 1);
    const existing = c.stressValues?.[track] || [];
    return fallback.map((baseValue: number, index: number) => clampStressValue(existing[index] ?? baseValue));
}

function normalizeCharacterStress(char: Character): Character {
    const c = char as any;
    const physical = deriveStressValues(char, "physical");
    const mental = deriveStressValues(char, "mental");
    return {
        ...char,
        impulseArrows: Math.max(0, Math.trunc(c.impulseArrows || 0)),
        stressValues: { physical, mental },
    } as any;
}

// ─── migrateAllCharacters ─────────────────────────────────────────────────────

function migrateAllCharacters(state: SessionState): SessionState {
    const chars = state.characters;
    const migrated: Record<string, Character> = {};
    let changed = false;
    for (const [id, char] of Object.entries(chars)) {
        const next = migrateLegacyFateCharacter(char);
        migrated[id] = next;
        if (next !== char) changed = true;
    }
    if (!changed) return state;
    return { ...state, characters: migrated };
}

// ─── reduceFate ──────────────────────────────────────────────────────────────

export function reduceFate(state: SessionState, event: ActionEvent): SessionState {
    // Migrate legacy characters on every event (idempotent after first pass)
    state = migrateAllCharacters(state);

    const { type, payload } = event;

    if (!payload) return state;

    switch (type) {
        case "CHARACTER_CREATED": {
            const p = payload as any;
            const createdCharacter = normalizeCharacterStress({
                ...p,
                activeInArena: p.activeInArena ?? false,
                fatePoints: p.fatePoints ?? 3,
                stress: p.stress ?? { physical: [false, false], mental: [false, false] },
                skills: p.skills ?? DEFAULT_SKILLS.reduce((acc: Record<string, number>, sk: string) => ({ ...acc, [sk]: 0 }), {}),
                consequences: p.consequences ?? {},
                inventory: p.inventory ?? [],
                stunts: p.stunts ?? [],
                spells: p.spells ?? [],
                magicLevel: p.magicLevel ?? 0,
                imageUrl: p.imageUrl,
                source: p.source ?? "active",
                systemData: p.systemData ?? {},
            });
            return {
                ...state,
                characters: { ...state.characters, [p.id]: createdCharacter }
            };
        }

        case "CHARACTER_MOVED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: { ...state.characters, [p.characterId]: { ...char, currentZoneId: p.toZoneId } }
            };
        }

        case "CHARACTER_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return {
                ...state,
                characters: { ...state.characters, [p.characterId]: normalizeCharacterStress({ ...char, ...p.changes }) }
            };
        }

        case "CHARACTER_DELETED": {
            const p = payload as any;
            const { [p.characterId]: _, ...remaining } = state.characters;
            return {
                ...state,
                characters: remaining,
                turnOrder: (state.turnOrder || []).filter(id => id !== p.characterId)
            };
        }

        case "CHARACTER_NAME_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, name: p.name } } };
        }

        case "CHARACTER_BIO_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, biography: p.biography } } };
        }

        case "CHARACTER_IMAGE_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, imageUrl: p.imageUrl } } };
        }

        case "CHARACTER_NOTE_ADDED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const notes = (char as any).linkedNotes || [];
            const idx = notes.findIndex((n: any) => n.id === p.note.id);
            const newNotes = idx === -1 ? [...notes, p.note] : notes.map((n: any, i: number) => i === idx ? { ...n, ...p.note } : n);
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, linkedNotes: newNotes } } };
        }

        case "CHARACTER_NOTE_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const notes = ((char as any).linkedNotes || []).map((n: any) => n.id === p.noteId ? { ...n, ...p.patch } : n);
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, linkedNotes: notes } } };
        }

        case "CHARACTER_NOTE_DELETED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const notes = ((char as any).linkedNotes || []).filter((n: any) => n.id !== p.noteId);
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, linkedNotes: notes } } };
        }

        case "FP_SPENT": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, fatePoints: Math.max(0, (c.fatePoints || 0) - p.amount) } } };
        }

        case "FP_GAINED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, fatePoints: (c.fatePoints || 0) + p.amount } } };
        }

        case "STRESS_MARKED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const track = p.track.toLowerCase() as "physical" | "mental";
            const newTrack = [...c.stress[track]];
            if (p.boxIndex >= 0 && p.boxIndex < newTrack.length) newTrack[p.boxIndex] = true;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, stress: { ...c.stress, [track]: newTrack } } } };
        }

        case "STRESS_CLEARED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const track = p.track.toLowerCase() as "physical" | "mental";
            const newTrack = [...c.stress[track]];
            if (p.boxIndex >= 0 && p.boxIndex < newTrack.length) newTrack[p.boxIndex] = false;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, stress: { ...c.stress, [track]: newTrack } } } };
        }

        case "STRESS_TRACK_EXPANDED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const track = p.track.toLowerCase() as "physical" | "mental";
            const currentValues = deriveStressValues(char, track);
            const nextDefault = currentValues.length + 1;
            const nextValue = clampStressValue(p.value ?? nextDefault);
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [p.characterId]: {
                        ...char,
                        stress: { ...c.stress, [track]: [...c.stress[track], false] },
                        stressValues: {
                            physical: track === "physical" ? [...currentValues, nextValue] : deriveStressValues(char, "physical"),
                            mental: track === "mental" ? [...currentValues, nextValue] : deriveStressValues(char, "mental"),
                        } as StressTrackValues,
                    }
                }
            };
        }

        case "STRESS_TRACK_REDUCED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const track = p.track.toLowerCase() as "physical" | "mental";
            const currentTrack = c.stress[track];
            if (currentTrack.length === 0) return state;
            const currentValues = deriveStressValues(char, track);
            const nextValues = currentValues.slice(0, -1);
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [p.characterId]: {
                        ...char,
                        stress: { ...c.stress, [track]: currentTrack.slice(0, -1) },
                        stressValues: {
                            physical: track === "physical" ? nextValues : deriveStressValues(char, "physical"),
                            mental: track === "mental" ? nextValues : deriveStressValues(char, "mental"),
                        } as StressTrackValues,
                    }
                }
            };
        }

        case "STRESS_BOX_VALUE_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const track = p.track.toLowerCase() as "physical" | "mental";
            const currentTrack = c.stress[track];
            if (p.boxIndex < 0 || p.boxIndex >= currentTrack.length) return state;
            const values = deriveStressValues(char, track);
            values[p.boxIndex] = clampStressValue(p.value);
            return {
                ...state,
                characters: {
                    ...state.characters,
                    [p.characterId]: {
                        ...char,
                        stressValues: {
                            physical: track === "physical" ? values : deriveStressValues(char, "physical"),
                            mental: track === "mental" ? values : deriveStressValues(char, "mental"),
                        } as StressTrackValues,
                    }
                }
            };
        }

        case "CHARACTER_CONSEQUENCE_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const nextConsequences = { ...(c.consequences || {}) };
            const isEmpty = !p.value || p.value.trim() === "";
            if (isEmpty) {
                delete nextConsequences[p.slot];
            } else {
                nextConsequences[p.slot] = { text: p.value || "", debuff: p.debuff };
            }
            const removedDefaultSlots = (c.removedDefaultSlots || []).filter((s: string) => s !== p.slot);
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, consequences: nextConsequences, removedDefaultSlots } } };
        }

        case "CHARACTER_CONSEQUENCE_SLOT_ADDED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const extraConsequenceSlots = [...(c.extraConsequenceSlots || [])];
            if (!extraConsequenceSlots.includes(p.slot)) extraConsequenceSlots.push(p.slot);
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, extraConsequenceSlots } } };
        }

        case "CHARACTER_CONSEQUENCE_DELETED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const newConsequences = { ...c.consequences };
            delete newConsequences[p.slot];
            const extraConsequenceSlots = (c.extraConsequenceSlots || []).filter((s: string) => s !== p.slot);
            const DEFAULT_CONSEQUENCE_SLOTS = ["mild", "mild2", "moderate", "severe"];
            const removedDefaultSlots = [...(c.removedDefaultSlots || [])];
            if (DEFAULT_CONSEQUENCE_SLOTS.includes(p.slot) && !removedDefaultSlots.includes(p.slot)) {
                removedDefaultSlots.push(p.slot);
            }
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, consequences: newConsequences, removedDefaultSlots, extraConsequenceSlots } } };
        }

        case "CHARACTER_REFRESH_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, refresh: p.refresh } } };
        }

        case "CHARACTER_SKILL_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, skills: { ...c.skills, [p.skill]: p.rank } } } };
        }

        case "SKILL_RESOURCE_INIT": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const resources = c.skillResources || {};
            if (resources[p.skill]) return state;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, skillResources: { ...resources, [p.skill]: { current: p.initialMax, max: p.initialMax } } } } };
        }

        case "SKILL_RESOURCE_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, skillResources: { ...(c.skillResources || {}), [p.skill]: { current: p.current, max: p.max } } } } };
        }

        case "CHARACTER_SHEET_ASPECT_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const newAspects = [...(c.sheetAspects || ["", "", "", ""])];
            newAspects[p.index] = p.value;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, sheetAspects: newAspects } } };
        }

        case "CHARACTER_STUNT_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const currentStunts = c.stunts || [];
            const stuntIndex = currentStunts.findIndex((s: any) => s.id === p.stunt.id);
            const newStunts = stuntIndex >= 0
                ? currentStunts.map((s: any, i: number) => i === stuntIndex ? p.stunt : s)
                : [...currentStunts, p.stunt];
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, stunts: newStunts } } };
        }

        case "CHARACTER_STUNT_DELETED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, stunts: (c.stunts || []).filter((s: any) => s.id !== p.stuntId) } } };
        }

        case "CHARACTER_SPELL_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const currentSpells = c.spells || [];
            const spellIndex = currentSpells.findIndex((s: any) => s.id === p.spell.id);
            const newSpells = spellIndex >= 0
                ? currentSpells.map((s: any, i: number) => i === spellIndex ? p.spell : s)
                : [...currentSpells, p.spell];
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, spells: newSpells } } };
        }

        case "CHARACTER_SPELL_DELETED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, spells: (c.spells || []).filter((s: any) => s.id !== p.spellId) } } };
        }

        case "CHARACTER_MAGIC_LEVEL_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, magicLevel: p.level } } };
        }

        case "CHARACTER_INVENTORY_UPDATED": {
            const p = payload as any;
            const char = state.characters[p.characterId];
            if (!char) return state;
            const c = char as any;
            const currentInventory = c.inventory || [];
            const itemIndex = currentInventory.findIndex((i: any) => i.id === p.item.id);
            const newInventory = itemIndex >= 0
                ? currentInventory.map((i: any, idx: number) => idx === itemIndex ? p.item : i)
                : [...currentInventory, p.item];
            return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, inventory: newInventory } } };
        }

        case "ASPECT_CREATED": {
            const p = payload as any;
            return {
                ...state,
                aspects: {
                    ...state.aspects,
                    [p.id]: {
                        id: p.id,
                        name: p.name,
                        scope: p.scope || "SCENE",
                        freeInvokes: p.freeInvokes || 0,
                        revealed: p.revealed ?? true,
                        ownerId: p.ownerId,
                        description: p.description,
                    }
                }
            };
        }

        case "ASPECT_UPDATED": {
            const p = payload as any;
            const aspect = state.aspects[p.aspectId];
            if (!aspect) return state;
            return { ...state, aspects: { ...state.aspects, [p.aspectId]: { ...aspect, ...p.patch } } };
        }

        case "ASPECT_REVEALED": {
            const p = payload as any;
            const aspect = state.aspects[p.aspectId];
            if (!aspect) return state;
            return { ...state, aspects: { ...state.aspects, [p.aspectId]: { ...aspect, revealed: true } } };
        }

        case "FREE_INVOKE_CONSUMED": {
            const p = payload as any;
            const aspect = state.aspects[p.aspectId];
            if (!aspect) return state;
            return { ...state, aspects: { ...state.aspects, [p.aspectId]: { ...aspect, freeInvokes: Math.max(0, aspect.freeInvokes - p.amount) } } };
        }

        case "FREE_INVOKE_PRODUCED": {
            const p = payload as any;
            const aspect = state.aspects[p.aspectId];
            if (!aspect) return state;
            return { ...state, aspects: { ...state.aspects, [p.aspectId]: { ...aspect, freeInvokes: aspect.freeInvokes + p.amount } } };
        }

        case "ROLL_RESOLVED": {
            const p = payload as any;
            if (state.isReaction && p.actionType === "DEFEND") {
                const remaining = (state.pendingTargetIds || []).filter((id: string) => id !== p.characterId);
                if (remaining.length > 0) {
                    return { ...state, targetId: remaining[0], pendingTargetIds: remaining, isReaction: true };
                } else {
                    return { ...state, isReaction: false, targetId: undefined, pendingTargetIds: [], timerPaused: false };
                }
            }
            return state;
        }

        case "ROLL_VISIBILITY_UPDATED": {
            const p = payload as any;
            return {
                ...state,
                rollVisibilityOverrides: {
                    ...(state.rollVisibilityOverrides || {}),
                    [p.rollEventId]: { hiddenForPlayers: p.hiddenForPlayers }
                }
            };
        }

        case "COMBAT_TARGET_SET": {
            const p = payload as any;
            return {
                ...state,
                targetId: p.targetId || (p.targetIds?.[0]) || undefined,
                pendingTargetIds: p.targetIds || [],
                damageType: p.damageType || state.damageType,
                isReaction: p.isReaction ?? !!(p.targetId || p.targetIds?.length)
            };
        }

        case "COMBAT_REACTION_ENDED":
            return { ...state, isReaction: false, targetId: undefined, pendingTargetIds: [], damageType: undefined, timerPaused: false };

        default:
            return state;
    }
}
