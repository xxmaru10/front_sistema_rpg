"use client";

import { useState, useCallback } from "react";
import { Character, ConsequenceDebuff } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UseCombatCardProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    isGM: boolean;
}

interface ConsequenceModalState {
    slot: string;
    current: string;
    debuffSkill: string;
    debuffValue: number;
}

export function useCombatCard({ character, sessionId, actorUserId, isGM }: UseCombatCardProps) {
    const normalizedUserId = actorUserId.trim().toLowerCase();
    const [isCollapsed, setIsCollapsed] = useState(!isGM);
    const [consequenceModal, setConsequenceModal] = useState<ConsequenceModalState | null>(null);

    const handleStressToggle = useCallback((track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => {
        const type = current ? "STRESS_CLEARED" : "STRESS_MARKED";
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type,
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, track, boxIndex: index }
        } as any);
    }, [character.id, sessionId, normalizedUserId]);

    const handleFPChange = useCallback((amount: number) => {
        const type = amount > 0 ? "FP_GAINED" : "FP_SPENT";
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type,
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, amount: Math.abs(amount), reason: "COMBAT_MANUAL" }
        } as any);
    }, [character.id, sessionId, normalizedUserId]);

    const handleConsequenceChange = useCallback((slot: string, value: string, debuff?: ConsequenceDebuff) => {
        if (!isGM) return;
        const debuffPayload = debuff?.skill ? debuff : undefined;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_CONSEQUENCE_UPDATED",
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, slot, value, debuff: debuffPayload }
        } as any);
    }, [character.id, sessionId, normalizedUserId, isGM]);

    const openConsequenceModal = useCallback((slot: string, currentValue: string, debuffSkill?: string, debuffValue?: number) => {
        if (!isGM) return;
        setConsequenceModal({
            slot,
            current: currentValue,
            debuffSkill: debuffSkill || "",
            debuffValue: debuffValue || 0
        });
    }, [isGM]);

    const handleSaveConsequence = useCallback((text: string, debuffSkill: string, debuffValue: number) => {
        if (!consequenceModal) return;
        const debuff = debuffSkill ? { skill: debuffSkill, value: debuffValue } : undefined;
        handleConsequenceChange(consequenceModal.slot, text, debuff);
        setConsequenceModal(null);
    }, [consequenceModal, handleConsequenceChange]);

    const handleUpdateHazard = useCallback((changes: Partial<Character>) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_UPDATED",
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, changes }
        } as any);
    }, [character.id, sessionId, normalizedUserId]);
    
    const handleAddImpulse = useCallback(() => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_IMPULSE_ADDED",
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id }
        } as any);
    }, [character.id, sessionId, normalizedUserId]);

    const handleRemoveImpulse = useCallback(() => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_IMPULSE_REMOVED",
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id }
        } as any);
    }, [character.id, sessionId, normalizedUserId]);

    return {
        isCollapsed,
        setIsCollapsed,
        consequenceModal,
        setConsequenceModal,
        handleStressToggle,
        handleFPChange,
        handleConsequenceChange,
        openConsequenceModal,
        handleSaveConsequence,
        handleUpdateHazard,
        handleAddImpulse,
        handleRemoveImpulse,
    };
}
