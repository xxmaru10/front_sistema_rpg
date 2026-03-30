import { Character } from "@/types/domain";

export function isCharacterEliminated(character: Character): boolean {
    if (!character) return false;

    // DEATH RULE: A character is ONLY eliminated when ALL consequence slots are filled.
    // Physical and Mental stress do NOT count for death - only consequences.

    // Get all consequence keys (mild, moderate, severe + any extras)
    const allConsequenceKeys = Object.keys(character.consequences);

    // If the character has no consequence slots defined, they cannot be eliminated by consequences.
    // INSTEAD, they are eliminated if their Physical OR Mental stress track is fully filled.
    if (allConsequenceKeys.length === 0) {
        const physicalTotal = character.stress.physical.length;
        const physicalMarked = character.stress.physical.filter(Boolean).length;
        const physicalFull = physicalTotal > 0 && physicalMarked === physicalTotal;

        const mentalTotal = character.stress.mental.length;
        const mentalMarked = character.stress.mental.filter(Boolean).length;
        const mentalFull = mentalTotal > 0 && mentalMarked === mentalTotal;

        if (physicalFull || mentalFull) return true;
        return false;
    }

    // Check if ALL consequence slots have text (are filled)
    const allConsequencesFilled = allConsequenceKeys.every(key => {
        const cons = character.consequences[key];
        return cons && cons.text && cons.text.trim().length > 0;
    });

    return allConsequencesFilled;
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
    const stressToMarkIndices: number[] = [];
    let currentDamage = damage;

    // 1. Fill Stress Boxes (Summing logic: 1 point per box)
    for (let i = 0; i < stressBoxes.length && currentDamage > 0; i++) {
        if (!stressBoxes[i]) {
            stressToMarkIndices.push(i);
            currentDamage--;
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
    const characterSlots = Object.keys(character.consequences);

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
