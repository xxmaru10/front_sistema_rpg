import type { Character } from "@/types/domain";

export function isCharacterEliminated(character: Character): boolean {
    if (!character) return false;

    const removedDefaults = (character as any).removedDefaultSlots || [];
    const defaultSlots = ["mild", "moderate", "severe"].filter((s: string) => !removedDefaults.includes(s));

    const allSlots = new Set<string>(defaultSlots);
    ((character as any).extraConsequenceSlots || []).forEach((s: string) => allSlots.add(s));
    Object.keys((character as any).consequences || {}).forEach((k: string) => allSlots.add(k));

    if (allSlots.size === 0) return false;

    return Array.from(allSlots).every(slot => {
        const cons = ((character as any).consequences as any)?.[slot];
        return cons && cons.text && cons.text.trim().length > 0;
    });
}

export type DamageAbsorptionResult = {
    stressToMarkIndices: number[];
    consequenceSlot?: string;
    remainingDamage: number;
    isOverwhelmed?: boolean;
};

export type AutomaticDamageSelection = {
    stressToMarkIndices: number[];
    consequenceSlots: string[];
    remainingDamage: number;
    absorbed: number;
};

type AutoDamageCandidate = {
    stressIndex?: number;
    stressAbsorbed: number;
    consequenceSlots: string[];
    absorbed: number;
    remaining: number;
    maxConsequenceCapacity: number;
    consequenceCapacitySum: number;
};

const FATE_CONSEQUENCE_ORDER = ["mild", "mild2", "moderate", "severe", "extreme"];

function getStressBoxValue(rawValue: number | undefined, index: number): number {
    return rawValue !== undefined ? Math.max(1, Math.trunc(rawValue)) : index + 1;
}

function buildAllConsequenceSubsets(slots: string[]): string[][] {
    const subsets: string[][] = [[]];
    slots.forEach((slot) => {
        const current = subsets.slice();
        current.forEach((subset) => {
            subsets.push([...subset, slot]);
        });
    });
    return subsets;
}

function compareAutoDamageCandidates(a: AutoDamageCandidate, b: AutoDamageCandidate): number {
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    if (a.maxConsequenceCapacity !== b.maxConsequenceCapacity) return a.maxConsequenceCapacity - b.maxConsequenceCapacity;
    if (a.consequenceCapacitySum !== b.consequenceCapacitySum) return a.consequenceCapacitySum - b.consequenceCapacitySum;
    if (a.stressAbsorbed !== b.stressAbsorbed) return a.stressAbsorbed - b.stressAbsorbed;
    if (a.consequenceSlots.length !== b.consequenceSlots.length) return a.consequenceSlots.length - b.consequenceSlots.length;
    const stressA = a.stressIndex === undefined ? Number.MAX_SAFE_INTEGER : a.stressIndex;
    const stressB = b.stressIndex === undefined ? Number.MAX_SAFE_INTEGER : b.stressIndex;
    return stressA - stressB;
}

export function getConsequenceSlotCapacity(slot: string): number {
    const capacities: Record<string, number> = {
        mild: 2,
        mild2: 2,
        moderate: 4,
        severe: 6,
        extreme: 8,
    };
    if (capacities[slot] !== undefined) return capacities[slot];
    const lower = slot.toLowerCase();
    if (lower.includes("mild") || lower.includes("leve")) return 2;
    if (lower.includes("moderate") || lower.includes("moderada")) return 4;
    if (lower.includes("severe") || lower.includes("severa")) return 6;
    if (lower.includes("extreme") || lower.includes("extrema")) return 8;
    return 2;
}

