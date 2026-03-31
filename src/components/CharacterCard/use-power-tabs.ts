"use client";

import { useState } from "react";
import { Character, Stunt, Spell, ActionEvent } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UsePowerTabsProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
}

export function usePowerTabs({ character, sessionId, actorUserId }: UsePowerTabsProps) {
    const [activeTab, setActiveTab] = useState<'stunts' | 'inventory' | 'spells'>('stunts');
    
    // Stunt State
    const [editingStuntId, setEditingStuntId] = useState<string | null>(null);
    const [tempStunt, setTempStunt] = useState<Stunt | null>(null);
    
    // Spell State
    const [editingSpellId, setEditingSpellId] = useState<string | null>(null);
    const [tempSpell, setTempSpell] = useState<Spell | null>(null);

    const startEditingStunt = (stunt: Stunt) => {
        setEditingStuntId(stunt.id);
        setTempStunt({ ...stunt });
    };

    const startAddingStunt = () => {
        setEditingStuntId("NEW");
        setTempStunt({ id: uuidv4(), name: "", description: "", cost: "1" });
    };

    const handleSaveStunt = () => {
        if (!tempStunt || !tempStunt.name) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_STUNT_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, stunt: tempStunt }
        } as ActionEvent);
        setEditingStuntId(null);
        setTempStunt(null);
    };

    const handleDeleteStunt = (stuntId: string) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_STUNT_DELETED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, stuntId }
        } as ActionEvent);
    };

    const startEditingSpell = (spell: Spell) => {
        setEditingSpellId(spell.id);
        setTempSpell({ ...spell });
    };

    const startAddingSpell = () => {
        setEditingSpellId("NEW");
        setTempSpell({ id: uuidv4(), name: "", description: "", cost: "1" });
    };

    const handleSaveSpell = () => {
        if (!tempSpell || !tempSpell.name) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_SPELL_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, spell: tempSpell }
        } as ActionEvent);
        setEditingSpellId(null);
        setTempSpell(null);
    };

    const handleDeleteSpell = (spellId: string) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_SPELL_DELETED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, spellId }
        } as ActionEvent);
    };

    return {
        activeTab, setActiveTab,
        editingStuntId, setEditingStuntId,
        tempStunt, setTempStunt,
        editingSpellId, setEditingSpellId,
        tempSpell, setTempSpell,
        startEditingStunt, startAddingStunt, handleSaveStunt, handleDeleteStunt,
        startEditingSpell, startAddingSpell, handleSaveSpell, handleDeleteSpell
    };
}
