"use client";

import { useState } from "react";
import { ArenaPortraitFocus, Character, ConsequenceDebuff } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { uploadImage } from '@/lib/apiClient';
import { v4 as uuidv4 } from "uuid";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

// Converts a public S3 URL to go through the backend proxy, which adds
// Access-Control-Allow-Origin: * so the canvas can call toDataURL().
function toProxyUrl(imageUrl: string): string {
    if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) return imageUrl;
    try {
        const key = new URL(imageUrl).pathname.slice(1);
        return `${API_BASE}/api/storage/file/${key}`;
    } catch {
        return imageUrl;
    }
}

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
    const clampStressValue = (value: number) => Math.max(1, Math.min(1000, Math.trunc(value || 1)));

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

    const handleAddStressBox = (track: "PHYSICAL" | "MENTAL", value?: number) => {
        if (!isGM) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "STRESS_TRACK_EXPANDED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, track, value: clampStressValue(value ?? 1) }
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

    const handleUpdateStressBoxValue = (track: "PHYSICAL" | "MENTAL", boxIndex: number, value: number) => {
        if (!isGM) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "STRESS_BOX_VALUE_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, track, boxIndex, value: clampStressValue(value) }
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

    const handleMoneyChange = (value: number) => {
        if (!canEditStressOrFP) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_MONEY_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, value }
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

    const handleMagicLevelChange = (level: number) => {
        if (!canEditStressOrFP) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_MAGIC_LEVEL_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, level: Math.max(0, Math.min(3, level)) }
        } as any);
    };


    // ── Image Upload / Crop ───────────────────────────────────────────────────
    const [isCropping, setIsCropping] = useState(false);
    const [isArenaFocusCropping, setIsArenaFocusCropping] = useState(false);
    const [isImageProcessing, setIsImageProcessing] = useState(false);
    const [tempCropSrc, setTempCropSrc] = useState<string | null>(null);
    const [arenaFocusSrc, setArenaFocusSrc] = useState<string | null>(null);
    const [pendingPortraitBase64, setPendingPortraitBase64] = useState<string | null>(null);
    // When true, arena focus confirm updates only the focus coords (no re-upload)
    const [isReArenaFocusMode, setIsReArenaFocusMode] = useState(false);

    const openArenaFocusStep = (base64: string) => {
        setPendingPortraitBase64(base64);
        setArenaFocusSrc(base64);
        setIsArenaFocusCropping(true);
    };

    const finalizePortraitUpload = async (base64: string, focus: ArenaPortraitFocus) => {
        const blob = await fetch(base64).then(r => r.blob());
        const publicUrl = await uploadImage(blob, 'image/jpeg');

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_IMAGE_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, imageUrl: publicUrl }
        } as any);

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_UPDATED", actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: {
                characterId: character.id,
                changes: {
                    arenaPortraitFocus: {
                        x: Math.max(0, Math.min(100, Number.isFinite(focus.x) ? focus.x : 50)),
                        y: Math.max(0, Math.min(100, Number.isFinite(focus.y) ? focus.y : 30)),
                        zoom: Math.max(1, Math.min(3, Number.isFinite(focus.zoom) ? focus.zoom : 1)),
                    }
                }
            }
        } as any);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isGM || !e.target.files?.[0]) return;
        const file = e.target.files[0];
        setIsImageProcessing(true);
        // blob URL: instantâneo, sem conversão base64 — evita travamento com imagens grandes
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();

        // Safety timeout — 15s to load/decode
        const timeout = setTimeout(() => {
            console.warn("Portrait processing stalled.");
            URL.revokeObjectURL(blobUrl);
            setIsImageProcessing(false);
        }, 15000);

        img.onload = () => {
            clearTimeout(timeout);
            if (img.width > 600 || img.height > 600) {
                setTempCropSrc(blobUrl);
                setIsCropping(true);
                // isImageProcessing stays true until modal confirmation + upload
            } else {
                // Image small enough — compress to canvas then upload to storage
                // isImageProcessing stays true until upload resolves
                const compressAndUpload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        URL.revokeObjectURL(blobUrl);
                        setIsImageProcessing(false);
                        return;
                    }
                    ctx.drawImage(img, 0, 0);
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    URL.revokeObjectURL(blobUrl);
                    openArenaFocusStep(base64);
                };

                if (typeof window !== "undefined" && "requestIdleCallback" in window) {
                   (window as any).requestIdleCallback(compressAndUpload);
                } else {
                    setTimeout(compressAndUpload, 1);
                }
            }
        };
        img.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(blobUrl);
            setIsImageProcessing(false);
        };
        img.src = blobUrl;
    };

    const handleCropConfirm = (base64: string) => {
        if (tempCropSrc?.startsWith("blob:")) URL.revokeObjectURL(tempCropSrc);
        setIsCropping(false);
        setTempCropSrc(null);
        openArenaFocusStep(base64);
    };

    const handleCropCancel = () => {
        if (tempCropSrc?.startsWith("blob:")) URL.revokeObjectURL(tempCropSrc);
        setIsCropping(false);
        setTempCropSrc(null);
        setIsImageProcessing(false);
    };

    const handleArenaFocusConfirm = async (focus: ArenaPortraitFocus) => {
        const base64 = pendingPortraitBase64;
        const focusOnly = isReArenaFocusMode;
        setIsArenaFocusCropping(false);
        setArenaFocusSrc(null);
        setPendingPortraitBase64(null);
        setIsReArenaFocusMode(false);

        const clampedFocus = {
            x: Math.max(0, Math.min(100, Number.isFinite(focus.x) ? focus.x : 50)),
            y: Math.max(0, Math.min(100, Number.isFinite(focus.y) ? focus.y : 30)),
            zoom: Math.max(1, Math.min(3, Number.isFinite(focus.zoom) ? focus.zoom : 1)),
        };

        if (focusOnly) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_UPDATED", actorUserId: normalizedUserId,
                createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: character.id, changes: { arenaPortraitFocus: clampedFocus } }
            } as any);
            setIsImageProcessing(false);
            return;
        }

        if (!base64) {
            setIsImageProcessing(false);
            return;
        }

        try {
            await finalizePortraitUpload(base64, focus);
        } catch (err) {
            console.error('[CharacterCard] Falha no upload da imagem (arena focus):', err);
        } finally {
            setIsImageProcessing(false);
        }
    };

    const handleArenaFocusCancel = () => {
        setIsArenaFocusCropping(false);
        setArenaFocusSrc(null);
        setPendingPortraitBase64(null);
        setIsReArenaFocusMode(false);
        setIsImageProcessing(false);
    };

    const handleReArenaFocus = () => {
        if (!isGM || !character.imageUrl || isImageProcessing) return;
        setArenaFocusSrc(character.imageUrl);
        setIsArenaFocusCropping(true);
        setIsImageProcessing(true);
        setIsReArenaFocusMode(true);
    };

    const handleReCrop = () => {
        if (!isGM || !character.imageUrl || isImageProcessing) return;
        setTempCropSrc(toProxyUrl(character.imageUrl));
        setIsCropping(true);
        setIsImageProcessing(true);
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
        if (!canEdit) return;
        if (value === null) {
            const currentData = character.consequences?.[slot];
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
        setShowAddConsequenceModal(false);
        // Apenas cria o slot vazio — sem abrir o modal de texto
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_SLOT_ADDED",
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: character.id, slot: uniqueId }
        } as any);
    };

    const handleDeleteConsequence = (slot: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canEdit) return;
        if (canEdit) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_DELETED", actorUserId: normalizedUserId,
                createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: character.id, slot }
            } as any);
        }
    };

    const handleKillCharacter = () => {
        if (!isGM) return;
        const removedDefaults = character.removedDefaultSlots || [];
        const defaultSlots = ["mild", "moderate", "severe"].filter(s => !removedDefaults.includes(s));
        const allSlots = new Set<string>(defaultSlots);
        (character.extraConsequenceSlots || []).forEach(s => allSlots.add(s));
        Object.keys(character.consequences || {}).forEach(k => allSlots.add(k));

        allSlots.forEach(slot => {
            const existing = (character.consequences as any)?.[slot];
            if (!existing?.text?.trim()) {
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_UPDATED",
                    actorUserId: normalizedUserId,
                    createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: { characterId: character.id, slot, value: "ELIMINADO" }
                } as any);
            }
        });
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
        handleUpdateStressBoxValue,
        handleFPChange, handleRefreshChange, handleMoneyChange,
        handleMagicLevelChange,
        handleImageUpload,

        handleConsequenceChange, handleSaveConsequence,
        handleAddConsequence, handleDeleteConsequence, handleKillCharacter,
        handleAddNote, handleDeleteNote,
        handleDeleteCharacter,
        // Cropper
        isCropping, tempCropSrc, handleCropConfirm, handleCropCancel,
        isArenaFocusCropping, arenaFocusSrc, handleArenaFocusConfirm, handleArenaFocusCancel,
        isImageProcessing, handleReCrop, handleReArenaFocus
    };
}
