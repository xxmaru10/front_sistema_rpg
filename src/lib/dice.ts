import { ActionEvent, RollPayload } from "@/types/domain";
// Import UUID generator for unique event IDs
import { v4 as uuidv4 } from "uuid";

export async function fetchRandomFateDice(): Promise<number[]> {
    try {
        // Call internal API proxy to avoid CORS and ensure reliability
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/api/roll`, {
            signal: AbortSignal.timeout(5000) // 5s timeout
        });

        if (!response.ok) throw new Error("API Proxy responded with " + response.status);

        const data = await response.json();

        if (Array.isArray(data.dice) && data.dice.length === 4) {
            return data.dice;
        }

        throw new Error("Invalid format from API Proxy");
    } catch (error) {
        console.warn("API Roll failed, using local entropy:", error);
        return Array.from({ length: 4 }, () => Math.floor(Math.random() * 3) - 1);
    }
}

export function roll4dFLocal(): number[] {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 3) - 1);
}

export function createRollEvent(
    sessionId: string,
    actorUserId: string,
    characterId: string,
    modifier: number = 0,
    dice: number[], // Agora recebe os dados já rolados
    actionType?: RollPayload["actionType"],
    targetCharacterId?: string,
    note?: string,
    item?: { name: string; bonus: number },
    targetDiff?: number,
    skill?: { name: string; rank: number },
    manualBonus?: number,
    challengeDescription?: string,
    targetCharacterIds?: string[],
    damageType?: "PHYSICAL" | "MENTAL"
): ActionEvent {
    const diceSum = dice.reduce((a, b) => a + b, 0);
    const total = diceSum + modifier;

    return {
        id: uuidv4(),
        sessionId,
        seq: 0, // Should be assigned by server/GM in a real scenario
        type: "ROLL_RESOLVED",
        actorUserId,
        actorCharacterId: characterId,
        visibility: "PUBLIC",
        createdAt: new Date().toISOString(),
        payload: {
            characterId,
            dice,
            diceSum,
            modifier,
            manualBonus,
            skill,
            item,
            total,
            actionType,
            targetCharacterId,
            targetCharacterIds,
            damageType,
            note,
            targetDiff,
            challengeDescription
        } as RollPayload
    } as ActionEvent;
}
