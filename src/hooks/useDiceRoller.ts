"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";

import { v4 as uuidv4 } from "uuid";
import { createRollEvent } from "@/lib/dice";
import { globalEventStore } from "@/lib/eventStore";
import { diceSimulationStore } from "@/lib/diceSimulationStore";
import { Character, DEFAULT_SKILLS, DiceBreakdownEntry } from "@/types/domain";
import { isCharacterEliminated } from "@/lib/gameLogic";

interface UseDiceRollerProps {
    sessionId: string;
    actorUserId: string;
    characters: Character[];
    fixedCharacterId?: string;
    targetDiff?: number;
    challengeDescription?: string;
    disabled?: boolean;
    isGM?: boolean;
    stateTargetId?: string;
    isReaction?: boolean;
    lastAttackTotal?: number;
    stateDamageType?: "PHYSICAL" | "MENTAL";
    soundSettings?: {
        dice?: string;
    };
    currentTurnActorId?: string | null;
}

type ActionType = "ATTACK" | "DEFEND" | "OVERCOME" | "CREATE_ADVANTAGE";

export function useDiceRoller({ 
    sessionId, 
    actorUserId, 
    characters, 
    fixedCharacterId, 
    targetDiff, 
    challengeDescription, 
    disabled, 
    isGM, 
    stateTargetId, 
    isReaction, 
    lastAttackTotal, 
    stateDamageType,
    soundSettings,
    currentTurnActorId
}: UseDiceRollerProps) {
    const [manualBonus, setManualBonus] = useState(0);
    const [selectedCharId, setSelectedCharId] = useState(fixedCharacterId || characters[0]?.id || "");
    const [selectedSkill, setSelectedSkill] = useState("");
    const [actionType, setActionType] = useState<ActionType>("OVERCOME");
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [damageType, setDamageType] = useState<"PHYSICAL" | "MENTAL">("PHYSICAL");
    const [manualDamageType, setManualDamageType] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState("");
    const [lastReactionState, setLastReactionState] = useState(false);

    const pendingCharIdRef = useRef<string>("");
    const finishRollRef = useRef<(charId: string, finalDice: number[], breakdown?: DiceBreakdownEntry[], hiddenForPlayers?: boolean) => void>(() => {});
    const [isRolling, setIsRolling] = useState(false);
    const [diceResults, setDiceResults] = useState<number[]>([0, 0, 0, 0]);
    const [diceRotations, setDiceRotations] = useState<{ x: number, y: number }[]>([
        { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }
    ]);
    const [lastTotal, setLastTotal] = useState<number | null>(null);
    const normalizedActorUserId = useMemo(() => actorUserId.trim().toLowerCase(), [actorUserId]);

    // Sync if characters load later or if fixed character is provided
    useEffect(() => {
        if (fixedCharacterId) {
            if (selectedCharId !== fixedCharacterId) {
                setSelectedCharId(fixedCharacterId);
            }
        } else if (isGM && currentTurnActorId) {
            if (selectedCharId !== currentTurnActorId && characters.some(c => c.id === currentTurnActorId)) {
                setSelectedCharId(currentTurnActorId);
            }
        } else if (!selectedCharId && characters.length > 0) {
            setSelectedCharId(characters[0].id);
        }
    }, [fixedCharacterId, characters, selectedCharId, isGM, currentTurnActorId]);

    // Force reaction target selection, action type and damage type when reaction starts
    useEffect(() => {
        if (isReaction && stateTargetId && (!lastReactionState || !targetIds.includes(stateTargetId))) {
            const canControl = characters.some(c => c.id === stateTargetId);
            if (canControl) {
                setSelectedCharId(stateTargetId);
                setTargetIds([stateTargetId]);
                setActionType("DEFEND");
                if (stateDamageType) {
                    setDamageType(stateDamageType);
                    setManualDamageType(true);
                }
            }
        }
        setLastReactionState(!!isReaction);
    }, [isReaction, stateTargetId, characters, lastReactionState, selectedCharId, targetIds, stateDamageType]);

    const activeChar = useMemo(() => {
        const idToFind = fixedCharacterId || selectedCharId;
        if (!idToFind) return characters[0];
        return characters.find(c => c.id === idToFind || c.name === idToFind) || characters[0];
    }, [characters, fixedCharacterId, selectedCharId]);

    const allItems = useMemo(() => {
        if (!activeChar?.inventory) return [];
        const flat = [...activeChar.inventory];
        activeChar.inventory.forEach(i => {
            if (i.isContainer && i.contents) {
                flat.push(...i.contents);
            }
        });
        return flat;
    }, [activeChar?.inventory]);

    const getRotationForResult = (val: number) => {
        const variants = {
            1: [{ x: 0, y: 0 }, { x: 180, y: 0 }],
            [-1]: [{ x: 0, y: -90 }, { x: 0, y: 90 }],
            0: [{ x: -90, y: 0 }, { x: 90, y: 0 }]
        };
        const choices = variants[val as keyof typeof variants] || variants[0];
        return choices[Math.floor(Math.random() * choices.length)];
    };

    const getLadderLabel = (val: number) => {
        const ladder: Record<number, string> = {
            8: "Lendário", 7: "Épico", 6: "Fantástico", 5: "Excelente",
            4: "Ótimo", 3: "Bom", 2: "Razoável", 1: "Mediano",
            0: "Medíocre", [-1]: "Pobre", [-2]: "Terrível"
        };
        if (val > 8) return "Divino";
        if (val < -2) return "Catastrófico";
        return ladder[val] || "N/A";
    };

    const finishRoll = useCallback(async (charId: string, finalDice: number[], breakdown?: DiceBreakdownEntry[], hiddenForPlayers?: boolean) => {
        const fullNote = selectedSkill ? `[${selectedSkill}]`.toUpperCase() : "";

        const selectedItemData = selectedItemId ? allItems.find(i => i.id === selectedItemId) : undefined;
        const itemBonus = selectedItemData?.bonus || 0;
        const itemPayload = selectedItemData ? { name: selectedItemData.name, bonus: selectedItemData.bonus } : undefined;

        const effectiveSkills = (activeChar?.skills || {}) as Record<string, number>;
        const skillRank = selectedSkill ? (effectiveSkills[selectedSkill] || 0) : 0;
        const finalModifier = skillRank + manualBonus + itemBonus;

        const effectiveHiddenForPlayers = isGM && hiddenForPlayers === true;

        const event = createRollEvent(
            sessionId,
            normalizedActorUserId,
            charId,
            finalModifier,
            finalDice,
            actionType,
            targetIds[0] || undefined,
            fullNote,
            itemPayload,
            targetDiff,
            selectedSkill ? { name: selectedSkill, rank: skillRank } : undefined,
            manualBonus,
            challengeDescription,
            targetIds.length > 0 ? targetIds : undefined,
            damageType,
            breakdown,
            effectiveHiddenForPlayers ? true : undefined
        );

        setDiceResults(finalDice);
        setDiceRotations(finalDice.map(val => getRotationForResult(val)));
        setLastTotal((event.payload as any).total);

        globalEventStore.append(event);
        setSelectedSkill("");
        setManualBonus(0);
        setIsRolling(false);

        const attackTotal = (event.payload as any).total as number;
        const attackForcesDefense =
            actionType === "ATTACK" &&
            targetIds.length > 0 &&
            Number.isFinite(attackTotal) &&
            attackTotal > 0;

        if (
            targetIds.length > 0 &&
            (actionType === "CREATE_ADVANTAGE" || attackForcesDefense)
        ) {
            const firstTargetId = targetIds[0];
            const targetChar = characters.find(c => c.id === firstTargetId);

            if (targetChar && !isCharacterEliminated(targetChar)) {
                globalEventStore.append({
                    id: uuidv4(),
                    sessionId,
                    seq: 0,
                    type: "COMBAT_TARGET_SET",
                    actorUserId: normalizedActorUserId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: {
                        targetId: firstTargetId,
                        targetIds: targetIds,
                        damageType: damageType,
                        isReaction: true
                    }
                } as any);
            }
        }

        setTargetIds([]);

        const isTargetRolling = activeChar?.id === stateTargetId || charId === stateTargetId;
        console.log("🎲 [useDiceRoller] finishRoll eval:", { isReaction, isTargetRolling, actionType, lastAttackTotal, stateTargetId, charId, activeCharId: activeChar?.id });

        if (isReaction && isTargetRolling && actionType === "DEFEND" && lastAttackTotal !== undefined) {
            const result = lastAttackTotal - (event.payload as any).total;
            console.log("🎲 [useDiceRoller] Dispatching COMBAT_OUTCOME!", { lastAttackTotal, defenseTotal: (event.payload as any).total, result });
            const absoluteResult = Math.abs(result);
            const outcomeMessage = result > 0
                ? `ATAQUE VENCEU POR ${absoluteResult}!`
                : result < 0
                    ? `DEFESA VENCEU POR ${absoluteResult}!`
                    : "EMPATE!";

            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "COMBAT_OUTCOME",
                actorUserId: normalizedActorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: {
                    attackerId: "unknown",
                    defenderId: charId,
                    attackTotal: lastAttackTotal,
                    defenseTotal: (event.payload as any).total,
                    result,
                    message: outcomeMessage,
                    track: damageType,
                }
            } as any);
        }
    }, [
        selectedSkill, 
        selectedItemId, 
        allItems, 
        activeChar, 
        manualBonus, 
        sessionId, 
        normalizedActorUserId, 
        actionType, 
        targetIds, 
        targetDiff, 
        challengeDescription, 
        damageType, 
        characters, 
        stateTargetId, 
        isReaction, 
        lastAttackTotal
    ]);

    // Keep the ref always pointing to the latest finishRoll
    finishRollRef.current = finishRoll;

    const handleSkillSelect = (skillName: string) => {
        setSelectedSkill(skillName);
        if (!manualDamageType) {
            const mentalSkills = ["Provocar", "Conhecimentos"];
            const physicalSkills = ["Lutar", "Atirar", "Atletismo", "Vigor"];
            if (mentalSkills.includes(skillName)) {
                setDamageType("MENTAL");
            } else if (physicalSkills.includes(skillName)) {
                setDamageType("PHYSICAL");
            }
        }
    };

    const handleTargetAdd = (id: string) => {
        if (!id || targetIds.includes(id)) return;
        setTargetIds([...targetIds, id]);
    };

    const handleTargetRemove = (id: string) => {
        setTargetIds(targetIds.filter(tid => tid !== id));
    };

    const toggleDamageType = () => {
        setDamageType(prev => prev === "PHYSICAL" ? "MENTAL" : "PHYSICAL");
        setManualDamageType(true);
    };

    const setExplicitDamageType = (type: "PHYSICAL" | "MENTAL") => {
        setDamageType(type);
        setManualDamageType(true);
    };

    const handleRoll = () => {
        if (disabled) return;
        const charId = activeChar?.id || fixedCharacterId || selectedCharId;
        if (!charId || isRolling) return;
        setIsRolling(true);
        setLastTotal(null);
        
        const effectiveSkills = (activeChar?.skills || {}) as Record<string, number>;
        const skillRank = selectedSkill ? (effectiveSkills[selectedSkill] || 0) : 0;
        const selectedItemData = selectedItemId ? allItems.find(i => i.id === selectedItemId) : undefined;
        const itemBonus = selectedItemData?.bonus || 0;

        diceSimulationStore.show({
            calculationBreakdown: {
                baseSkillValue: skillRank,
                itemBonusValue: itemBonus,
                customModifierValue: manualBonus,
                itemName: selectedItemData?.name,
            },
            resultOverlay: targetDiff !== undefined && targetDiff !== null
                ? { mode: "challenge", targetDifficulty: targetDiff }
                : { mode: "combat" },
            onPreResult: () => {
                const diceSound = soundSettings?.dice || "/audio/Effects/dados.MP3";
                const audio = new Audio(diceSound);
                audio.play().catch(e => console.warn("Failed to play dice sound:", e));
            },
            onSettled: (results, breakdown) => {
                // Use ref to avoid stale closure — finishRoll may have been
                // recreated with updated lastAttackTotal after handleRoll was called.
                const hidden = diceSimulationStore.getHiddenForPlayers();
                finishRollRef.current(charId, results, breakdown, hidden);
            }
        });

        pendingCharIdRef.current = charId;

        // Safety timeout: se em 15 segundos os dados não assentarem (erro no Three.js ou context lost),
        // resetamos o estado para o jogador poder tentar novamente.
        setTimeout(() => {
            setIsRolling((prev: boolean) => {
                if (prev) {
                    console.warn("Dice roll safety timeout reached. Forcing roll reset.");
                    return false;
                }
                return prev;
            });
        }, 15000);
    };

    return {
        manualBonus, setManualBonus,
        selectedCharId, setSelectedCharId,
        selectedSkill, handleSkillSelect,
        actionType, setActionType,
        targetIds, handleTargetAdd, handleTargetRemove,
        damageType, toggleDamageType, setExplicitDamageType,
        selectedItemId, setSelectedItemId,
        isRolling, 
        diceResults, diceRotations, lastTotal,
        activeChar, allItems,
        handleRoll, finishRoll, pendingCharIdRef,
        getLadderLabel
    };
}
