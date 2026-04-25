import type { ActionEvent, SessionState, Character } from "@/types/domain";
import type { VampireCharacter, VampireSystemData, Discipline } from "./types";
import { migrateLegacyVampireCharacter } from "./migrations";
import { createVampireCharacter } from "./characterTemplate";
import { VAMPIRE_SKILLS } from "./utils";

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampStress(v: number) {
  return clamp(Math.trunc(v || 1), 1, 1000);
}

function sd(char: Character): VampireSystemData {
  return (char as VampireCharacter).systemData;
}

function patchSd(
  state: SessionState,
  characterId: string,
  patch: (data: VampireSystemData) => Partial<VampireSystemData>
): SessionState {
  const char = state.characters[characterId];
  if (!char) return state;
  const data = sd(char);
  const next: VampireSystemData = { ...data, ...patch(data) };
  const nextChar: VampireCharacter = { ...char, systemData: next } as VampireCharacter;
  return { ...state, characters: { ...state.characters, [characterId]: nextChar } };
}

function migrateAll(state: SessionState): SessionState {
  const chars = state.characters;
  const migrated: Record<string, Character> = {};
  let changed = false;
  for (const [id, char] of Object.entries(chars)) {
    const next = migrateLegacyVampireCharacter(char);
    migrated[id] = next;
    if (next !== char) changed = true;
  }
  if (!changed) return state;
  return { ...state, characters: migrated };
}

