import { v4 as uuidv4 } from "uuid";
import { globalEventStore } from "@/lib/eventStore";
import { AtmosphericEffectType } from "@/components/AtmosphericEffects";
import { Character } from "@/types/domain";
import { ScreenShareManager } from "@/lib/screen-share-manager";
import { RefObject } from "react";

interface SessionActionsParams {
    sessionId: string;
    actorUserId: string;
    userRole: "GM" | "PLAYER";
    state: any;
    activeTab: string;
    summonMode: "HERO" | "THREAT";
    characterList: Character[];
    setChallengeMode: (v: boolean) => void;
    setShowSummonModal: (v: boolean) => void;
    setSpectatorMode: (updater: boolean | ((prev: boolean) => boolean)) => void;
    screenShareManagerRef: RefObject<ScreenShareManager | null>;
}

export function useSessionActions({
    sessionId,
    actorUserId,
    userRole,
    state,
    activeTab,
    summonMode,
    characterList,
    setChallengeMode,
    setShowSummonModal,
    setSpectatorMode,
    screenShareManagerRef,
}: SessionActionsParams) {
    const normalizedUserId = actorUserId.trim().toLowerCase();

    const handleChallengeUpdate = (changes: {
        isActive?: boolean;
        text?: string;
        difficulty?: number;
        aspects?: string[];
    }) => {
        const current = state.challenge || { isActive: false, text: "", difficulty: 0, aspects: ["", "", ""] };
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHALLENGE_UPDATED",
            actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: {
                isActive: changes.isActive ?? current.isActive,
                text: changes.text ?? current.text,
                difficulty: changes.difficulty ?? current.difficulty,
                aspects: changes.aspects ?? current.aspects ?? ["", "", ""]
            }
        } as any);

        if (changes.isActive !== undefined) {
            setChallengeMode(changes.isActive);
        }
    };

    const handleMove = (characterId: string, toZoneId: string) => {
        globalEventStore.append({
            id: crypto.randomUUID(), sessionId, seq: 0, type: "CHARACTER_MOVED",
            actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId, toZoneId }
        } as any);
    };

    const handleHeaderUpdate = (url: string) => {
        if (url === "BATTLEMAP_ACTIVATE") {
            globalEventStore.append({
                id: crypto.randomUUID(), sessionId, seq: 0, type: "BATTLEMAP_UPDATED",
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { isActive: true }
            } as any);
            return;
        }
        globalEventStore.append({
            id: crypto.randomUUID(), sessionId, seq: 0, type: "SESSION_HEADER_UPDATED",
            actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { tab: activeTab, imageUrl: url }
        } as any);
    };

    const handleAtmosphericEffectChange = (type: AtmosphericEffectType) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "ATMOSPHERIC_EFFECT_UPDATED",
            actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { type }
        } as any);

        let soundTrack = "";
        switch (type) {
            case "rain":
            case "acid_rain":
            case "blood_rain":
                soundTrack = "chuva.mp3"; break;
            case "leaves_green":
            case "leaves_orange":
                soundTrack = "floresta.mp3"; break;
            case "sparks":
                soundTrack = "lareira.mp3"; break;
            case "inferno":
                soundTrack = "incendio.mp3"; break;
            case "snow":
            case "blizzard":
                soundTrack = "vento_neve.mp3"; break;
        }

        if (soundTrack) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "ATMOSPHERIC_PLAYBACK_CHANGED" as any,
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { url: `Atmosferico/${soundTrack}`, playing: true, loop: true }
            } as any);
        } else if (type === "none") {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "ATMOSPHERIC_PLAYBACK_CHANGED" as any,
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { url: "", playing: false, loop: false }
            } as any);
        }
    };

    const handleSummon = async (
        originalCharId: string | null,
        shouldClone: boolean,
        hazardData?: { name: string; difficulty: number }
    ) => {
        // Logic 0: Create a Hazard/Challenge card
        if (hazardData) {
            const hazardId = uuidv4();
            await globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CREATED",
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: {
                    id: hazardId, name: hazardData.name, isHazard: true,
                    difficulty: hazardData.difficulty, activeInArena: true,
                    arenaSide: "THREAT", isNPC: true, ownerUserId: normalizedUserId,
                    source: "active", fatePoints: 0,
                    stress: { physical: [], mental: [] }, skills: {},
                    stressValues: { physical: [], mental: [] },
                    inventory: [], stunts: [], spells: [], consequences: {},
                    magicLevel: 0, sheetAspects: ["", "", "", ""]
                }
            } as any);
            setShowSummonModal(false);

            if (state.turnOrder && state.turnOrder.length > 0 && userRole === "GM") {
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                    actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: { characterIds: [...state.turnOrder, hazardId] }
                } as any);
            }
            return;
        }

        if (!originalCharId) return;
        const originalChar = characterList.find(c => c.id === originalCharId);
        if (!originalChar) return;

        // Logic 1: Move/activate existing character (no clone)
        if (!shouldClone || (!originalChar.isNPC && summonMode === "HERO")) {
            await globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_UPDATED",
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: {
                    characterId: originalChar.id,
                    changes: { activeInArena: true, arenaSide: summonMode, source: "active" }
                }
            } as any);
            setShowSummonModal(false);

            if (state.turnOrder && state.turnOrder.length > 0 && userRole === "GM") {
                if (!state.turnOrder.includes(originalChar.id)) {
                    globalEventStore.append({
                        id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                        actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                        payload: { characterIds: [...state.turnOrder, originalChar.id] }
                    } as any);
                }
            }
            return;
        }

        // Logic 2: Clone the character (spawning minions / generic NPCs)
        const newCharId = uuidv4();
        const clonedStunts = originalChar.stunts.map((s: any) => ({ ...s, id: uuidv4() }));
        const clonedInventory = originalChar.inventory.map((i: any) => ({ ...i, id: uuidv4() }));
        const clonedSpells = originalChar.spells?.map((s: any) => ({ ...s, id: uuidv4() })) || [];
        const stress = {
            physical: new Array(originalChar.stress.physical.length).fill(false),
            mental: new Array(originalChar.stress.mental.length).fill(false)
        };
        const stressValues = {
            physical: stress.physical.map((_: boolean, index: number) => Math.max(1, Math.min(1000, Math.trunc(originalChar.stressValues?.physical?.[index] ?? (index + 1))))),
            mental: stress.mental.map((_: boolean, index: number) => Math.max(1, Math.min(1000, Math.trunc(originalChar.stressValues?.mental?.[index] ?? (index + 1))))),
        };
        const consequences = { mild: { text: "" }, moderate: { text: "" }, severe: { text: "" } };

        await globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CREATED",
            actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: {
                ...originalChar, id: newCharId, name: originalChar.name,
                stunts: clonedStunts, inventory: clonedInventory, spells: clonedSpells,
                stress, stressValues, consequences, source: "active", isNPC: true,
                activeInArena: true, arenaSide: summonMode
            }
        } as any);
        setShowSummonModal(false);

        if (state.turnOrder && state.turnOrder.length > 0 && userRole === "GM") {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterIds: [...state.turnOrder, newCharId] }
            } as any);
        }
    };

    const handleRemoveCharacter = (characterId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_UPDATED",
            actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId, changes: { activeInArena: false } }
        } as any);

        if (state.turnOrder && state.turnOrder.includes(characterId)) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                actorUserId: normalizedUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterIds: state.turnOrder.filter((id: string) => id !== characterId) }
            } as any);
        }
    };

    const handleStartScreenShare = async () => {
        if (screenShareManagerRef.current) {
            await screenShareManagerRef.current.startSharing();
        }
    };

    const handleStopScreenShare = () => {
        if (screenShareManagerRef.current) {
            screenShareManagerRef.current.stopSharing();
        }
        setSpectatorMode(false);
    };

    return {
        handleChallengeUpdate,
        handleMove,
        handleHeaderUpdate,
        handleAtmosphericEffectChange,
        handleSummon,
        handleRemoveCharacter,
        handleStartScreenShare,
        handleStopScreenShare,
    };
}
