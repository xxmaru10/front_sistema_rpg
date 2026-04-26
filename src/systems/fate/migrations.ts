import type { Character } from "@/types/domain";
import { DEFAULT_SKILLS } from "./types";

/**
 * Migrates a legacy Fate character (fields at root level) to the new format
 * where Fate-specific data lives in systemData.
 * Idempotent: already-migrated characters are returned unchanged.
 */
export function migrateLegacyFateCharacter(char: Character): Character {
    const c = char as any;

    // Already migrated: systemData has the Fate fields
    if (
        c.systemData &&
        typeof c.systemData === "object" &&
        "fatePoints" in c.systemData
    ) {
        return char;
    }

    // Legacy character: Fate fields are at the root — migrate them to systemData
    const systemData: Record<string, unknown> = {
        fatePoints: c.fatePoints ?? 3,
        refresh: c.refresh ?? 3,
        stress: c.stress ?? { physical: [false, false], mental: [false, false] },
        stressValues: c.stressValues,
        consequences: c.consequences ?? {},
        skills: c.skills ?? DEFAULT_SKILLS.reduce((acc: Record<string, number>, sk: string) => ({ ...acc, [sk]: 0 }), {}),
        skillResources: c.skillResources,
        inventory: c.inventory ?? [],
        stunts: c.stunts ?? [],
        spells: c.spells ?? [],
        magicLevel: c.magicLevel ?? 0,
        sheetAspects: c.sheetAspects,
        removedDefaultSlots: c.removedDefaultSlots,
        extraConsequenceSlots: c.extraConsequenceSlots,
        biography: c.biography,
    };

    // Build generic Character with only platform fields + systemData
    const migrated: Character = {
        id: c.id,
        name: c.name,
        ownerUserId: c.ownerUserId,
        currentZoneId: c.currentZoneId,
        isNPC: c.isNPC,
        source: c.source,
        scope: c.scope,
        npcType: c.npcType,
        imageUrl: c.imageUrl,
        arenaPortraitFocus: c.arenaPortraitFocus,
        activeInArena: c.activeInArena,
        arenaSide: c.arenaSide,
        isHazard: c.isHazard,
        difficulty: c.difficulty,
        impulseArrows: c.impulseArrows,
        linkedNotes: c.linkedNotes,
        religionId: c.religionId,
        systemData,
        // Keep legacy root fields so existing code that reads them directly still works
        // during the transition period (story-64 removes them from domain.ts).
        fatePoints: c.fatePoints ?? 3,
        refresh: c.refresh,
        stress: c.stress ?? { physical: [false, false], mental: [false, false] },
        stressValues: c.stressValues,
        consequences: c.consequences ?? {},
        skills: c.skills ?? DEFAULT_SKILLS.reduce((acc: Record<string, number>, sk: string) => ({ ...acc, [sk]: 0 }), {}),
        skillResources: c.skillResources,
        inventory: c.inventory ?? [],
        stunts: c.stunts ?? [],
        spells: c.spells ?? [],
        magicLevel: c.magicLevel ?? 0,
        sheetAspects: c.sheetAspects,
        removedDefaultSlots: c.removedDefaultSlots,
        extraConsequenceSlots: c.extraConsequenceSlots,
        biography: c.biography,
    };

    return migrated;
}
