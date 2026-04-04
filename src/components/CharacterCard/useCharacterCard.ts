"use client";

import { useState } from "react";
import { Character, ConsequenceDebuff } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UseCharacterCardOptions {
    character: Character;
    sessionId: string;
    actorUserId: string;
    isGM: boolean;
    isOwner: boolean;
    canEdit: boolean;
    canEditStressOrFP: boolean;
}

export function useCharacterCard({
    character,
    sessionId,
    actorUserId,
    isGM,
    isOwner,
    canEdit,
    canEditStressOrFP,
}: UseCharacterCardOptions) {
    const normalizedUserId = actorUserId.trim().toLowerCase();

    // ── Bio / Lore State ──────────────────────────────────────────────────────
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [tempBio, setTempBio] = useState("");
    const [showLore, setShowLore] = useState(false);

    // ── Aspect State ──────────────────────────────────────────────────────────
    const [editingAspectIndex, setEditingAspectIndex] = useState<number | null>(null);
    const [tempAspect, setTempAspect] = useState("");

    // ── Name State ────────────────────────────────────────────────────────────
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState("");

    // ── Consequence Modal State ───────────────────────────────────────────────
    const [consequenceModal, setConsequenceModal] = useState<{
        slot: string;
        current: string;
        debuffSkill: string;
        debuffValue: number;
    } | null>(null);
    const [showAddConsequenceModal, setShowAddConsequenceModal] = useState(false);

    // ── Stress Handlers ───────────────────────────────────────────────────────
    const handleStressToggle = (track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => {
        if (!canEditStressOrFP) return;
        const type = current ? "STRESS_CLEARED" : "STRESS_MARKED";
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type, actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, track, boxIndex: index }
        } as any);
    };

    const handleAddStressBox = (track: "PHYSICAL" | "MENTAL") => {
        if (!isGM) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "STRESS_TRACK_EXPANDED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, track }
        } as any);
    };

    const handleRemoveStressBox = (track: "PHYSICAL" | "MENTAL") => {
        if (!isGM) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "STRESS_TRACK_REDUCED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, track }
        } as any);
    };

    // ── Fate Points / Refresh ─────────────────────────────────────────────────
    const handleFPChange = (amount: number) => {
        if (!canEditStressOrFP) return;
        const type = amount > 0 ? "FP_GAINED" : "FP_SPENT";
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type, actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, amount: Math.abs(amount), reason: "MANUAL" }
        } as any);
    };

    const handleRefreshChange = (delta: number) => {
        if (!isGM) return;
        const currentRefresh = character.refresh ?? 3;
        const newRefresh = Math.max(1, currentRefresh + delta);
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_REFRESH_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, refresh: newRefresh }
        } as any);
    };

    // ── Image Upload ──────────────────────────────────────────────────────────
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isGM || !e.target.files?.[0]) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
                if (width > height) {
                    if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width = Math.round((width * MAX_HEIGHT) / height); height = MAX_HEIGHT; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                    globalEventStore.append({
                        id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_IMAGE_UPDATED", actorUserId: normalizedUserId,
                        createdAt: new Date().toISOString(), visibility: "PUBLIC",
                        payload: { characterId: character.id, imageUrl: compressedBase64 }
                    } as any);
                }
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    };

    // ── Bio Handlers ──────────────────────────────────────────────────────────
    const startEditingBio = () => {
        setTempBio(character.biography || "");
        setIsEditingBio(true);
    };

    const handleSaveBio = () => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_BIO_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, biography: tempBio }
        } as any);
        setIsEditingBio(false);
    };

    // ── Aspect Handlers ───────────────────────────────────────────────────────
    const startEditingAspect = (index: number, currentVal: string) => {
        setTempAspect(currentVal);
        setEditingAspectIndex(index);
    };

    const handleSaveAspect = (index: number) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_SHEET_ASPECT_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, index, value: tempAspect.toUpperCase() }
        } as any);
        setEditingAspectIndex(null);
    };

    // ── Name Handlers ─────────────────────────────────────────────────────────
    const startEditingName = () => {
        setTempName(character.name);
        setIsEditingName(true);
    };

    const handleSaveName = () => {
        if (!tempName.trim()) return;
        globalEventStore.append({
            type: "CHARACTER_NAME_UPDATED",
            id: uuidv4(), sessionId, seq: 0, actorUserId: normalizedUserId, visibility: "PUBLIC",
            createdAt: new Date().toISOString(),
            payload: { characterId: character.id, name: tempName.trim() }
        } as any);
        setIsEditingName(false);
    };

    // ── Consequence Handlers ──────────────────────────────────────────────────
    const handleConsequenceChange = (slot: string, value: string | null, debuff?: ConsequenceDebuff) => {
        if (!isGM) return;
        if (value === null) {
            const currentData = character.consequences[slot];
            setConsequenceModal({
                slot,
                current: currentData?.text || "",
                debuffSkill: currentData?.debuff?.skill || "",
                debuffValue: currentData?.debuff?.value || 0
            });
            return;
        }
        const debuffPayload = debuff?.skill ? debuff : undefined;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, slot, value, debuff: debuffPayload }
        } as any);
    };

    const handleSaveConsequence = (text: string, debuffSkill: string, debuffValue: number) => {
        if (!consequenceModal) return;
        const debuff = debuffSkill ? { skill: debuffSkill, value: debuffValue } : undefined;
        handleConsequenceChange(consequenceModal.slot as any, text, debuff);
        setConsequenceModal(null);
    };

    const handleAddConsequence = (type: "mild" | "moderate" | "severe") => {
        const uniqueId = `${type}_${uuidv4().slice(0, 8)}`;
        handleConsequenceChange(uniqueId, " ");
        setShowAddConsequenceModal(false);
    };

    const handleDeleteConsequence = (slot: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isGM) return;
        if (isGM) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_DELETED", actorUserId: normalizedUserId,
                createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: character.id, slot }
            } as any);
        }
    };

    // ── Note Handlers ─────────────────────────────────────────────────────────
    const handleAddNote = (content: string, isPrivate: boolean = false) => {
        if (!content.trim()) return;
        const note = {
            id: uuidv4(), authorId: normalizedUserId,
            authorName: isGM ? "MESTRE" : (character.name || actorUserId),
            content, createdAt: new Date().toISOString(), isPrivate
        };
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_NOTE_ADDED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: isPrivate ? { kind: "PLAYER_ONLY", userId: normalizedUserId } : "PUBLIC",
            payload: { characterId: character.id, note }
        } as any);
    };

    const handleDeleteNote = (noteId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_NOTE_DELETED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, noteId }
        } as any);
    };

    // ── Delete Character ──────────────────────────────────────────────────────
    const handleDeleteCharacter = () => {
        globalEventStore.append({
            type: "CHARACTER_DELETED",
            id: uuidv4(), sessionId, seq: 0, actorUserId: normalizedUserId, visibility: "PUBLIC",
            createdAt: new Date().toISOString(),
            payload: { characterId: character.id }
        } as any);
    };

    return {
        // Bio / Lore
        isEditingBio, setIsEditingBio, tempBio, setTempBio, showLore, setShowLore,
        startEditingBio, handleSaveBio,
        // Aspects
        editingAspectIndex, setEditingAspectIndex, tempAspect, setTempAspect,
        startEditingAspect, handleSaveAspect,
        // Name
        isEditingName, setIsEditingName, tempName, setTempName,
        startEditingName, handleSaveName,
        // Consequence modal
        consequenceModal, setConsequenceModal,
        showAddConsequenceModal, setShowAddConsequenceModal,
        // Handlers
        handleStressToggle, handleAddStressBox, handleRemoveStressBox,
        handleFPChange, handleRefreshChange,
        handleImageUpload,
        handleConsequenceChange, handleSaveConsequence,
        handleAddConsequence, handleDeleteConsequence,
        handleAddNote, handleDeleteNote,
        handleDeleteCharacter,
    };
}
