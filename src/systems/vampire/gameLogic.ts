import type { Character } from "@/types/domain";
import type { VampireSystemData } from "./types";

export function getHungerSlotCapacity(slot: string): number {
  if (slot.includes("mild")) return 2;
  if (slot.includes("moderate")) return 4;
  if (slot.includes("severe")) return 6;
  if (slot.includes("extreme")) return 8;
  return 2;
}

export function isCharacterEliminated(character: Character): boolean {
  const sd = character.systemData as VampireSystemData | undefined;
  if (!sd) return false;

  const defaultSlots = ["mild", "moderate", "severe"];
  const removedNormal = sd.removedDefaultSlots ?? [];
  const removedHunger = sd.removedDefaultHungerSlots ?? [];

  const normalSlots = new Set<string>(
    defaultSlots.filter((s) => !removedNormal.includes(s))
  );
  (sd.extraConsequenceSlots ?? []).forEach((k) => normalSlots.add(k));
  Object.keys(sd.consequences ?? {}).forEach((k) => normalSlots.add(k));

  const hungerDefaultSlots = ["fome_mild", "fome_moderate", "fome_severe"];
  const hungerSlots = new Set<string>(
    hungerDefaultSlots.filter((s) => !removedHunger.includes(s))
  );
  (sd.extraHungerSlots ?? []).forEach((k) => hungerSlots.add(k));
  Object.keys(sd.hungerConsequences ?? {}).forEach((k) => hungerSlots.add(k));

  const allNormalFilled = Array.from(normalSlots).every((slot) => {
    const d = sd.consequences?.[slot];
    return d?.text && d.text.trim().length > 0;
  });

  const allHungerFilled = Array.from(hungerSlots).every((slot) => {
    const d = sd.hungerConsequences?.[slot];
    return d?.text && d.text.trim().length > 0;
  });

  return allNormalFilled && allHungerFilled;
}
