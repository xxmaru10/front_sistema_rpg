import { Character } from "@/types/domain";

export function isCharacterEliminated(character: Character): boolean {
    if (!character) return false;

    // DEATH RULE: A character is ONLY eliminated when ALL available consequence slots are filled.
    // "Available" = default slots (mild/moderate/severe) minus explicitly removed ones,
    //               plus any extra slots created by the GM.
    const removedDefaults = character.removedDefaultSlots || [];
    const defaultSlots = ["mild", "moderate", "severe"].filter(s => !removedDefaults.includes(s));

    const allSlots = new Set<string>(defaultSlots);
    (character.extraConsequenceSlots || []).forEach(s => allSlots.add(s));
    // Include any filled slots not already in the above (edge-case safety)
    Object.keys(character.consequences || {}).forEach(k => allSlots.add(k));

    if (allSlots.size === 0) return false;

    // Eliminated only when EVERY slot has non-empty text
    return Array.from(allSlots).every(slot => {
        const cons = (character.consequences as any)[slot];
        return cons && cons.text && cons.text.trim().length > 0;
    });
}

export type DamageAbsorptionResult = {
    stressToMarkIndices: number[];
    consequenceSlot?: string;
    remainingDamage: number;
    isOverwhelmed?: boolean;
};

export function calculateAbsorption(
    character: Character,
    damage: number,
    track: "PHYSICAL" | "MENTAL"
): DamageAbsorptionResult {
    const stressBoxes = track === "PHYSICAL" ? character.stress.physical : character.stress.mental;
    const stressValues = track === "PHYSICAL" ? character.stressValues?.physical : character.stressValues?.mental;
    const stressToMarkIndices: number[] = [];
    let currentDamage = damage;

    // 1. Fill Stress Boxes using their configured capacity.
    // Legacy fallback (without stressValues): each box absorbs 1.
    for (let i = 0; i < stressBoxes.length && currentDamage > 0; i++) {
        if (!stressBoxes[i]) {
            stressToMarkIndices.push(i);
            const boxValueRaw = stressValues?.[i] ?? 1;
            const boxValue = Math.max(1, Math.min(1000, Math.trunc(boxValueRaw)));
            currentDamage -= boxValue;
        }
    }

    if (currentDamage <= 0) {
        return { stressToMarkIndices, remainingDamage: 0 };
    }

    // 2. Consequence Overflow
    // Capacities according to standard Fate (Mild=2, Moderate=4, Severe=6)
    const capacities: Record<string, number> = {
        mild: 2,
        mild2: 2,
        moderate: 4,
        severe: 6,
        extreme: 8
    };

    // Preferred check order
    const slotsOrder = ["mild", "mild2", "moderate", "severe", "extreme"];
    // Inclui slots padrão mesmo que consequences esteja vazio (igual ao DamageResolutionModal)
    const defaultSlots = ["mild", "moderate", "severe"];
    const consequenceKeys = Object.keys(character.consequences || {});
    const mergedKeys = new Set([...defaultSlots, ...consequenceKeys]);
    const characterSlots = Array.from(mergedKeys);

    const availableSlots = characterSlots.filter(slot => {
        const data = character.consequences[slot];
        return !data || !data.text || data.text.trim() === "";
    }).sort((a, b) => {
        // Sort by defined order or capacity
        const indexA = slotsOrder.indexOf(a);
        const indexB = slotsOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        // Fallback: try to guess capacity from name
        const capA = capacities[a] || (a.toLowerCase().includes("mild") ? 2 : a.toLowerCase().includes("moderate") ? 4 : a.toLowerCase().includes("severe") ? 6 : 2);
        const capB = capacities[b] || (b.toLowerCase().includes("mild") ? 2 : b.toLowerCase().includes("moderate") ? 4 : b.toLowerCase().includes("severe") ? 6 : 2);
        return capA - capB;
    });

    // Find the first slot that can handle the ENTIRE remaining damage
    let targetSlot = availableSlots.find(slot => {
        const cap = capacities[slot] || (slot.toLowerCase().includes("mild") ? 2 : slot.toLowerCase().includes("moderate") ? 4 : slot.toLowerCase().includes("severe") ? 6 : 2);
        return cap >= currentDamage;
    });

    let isOverwhelmed = false;

    // If damage remains but NO slot can handle it ALL, but we HAVE available slots
    if (currentDamage > 0 && !targetSlot && availableSlots.length > 0) {
        // In Fate, you can still take a consequence to REDUCE damage, 
        // even if it doesn't cover all of it.
        // We suggest the largest available slot to the GM.
        targetSlot = availableSlots[availableSlots.length - 1];
        isOverwhelmed = true;
    }

    return {
        stressToMarkIndices,
        consequenceSlot: targetSlot,
        remainingDamage: targetSlot ? 0 : currentDamage, // If slot accepted, we assume GM will handle it
        isOverwhelmed
    };
}