export function reduceVampire(state: SessionState, event: ActionEvent): SessionState {
  state = migrateAll(state);

  const { type, payload } = event;
  if (!payload) return state;
  const p = payload as any;

  switch (type) {
    // ── Character lifecycle ───────────────────────────────────────────────────
    case "CHARACTER_CREATED": {
      // The generic CharacterCreator emits a Fate-shaped payload (Fate skills,
      // 2-track stress, mild/moderate/severe consequences). For the vampire
      // system we throw away that Fate shape and rebuild the character from
      // the vampire template, preserving only identity/role fields and any
      // explicit overrides the caller actually intended (e.g. NPC presets that
      // already supplied vampire-shaped data via systemData).
      const callerProvidedSystemData = p.systemData && typeof p.systemData === "object" && Object.keys(p.systemData).length > 0;
      const overrides: Partial<Character> = {
        id: p.id,
        name: p.name ?? "Novo Vampiro",
        ownerUserId: p.ownerUserId ?? "",
        isNPC: p.isNPC ?? false,
        npcType: p.npcType,
        religionId: p.religionId,
        source: p.source ?? "active",
        scope: p.scope,
        activeInArena: p.activeInArena ?? false,
      } as Partial<Character>;
      let char = createVampireCharacter(overrides);
      
      // Preserve blinkmotion credentials if provided
      if (p.blinkmotion) {
        char.systemData.blinkmotion = p.blinkmotion;
      }

      // If a caller explicitly provided vampire-shaped systemData (e.g. import
      // flow), respect it via the migration path.
      if (callerProvidedSystemData) {
        char = migrateLegacyVampireCharacter({ ...char, ...p } as Character) as VampireCharacter;
      }
      return { ...state, characters: { ...state.characters, [p.id]: char } };
    }

    case "CHARACTER_DELETED": {
      const next = { ...state.characters };
      delete next[p.characterId];
      return { ...state, characters: next };
    }

    case "CHARACTER_MOVED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [p.characterId]: { ...char, currentZoneId: p.zoneId, activeInArena: p.zoneId != null },
        },
      };
    }

    case "CHARACTER_UPDATED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      return {
        ...state,
        characters: { ...state.characters, [p.characterId]: { ...char, ...p.changes } },
      };
    }

    case "CHARACTER_NAME_UPDATED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, name: p.name } } };
    }

    case "CHARACTER_BIO_UPDATED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, biography: p.biography } } };
    }

    case "CHARACTER_IMAGE_UPDATED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, imageUrl: p.imageUrl } } };
    }

    case "CHARACTER_SHEET_ASPECT_UPDATED": {
      return patchSd(state, p.characterId, (data) => {
        const aspects = [...(data.sheetAspects ?? ["", "", "", ""])];
        aspects[p.index] = p.value;
        return { sheetAspects: aspects };
      });
    }

    case "CHARACTER_REFRESH_UPDATED": {
      return patchSd(state, p.characterId, (data) => ({
        refresh: Math.max(1, p.refresh ?? data.refresh),
      }));
    }

    // ── FP ───────────────────────────────────────────────────────────────────
    case "FP_GAINED": {
      return patchSd(state, p.characterId, (data) => ({
        fatePoints: (data.fatePoints ?? 0) + (p.amount ?? 1),
      }));
    }
    case "FP_SPENT": {
      return patchSd(state, p.characterId, (data) => ({
        fatePoints: Math.max(0, (data.fatePoints ?? 0) - (p.amount ?? 1)),
      }));
    }

    // ── Skills ───────────────────────────────────────────────────────────────
    case "CHARACTER_SKILL_UPDATED": {
      // Keep both systemData.skills AND the flat character.skills in sync so that
      // generic components (SkillsSection) that read the flat field stay current.
      const char = state.characters[p.characterId];
      if (!char) return state;
      const data = sd(char);
      if (!data) return state; // defensive: migrateAll should ensure this never trips
      const newSkills = { ...(data.skills ?? {}), [p.skill]: p.rank };
      const nextData: VampireSystemData = { ...data, skills: newSkills };
      const nextChar: VampireCharacter = { ...char, systemData: nextData, skills: newSkills } as VampireCharacter;
      return { ...state, characters: { ...state.characters, [p.characterId]: nextChar } };
    }

    case "SKILL_RESOURCE_INIT": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      const existing = (char as any).skillResources ?? {};
      if (existing[p.skill]) return state;
      return {
        ...state,
        characters: {
          ...state.characters,
          [p.characterId]: { ...char, skillResources: { ...existing, [p.skill]: { current: p.initialMax, max: p.initialMax } } },
        },
      };
    }

    case "SKILL_RESOURCE_UPDATED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      const existing = (char as any).skillResources ?? {};
      return {
        ...state,
        characters: {
          ...state.characters,
          [p.characterId]: { ...char, skillResources: { ...existing, [p.skill]: { current: p.current, max: p.max } } },
        },
      };
    }

    // ── Stress (PHYSICAL, MENTAL, BLOOD) ──────────────────────────────────────
    case "STRESS_MARKED": {
      const track = (p.track as string).toLowerCase() as "blood";
      return patchSd(state, p.characterId, (data) => {
        const boxes = [...(data.stress[track] ?? [])];
        boxes[p.boxIndex] = true;
        return { stress: { ...data.stress, [track]: boxes } };
      });
    }

    case "STRESS_CLEARED": {
      const track = (p.track as string).toLowerCase() as "blood";
      return patchSd(state, p.characterId, (data) => {
        const boxes = [...(data.stress[track] ?? [])];
        boxes[p.boxIndex] = false;
        return { stress: { ...data.stress, [track]: boxes } };
      });
    }

    case "STRESS_TRACK_EXPANDED": {
      const track = (p.track as string).toLowerCase() as "blood";
      return patchSd(state, p.characterId, (data) => {
        const boxes = [...(data.stress[track] ?? []), false];
        const values = [...(data.stressValues[track] ?? []), clampStress(p.value ?? 1)];
        return {
          stress: { ...data.stress, [track]: boxes },
          stressValues: { ...data.stressValues, [track]: values },
        };
      });
    }

    case "STRESS_TRACK_REDUCED": {
      const track = (p.track as string).toLowerCase() as "blood";
      return patchSd(state, p.characterId, (data) => {
        const boxes = (data.stress[track] ?? []).slice(0, -1);
        const values = (data.stressValues[track] ?? []).slice(0, -1);
        return {
          stress: { ...data.stress, [track]: boxes },
          stressValues: { ...data.stressValues, [track]: values },
        };
      });
    }

    case "STRESS_BOX_VALUE_UPDATED": {
      const track = (p.track as string).toLowerCase() as "blood";
      return patchSd(state, p.characterId, (data) => {
        const values = [...(data.stressValues[track] ?? [])];
        values[p.boxIndex] = clampStress(p.value);
        return { stressValues: { ...data.stressValues, [track]: values } };
      });
    }

    // ── Normal consequences ──────────────────────────────────────────────────
    case "CHARACTER_CONSEQUENCE_UPDATED": {
      return patchSd(state, p.characterId, (data) => ({
        consequences: {
          ...data.consequences,
          [p.slot]: { text: p.value, debuff: p.debuff },
        },
      }));
    }

    case "CHARACTER_CONSEQUENCE_DELETED": {
      return patchSd(state, p.characterId, (data) => {
        const defaultSlots = ["mild", "moderate", "severe"];
        const isDefault = defaultSlots.includes(p.slot);
        if (isDefault) {
          const removed = [...(data.removedDefaultSlots ?? [])];
          if (!removed.includes(p.slot)) removed.push(p.slot);
          const cons = { ...data.consequences };
          delete cons[p.slot];
          return { consequences: cons, removedDefaultSlots: removed };
        }
        const extra = (data.extraConsequenceSlots ?? []).filter((s: string) => s !== p.slot);
        const cons = { ...data.consequences };
        delete cons[p.slot];
        return { consequences: cons, extraConsequenceSlots: extra };
      });
    }

    case "CHARACTER_CONSEQUENCE_SLOT_ADDED": {
      return patchSd(state, p.characterId, (data) => ({
        extraConsequenceSlots: [...(data.extraConsequenceSlots ?? []), p.slot],
      }));
    }

    // ── Hunger consequences ──────────────────────────────────────────────────
    case "VAMPIRE_HUNGER_CONSEQUENCE_UPDATED": {
      return patchSd(state, p.characterId, (data) => ({
        hungerConsequences: {
          ...data.hungerConsequences,
          [p.slot]: { text: p.value, debuff: p.debuff },
        },
      }));
    }

    case "VAMPIRE_HUNGER_CONSEQUENCE_DELETED": {
      return patchSd(state, p.characterId, (data) => {
        const defaultSlots = ["fome_mild", "fome_moderate", "fome_severe"];
        const isDefault = defaultSlots.includes(p.slot);
        if (isDefault) {
          const removed = [...(data.removedDefaultHungerSlots ?? [])];
          if (!removed.includes(p.slot)) removed.push(p.slot);
          const cons = { ...data.hungerConsequences };
          delete cons[p.slot];
          return { hungerConsequences: cons, removedDefaultHungerSlots: removed };
        }
        const extra = (data.extraHungerSlots ?? []).filter((s: string) => s !== p.slot);
        const cons = { ...data.hungerConsequences };
        delete cons[p.slot];
        return { hungerConsequences: cons, extraHungerSlots: extra };
      });
    }

    case "VAMPIRE_HUNGER_CONSEQUENCE_SLOT_ADDED": {
      return patchSd(state, p.characterId, (data) => ({
        extraHungerSlots: [...(data.extraHungerSlots ?? []), p.slot],
      }));
    }

    // ── Generation ───────────────────────────────────────────────────────────
    case "VAMPIRE_GENERATION_UPDATED": {
      return patchSd(state, p.characterId, (data) => ({
        generation: clamp(p.generation, 1, 13),
      }));
    }

    // ── Disciplines ──────────────────────────────────────────────────────────
    case "VAMPIRE_DISCIPLINE_UPDATED": {
      return patchSd(state, p.characterId, (data) => {
        const disc: Discipline = p.discipline;
        const existing = data.disciplines ?? [];
        const idx = existing.findIndex((d) => d.id === disc.id);
        const next = idx >= 0
          ? existing.map((d) => (d.id === disc.id ? disc : d))
          : [...existing, disc];
        return { disciplines: next };
      });
    }

    case "VAMPIRE_DISCIPLINE_DELETED": {
      return patchSd(state, p.characterId, (data) => ({
        disciplines: (data.disciplines ?? []).filter((d) => d.id !== p.disciplineId),
      }));
    }

    // ── Stunts ───────────────────────────────────────────────────────────────
    case "CHARACTER_STUNT_UPDATED": {
      return patchSd(state, p.characterId, (data) => {
        const stunts = data.stunts ?? [];
        const idx = stunts.findIndex((s) => s.id === p.stunt.id);
        const next = idx >= 0
          ? stunts.map((s) => (s.id === p.stunt.id ? p.stunt : s))
          : [...stunts, p.stunt];
        return { stunts: next };
      });
    }

    case "CHARACTER_STUNT_DELETED": {
      return patchSd(state, p.characterId, (data) => ({
        stunts: (data.stunts ?? []).filter((s) => s.id !== p.stuntId),
      }));
    }

    // ── Inventory ─────────────────────────────────────────────────────────────
    case "CHARACTER_INVENTORY_UPDATED": {
      return patchSd(state, p.characterId, (data) => {
        const inv = data.inventory ?? [];
        const idx = inv.findIndex((i) => i.id === p.item.id);
        const next = idx >= 0
          ? inv.map((i) => (i.id === p.item.id ? p.item : i))
          : [...inv, p.item];
        return { inventory: next };
      });
    }



    // ── Notes ─────────────────────────────────────────────────────────────────
    case "CHARACTER_NOTE_ADDED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      const notes = (char as any).notes ?? [];
      return {
        ...state,
        characters: { ...state.characters, [p.characterId]: { ...char, notes: [...notes, p.note] } },
      };
    }

    case "CHARACTER_NOTE_DELETED": {
      const char = state.characters[p.characterId];
      if (!char) return state;
      const notes = ((char as any).notes ?? []).filter((n: any) => n.id !== p.noteId);
      return { ...state, characters: { ...state.characters, [p.characterId]: { ...char, notes } } };
    }

    // ── Zone / Session-level ──────────────────────────────────────────────────
    case "ZONE_CREATED": {
      return { ...state, zones: { ...state.zones, [p.id]: { id: p.id, name: p.name, position: p.position, size: p.size, color: p.color, characterIds: [] } } };
    }


    default:
      return state;
  }
}