export function calculateAutomaticDamageSelection(
    character: Character,
    damage: number,
    track: "PHYSICAL" | "MENTAL"
): AutomaticDamageSelection {
    if (!Number.isFinite(damage) || damage <= 0) {
        return { stressToMarkIndices: [], consequenceSlots: [], remainingDamage: 0, absorbed: 0 };
    }

    const c = character as any;
    const stressTrack = track === "PHYSICAL" ? (c.stress?.physical || []) : (c.stress?.mental || []);
    const stressValues = track === "PHYSICAL" ? c.stressValues?.physical : c.stressValues?.mental;
    const availableStress = stressTrack
        .map((isMarked: boolean, index: number) => ({ index, isMarked, value: getStressBoxValue(stressValues?.[index], index) }))
        .filter((box: any) => !box.isMarked);

    const removedDefaults = new Set(c.removedDefaultSlots || []);
    const defaultSlots = ["mild", "moderate", "severe"].filter((slot) => !removedDefaults.has(slot));
    const allSlots = new Set<string>([
        ...defaultSlots,
        ...(c.extraConsequenceSlots || []),
        ...Object.keys(c.consequences || {}),
    ]);

    const availableConsequenceSlots = Array.from(allSlots)
        .filter((slot) => {
            const existing = c.consequences?.[slot];
            return !(existing?.text && existing.text.trim().length > 0);
        })
        .sort((a, b) => {
            const ia = FATE_CONSEQUENCE_ORDER.indexOf(a);
            const ib = FATE_CONSEQUENCE_ORDER.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return getConsequenceSlotCapacity(a) - getConsequenceSlotCapacity(b);
        });

    const consequenceSubsets = buildAllConsequenceSubsets(availableConsequenceSlots);
    const stressOptions: Array<{ index?: number; value: number }> = [
        { index: undefined, value: 0 },
        ...availableStress.map((box: any) => ({ index: box.index, value: box.value })),
    ];

    let bestCandidate: AutoDamageCandidate = {
        stressIndex: undefined,
        stressAbsorbed: 0,
        consequenceSlots: [],
        absorbed: 0,
        remaining: Math.max(0, damage),
        maxConsequenceCapacity: 0,
        consequenceCapacitySum: 0,
    };

    consequenceSubsets.forEach((subset) => {
        const consequenceCapacitySum = subset.reduce((sum, slot) => sum + getConsequenceSlotCapacity(slot), 0);
        const maxConsequenceCapacity = subset.length > 0
            ? Math.max(...subset.map((slot) => getConsequenceSlotCapacity(slot)))
            : 0;

        stressOptions.forEach((stressOption) => {
            const absorbed = consequenceCapacitySum + stressOption.value;
            const remaining = Math.max(0, damage - absorbed);
            const candidate: AutoDamageCandidate = {
                stressIndex: stressOption.index,
                stressAbsorbed: stressOption.value,
                consequenceSlots: subset,
                absorbed,
                remaining,
                maxConsequenceCapacity,
                consequenceCapacitySum,
            };
            if (compareAutoDamageCandidates(candidate, bestCandidate) < 0) {
                bestCandidate = candidate;
            }
        });
    });

    const stressToMarkIndices = bestCandidate.stressIndex !== undefined ? [bestCandidate.stressIndex] : [];
    return {
        stressToMarkIndices,
        consequenceSlots: bestCandidate.consequenceSlots,
        remainingDamage: bestCandidate.remaining,
        absorbed: bestCandidate.absorbed,
    };
}

export function calculateAbsorption(
    character: Character,
    damage: number,
    track: "PHYSICAL" | "MENTAL"
): DamageAbsorptionResult {
    const c = character as any;
    const stressBoxes = track === "PHYSICAL" ? (c.stress?.physical || []) : (c.stress?.mental || []);
    const stressValues = track === "PHYSICAL" ? c.stressValues?.physical : c.stressValues?.mental;
    const stressToMarkIndices: number[] = [];
    let currentDamage = damage;

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

    const capacities: Record<string, number> = { mild: 2, mild2: 2, moderate: 4, severe: 6, extreme: 8 };
    const slotsOrder = ["mild", "mild2", "moderate", "severe", "extreme"];
    const defaultSlots = ["mild", "moderate", "severe"];
    const consequenceKeys = Object.keys(c.consequences || {});
    const mergedKeys = new Set([...defaultSlots, ...consequenceKeys]);
    const characterSlots = Array.from(mergedKeys);

    const availableSlots = characterSlots.filter(slot => {
        const data = c.consequences?.[slot];
        return !data || !data.text || data.text.trim() === "";
    }).sort((a, b) => {
        const indexA = slotsOrder.indexOf(a);
        const indexB = slotsOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        const capA = capacities[a] || (a.toLowerCase().includes("mild") ? 2 : a.toLowerCase().includes("moderate") ? 4 : a.toLowerCase().includes("severe") ? 6 : 2);
        const capB = capacities[b] || (b.toLowerCase().includes("mild") ? 2 : b.toLowerCase().includes("moderate") ? 4 : b.toLowerCase().includes("severe") ? 6 : 2);
        return capA - capB;
    });

    let targetSlot = availableSlots.find(slot => {
        const cap = capacities[slot] || (slot.toLowerCase().includes("mild") ? 2 : slot.toLowerCase().includes("moderate") ? 4 : slot.toLowerCase().includes("severe") ? 6 : 2);
        return cap >= currentDamage;
    });

    let isOverwhelmed = false;
    if (currentDamage > 0 && !targetSlot && availableSlots.length > 0) {
        targetSlot = availableSlots[availableSlots.length - 1];
        isOverwhelmed = true;
    }

    return {
        stressToMarkIndices,
        consequenceSlot: targetSlot,
        remainingDamage: targetSlot ? 0 : currentDamage,
        isOverwhelmed
    };
}
