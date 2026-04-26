"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Backpack, Eye, Pencil, X } from "lucide-react";
import { Character, GlobalItem, Item } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { VIControlPanel } from "@/components/VIControlPanel";
import { MentionSuggestions } from "@/components/MentionSuggestions";

interface InventorySectionProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    canEdit: boolean;
    isGM: boolean;
    isFloating?: boolean;
    globalItems?: GlobalItem[];
}

function normalizeComparable(value?: string | null) {
    return (value || "").trim().toLowerCase();
}

function extractTextPreview(content?: string) {
    if (!content) return "";
    if (typeof window === "undefined") {
        return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function createClearedItemDraft(item?: Item, name = "", preserveStructure = false): Item {
    return {
        id: item?.id || uuidv4(),
        name,
        description: "",
        bonus: 0,
        quantityCurrent: 1,
        quantityTotal: 1,
        size: preserveStructure ? item?.size : undefined,
        url: undefined,
        isContainer: preserveStructure ? item?.isContainer : false,
        capacity: preserveStructure ? item?.capacity : undefined,
        contents: preserveStructure ? (item?.contents || []) : [],
        maxSize: item?.maxSize,
    };
}

export function InventorySection({
    character,
    sessionId,
    actorUserId,
    canEdit,
    isGM,
    isFloating = true,
    globalItems = [],
}: InventorySectionProps) {
    const [inventoryModal, setInventoryModal] = useState<{
        index: number;
        item: Item;
        containerId: string | null;
        linkedGlobalItemId: string | null;
    } | null>(null);
    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | string | null>(null);
    const [activeInventoryTab, setActiveInventoryTab] = useState<string>("main");
    const [showVISelector, setShowVISelector] = useState(false);
    const [inventoryItemSuggestions, setInventoryItemSuggestions] = useState<{
        active: boolean;
        query: string;
        position: { top: number; left: number };
    }>({ active: false, query: "", position: { top: 0, left: 0 } });
    const normalizedActorUserId = actorUserId.trim().toLowerCase();
    const itemNameInputRef = useRef<HTMLInputElement>(null);
    const [inventoryValidationError, setInventoryValidationError] = useState<string | null>(null);

    // Draggable Logic
    const [dragPos, setDragPos] = useState({ x: -270, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const posRef = useRef({ x: -270, y: 20 });
    const containerRef = useRef<HTMLDivElement>(null);

    const storageContainers = useMemo(
        () => (character.inventory || []).filter((item) => item?.isContainer),
        [character.inventory]
    );
    const mainInventorySlots = useMemo(
        () => Math.max(1, character.inventory?.length || 0),
        [character.inventory]
    );
    const hasStorageTabs = storageContainers.length > 0;
    const storageTabsKey = storageContainers.map((container) => container.id).join("|");
    const globalItemsById = useMemo(
        () => new Map((globalItems || []).map((item) => [item.id, item])),
        [globalItems]
    );
    const globalItemsByName = useMemo(
        () => new Map((globalItems || []).map((item) => [normalizeComparable(item.name), item])),
        [globalItems]
    );
    const globalItemSuggestionEntities = useMemo(
        () => (globalItems || []).map((item) => ({
            id: item.id,
            name: item.name,
            category: "Jogo",
            displayType: "ITEM",
            type: "ITEM",
        })),
        [globalItems]
    );
    const createEmptyInventorySlot = (): Item => ({
        id: uuidv4(),
        name: "",
        description: "",
        bonus: 0,
        quantityCurrent: 1,
        quantityTotal: 1,
        size: undefined,
    });
    const getLastFilledSlotIndex = (items: Item[] | undefined) => {
        let lastFilledIndex = -1;
        (items || []).forEach((item, index) => {
            if (item?.name?.trim()) {
                lastFilledIndex = index;
            }
        });
        return lastFilledIndex;
    };
    const buildInventoryWithLength = (targetLength: number) => {
        const nextInventory = (character.inventory || []).slice(0, targetLength);
        while (nextInventory.length < targetLength) {
            nextInventory.push(createEmptyInventorySlot());
        }
        return nextInventory;
    };

    // Load persisted position
    useEffect(() => {
        const saved = localStorage.getItem(`inv_pos_${character.id}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setDragPos(parsed);
                posRef.current = parsed;
            } catch (e) { console.warn("Failed to load inventory position", e); }
        }
    }, [character.id]);

    useEffect(() => {
        const validTabs = hasStorageTabs
            ? new Set(["all", "main", ...storageContainers.map((container) => `container:${container.id}`)])
            : new Set(["main"]);
        const fallbackTab = hasStorageTabs ? "all" : "main";

        if (!validTabs.has(activeInventoryTab)) {
            setActiveInventoryTab(fallbackTab);
        }
    }, [activeInventoryTab, hasStorageTabs, storageTabsKey]);

    const onMouseDownHeader = (e: any) => {
        // Don't drag if clicking buttons inside header
        if ((e.target as HTMLElement).closest('button')) return;

        e.preventDefault();
        const startX = e.clientX - dragPos.x;
        const startY = e.clientY - dragPos.y;
        setIsDragging(true);

        const onMouseMove = (ev: MouseEvent) => {
            const newX = ev.clientX - startX;
            const newY = ev.clientY - startY;
            
            if (containerRef.current) {
                containerRef.current.style.left = `${newX}px`;
                containerRef.current.style.top = `${newY}px`;
            }
            posRef.current = { x: newX, y: newY };
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setIsDragging(false);
            setDragPos(posRef.current);
            localStorage.setItem(`inv_pos_${character.id}`, JSON.stringify(posRef.current));
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };



    const handleInventoryChange = (index: number, containerId: string | null = null) => {
        let currentItem: Item;

        if (containerId) {
            const container = (character.inventory || []).find(i => i.id === containerId);
            currentItem = container?.contents?.[index] || createEmptyInventorySlot();
        } else {
            currentItem = character.inventory?.[index] || createEmptyInventorySlot();
        }
        const linkedGlobalItem = globalItemsByName.get(normalizeComparable(currentItem.name));
        setInventoryValidationError(null);
        setInventoryModal({
            index,
            item: { ...currentItem },
            containerId,
            linkedGlobalItemId: linkedGlobalItem?.id || null,
        });
    };

    const handleSaveInventoryItem = () => {
        if (!inventoryModal) return;

        // Validation Logic
        const sizeWeights: Record<string, number> = { 'L': 1, 'M': 2, 'G': 3 };
        
        // Slot level restriction check
        let slotMaxSize: string | undefined;
        if (inventoryModal.containerId) {
            const container = (character.inventory || []).find(i => i.id === inventoryModal.containerId);
            slotMaxSize = container?.contents?.[inventoryModal.index]?.maxSize;
        } else {
            slotMaxSize = character.inventory?.[inventoryModal.index]?.maxSize;
        }

        if (slotMaxSize && inventoryModal.item.size) {
            const itemWeight = sizeWeights[inventoryModal.item.size] || 0;
            const slotWeight = sizeWeights[slotMaxSize] || 0;
            
            if (itemWeight > slotWeight) {
                setInventoryValidationError(`Item é tamanho [${inventoryModal.item.size}], encaixe no local correto (Máx: ${slotMaxSize})`);
                return;
            }
        }

        setInventoryValidationError(null);

        const newItem: Item = {
            id: inventoryModal.item.id || uuidv4(),
            name: inventoryModal.item.name,
            description: inventoryModal.item.description,
            bonus: inventoryModal.item.bonus,
            quantityCurrent: inventoryModal.item.quantityCurrent,
            quantityTotal: inventoryModal.item.quantityTotal,
            size: inventoryModal.item.size,
            url: inventoryModal.item.url,
            isContainer: inventoryModal.item.isContainer,
            capacity: inventoryModal.item.capacity,
            contents: inventoryModal.item.contents || [],
            maxSize: inventoryModal.item.maxSize
        };

        if (inventoryModal.containerId) {
            const container = (character.inventory || []).find(i => i.id === inventoryModal.containerId);
            if (container) {
                const newContents = [...(container.contents || [])];
                while (newContents.length <= inventoryModal.index) {
                    newContents.push(createEmptyInventorySlot());
                }
                newContents[inventoryModal.index] = newItem;

                const updatedContainer = { ...container, contents: newContents };

                globalEventStore.append({
                    id: uuidv4(),
                    sessionId,
                    seq: 0,
                    type: "CHARACTER_INVENTORY_UPDATED",
                    actorUserId: normalizedActorUserId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { characterId: character.id, item: updatedContainer }
                } as any);
            }
        } else {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "CHARACTER_INVENTORY_UPDATED",
                actorUserId: normalizedActorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId: character.id, item: newItem }
            } as any);
        }

        setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } });
        setInventoryValidationError(null);
        setInventoryModal(null);
    };


    const updateInventoryModalField = (field: keyof Item, value: any) => {
        if (!inventoryModal) return;
        setInventoryModal({
            ...inventoryModal,
            item: { ...inventoryModal.item, [field]: value }
        });
    };

    const updateInventoryNameSuggestions = (query: string) => {
        const normalizedQuery = normalizeComparable(query);
        const inputRect = itemNameInputRef.current?.getBoundingClientRect();

        if (!normalizedQuery || normalizedQuery.length < 2 || !inputRect) {
            setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } });
            return;
        }

        setInventoryItemSuggestions({
            active: true,
            query,
            position: {
                top: inputRect.bottom + 6,
                left: inputRect.left,
            }
        });
    };

    const applyGlobalItemToInventoryModal = (globalItem: GlobalItem, nextName?: string) => {
        setInventoryModal((current) => {
            if (!current) return current;

            return {
                ...current,
                linkedGlobalItemId: globalItem.id,
                item: {
                    ...current.item,
                    name: nextName ?? globalItem.name,
                    description: globalItem.description,
                    bonus: globalItem.bonus || 0,
                    size: globalItem.size as any,
                    quantityCurrent: globalItem.quantity,
                    quantityTotal: globalItem.quantity,
                    url: globalItem.imageUrl,
                }
            };
        });
    };

    const handleInventoryNameChange = (nextName: string) => {
        updateInventoryNameSuggestions(nextName);
        const matchedItem = globalItemsByName.get(normalizeComparable(nextName));
        if (matchedItem) {
            applyGlobalItemToInventoryModal(matchedItem, nextName);
            return;
        }

        setInventoryModal((current) => {
            if (!current) return current;
            const nextItem = current.linkedGlobalItemId
                ? createClearedItemDraft(current.item, nextName, true)
                : { ...current.item, name: nextName };

            return {
                ...current,
                linkedGlobalItemId: null,
                item: nextItem,
            };
        });
    };

    const handleSelectInventorySuggestion = (item: { id: string; name: string }) => {
        const matchedItem = globalItemsById.get(item.id);
        if (!matchedItem) return;

        applyGlobalItemToInventoryModal(matchedItem, matchedItem.name);
        setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } });
        setTimeout(() => itemNameInputRef.current?.focus(), 0);
    };

    const handleUpdateItemQuantity = (index: number, delta: number, containerId: string | null = null) => {
        if (containerId) {
            const container = (character.inventory || []).find(i => i.id === containerId);
            if (!container) return;

            const currentItem = container.contents?.[index];
            if (!currentItem || !currentItem.name) return;

            const newCurrent = Math.max(0, (currentItem.quantityCurrent ?? 1) + delta);
            const updatedItem = { ...currentItem, quantityCurrent: newCurrent };

            const newContents = [...(container.contents || [])];
            newContents[index] = updatedItem;

            const updatedContainer = { ...container, contents: newContents };

            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "CHARACTER_INVENTORY_UPDATED",
                actorUserId: normalizedActorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId: character.id, item: updatedContainer }
            } as any);

        } else {
            const currentItem = character.inventory?.[index];
            if (!currentItem || !currentItem.name) return;

            const newCurrent = Math.max(0, (currentItem.quantityCurrent ?? 1) + delta);

            const updatedItem: Item = {
                ...currentItem,
                quantityCurrent: newCurrent
            };

            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "CHARACTER_INVENTORY_UPDATED",
                actorUserId: normalizedActorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId: character.id, item: updatedItem }
            } as any);
        }
    };

    const handleClearInventorySlot = (index: number, containerId: string | null = null) => {
        if (containerId) {
            const container = (character.inventory || []).find(i => i.id === containerId);
            if (!container) return;

            const targetItem = container.contents?.[index];
            const newContents = [...(container.contents || [])];
            while (newContents.length <= index) {
                newContents.push(createEmptyInventorySlot());
            }
            newContents[index] = createClearedItemDraft(targetItem);

            const updatedContainer = {
                ...container,
                contents: newContents,
            };

            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "CHARACTER_INVENTORY_UPDATED",
                actorUserId: normalizedActorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId: character.id, item: updatedContainer }
            } as any);
            return;
        }

        const targetItem = character.inventory?.[index];
        if (!targetItem) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_INVENTORY_UPDATED",
            actorUserId: normalizedActorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, item: createClearedItemDraft(targetItem) }
        } as any);
    };

    const handleAddMainInventorySlot = () => {
        if (!isGM) return;
        const targetLength = mainInventorySlots + 1;
        const nextInventory = buildInventoryWithLength(targetLength);

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_UPDATED",
            actorUserId: normalizedActorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                characterId: character.id,
                changes: {
                    inventory: nextInventory,
                }
            }
        } as any);
    };

    const handleRemoveMainInventorySlot = () => {
        if (!isGM) return;

        const currentLength = character.inventory?.length || 0;
        const lastFilledIndex = getLastFilledSlotIndex(character.inventory);
        const nextLength = Math.max(1, currentLength - 1, lastFilledIndex + 1);

        if (nextLength >= currentLength) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_UPDATED",
            actorUserId: normalizedActorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                characterId: character.id,
                changes: {
                    inventory: buildInventoryWithLength(nextLength),
                }
            }
        } as any);
    };

    const handleExpandContainerSlots = (container: Item) => {
        if (!isGM || !container.isContainer) return;

        const nextCapacity = Math.max(container.capacity || 3, (container.contents || []).length) + 1;
        const updatedContainer: Item = {
            ...container,
            capacity: nextCapacity,
            contents: container.contents || [],
        };

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_INVENTORY_UPDATED",
            actorUserId: normalizedActorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, item: updatedContainer }
        } as any);
    };

    const handleReduceContainerSlots = (container: Item) => {
        if (!isGM || !container.isContainer) return;

        const currentCapacity = Math.max(container.capacity || 3, container.contents?.length || 0);
        const minimumCapacity = Math.max(1, getLastFilledSlotIndex(container.contents) + 1);
        const nextCapacity = Math.max(minimumCapacity, currentCapacity - 1);

        if (nextCapacity >= currentCapacity) return;

        const updatedContainer: Item = {
            ...container,
            capacity: nextCapacity,
            contents: (container.contents || []).slice(0, nextCapacity),
        };

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_INVENTORY_UPDATED",
            actorUserId: normalizedActorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, item: updatedContainer }
        } as any);
    };

    const renderSubsectionHeader = (
        title: string,
        onAddSlot?: () => void,
        onRemoveSlot?: () => void,
        options?: { showBackpack?: boolean; canRemove?: boolean }
    ) => (
        <div
            className="inventory-subsection-header"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                padding: "0 4px",
            }}
        >
            <div
                className="inventory-subsection-title"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontFamily: "var(--font-header)",
                    fontSize: "0.66rem",
                    letterSpacing: "0.18em",
                    color: "rgba(var(--accent-rgb), 0.82)",
                }}
            >
                {options?.showBackpack && <Backpack size={15} />}
                <span>{title.toUpperCase()}</span>
            </div>
            {isGM && onAddSlot && (
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        flexShrink: 0,
                    }}
                >
                    <button
                        type="button"
                        className="inventory-subsection-add"
                        onClick={onRemoveSlot}
                        disabled={!options?.canRemove}
                        title={`Remover slot em ${title.toLowerCase()}`}
                        style={{
                            appearance: "none",
                            width: "26px",
                            height: "26px",
                            borderRadius: "999px",
                            border: "1px solid rgba(var(--accent-rgb), 0.24)",
                            background: options?.canRemove
                                ? "linear-gradient(180deg, rgba(255, 130, 130, 0.12), rgba(120, 20, 20, 0.08))"
                                : "rgba(255, 255, 255, 0.03)",
                            color: options?.canRemove ? "#ffb3b3" : "rgba(255, 255, 255, 0.28)",
                            fontFamily: "var(--font-header)",
                            fontSize: "1rem",
                            lineHeight: 1,
                            cursor: options?.canRemove ? "pointer" : "not-allowed",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.22)",
                            flexShrink: 0,
                            opacity: options?.canRemove ? 1 : 0.65,
                        }}
                    >
                        -
                    </button>
                    <button
                        type="button"
                        className="inventory-subsection-add"
                        onClick={onAddSlot}
                        title={`Adicionar slot em ${title.toLowerCase()}`}
                        style={{
                            appearance: "none",
                            width: "26px",
                            height: "26px",
                            borderRadius: "999px",
                            border: "1px solid rgba(var(--accent-rgb), 0.24)",
                            background: "linear-gradient(180deg, rgba(var(--accent-rgb), 0.16), rgba(var(--accent-rgb), 0.06))",
                            color: "var(--accent-color)",
                            fontFamily: "var(--font-header)",
                            fontSize: "1rem",
                            lineHeight: 1,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.22)",
                            flexShrink: 0,
                        }}
                    >
                        +
                    </button>
                </div>
            )}
        </div>
    );

    const renderInventorySlots = (
        items: Item[] | undefined,
        length: number,
        containerId: string | null = null,
        emptyLabel: string = "SLOT VAZIO"
    ) => (
        <div className="inventory-list compact-list">
            {Array.from({ length }).map((_, i) => {
                const item = items?.[i];
                const isFilled = !!item?.name?.length;
                const sizeClass = item?.maxSize ? `size-${item.maxSize.toLowerCase()}` : "";
                const slotId = containerId ? `container-${containerId}-${i}` : `main-${i}`;
                const isSlotActive = activeSlotIndex === slotId;
                const usedStorageSlots = item?.isContainer
                    ? (item.contents || []).filter((entry) => entry?.name?.trim()).length
                    : 0;

                return (
                    <div key={slotId} className={`inventory-slot compact-slot ${isFilled ? "filled" : "empty"} ${sizeClass}`}>
                        <div className="inventory-slot-inner">
                            {canEdit ? (
                                <button
                                    className="inventory-btn-wrapper"
                                    onClick={() => setActiveSlotIndex(isSlotActive ? null : slotId)}
                                >
                                    <div className="inv-slot-number">{i + 1}</div>
                                    <div className="inv-main-content">
                                        <div className="inv-name-row">
                                            <span className="inv-name-col">
                                                {isFilled ? item.name.toUpperCase() : <span className="placeholder">{emptyLabel}</span>}
                                            </span>
                                            {isFilled && item.bonus !== 0 && (
                                                <span className="bonus-badge">
                                                    {item.bonus > 0 ? `+${item.bonus}` : item.bonus}
                                                </span>
                                            )}
                                        </div>
                                        {isFilled && item.description && (
                                            <div className="inv-description-row">
                                                {extractTextPreview(item.description)}
                                            </div>
                                        )}
                                    </div>
                                    {item?.maxSize && (
                                        <div className={`inv-size-indicator restriction size-${item.maxSize.toLowerCase()}`} title={`Restrição: Máximo ${item.maxSize}`}>
                                            {item.maxSize}
                                        </div>
                                    )}
                                </button>
                            ) : (
                                <div
                                    className="inventory-btn-wrapper interactive"
                                    onClick={() => setActiveSlotIndex(isSlotActive ? null : slotId)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div className="inv-slot-number">{i + 1}</div>
                                    <div className="inv-main-content">
                                        <div className="inv-name-row">
                                            <span className="inv-name-col">
                                                {isFilled ? item.name.toUpperCase() : <span className="placeholder">{emptyLabel}</span>}
                                            </span>
                                            {isFilled && item.bonus !== 0 && (
                                                <span className="bonus-badge">
                                                    {item.bonus > 0 ? `+${item.bonus}` : item.bonus}
                                                </span>
                                            )}
                                        </div>
                                        {isFilled && item.description && (
                                            <div className="inv-description-row">
                                                {extractTextPreview(item.description)}
                                            </div>
                                        )}
                                    </div>
                                    {item?.maxSize && (
                                        <div className={`inv-size-indicator restriction size-${item.maxSize.toLowerCase()}`} title={`Restrição: Máximo ${item.maxSize}`}>
                                            {item.maxSize}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isFilled && canEdit && !item.isContainer && (
                                <div className="inv-quantity-controls">
                                    <button
                                        className="qty-btn qty-decrease"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateItemQuantity(i, -1, containerId);
                                        }}
                                        title="Diminuir quantidade"
                                    >
                                        ▼
                                    </button>
                                    <span className="qty-display">
                                        {item.quantityCurrent ?? 1}/{item.quantityTotal ?? 1}
                                    </span>
                                    <button
                                        className="qty-btn qty-increase"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateItemQuantity(i, 1, containerId);
                                        }}
                                        title="Aumentar quantidade"
                                    >
                                        ▲
                                    </button>
                                </div>
                            )}

                            {isFilled && item.isContainer && (
                                <div className="inv-quantity-display">
                                    <span
                                        className="qty-label"
                                        style={{ color: "var(--accent-color)", display: "flex", alignItems: "center", gap: "6px" }}
                                    >
                                        <Backpack size={14} />
                                        {usedStorageSlots}/{item.capacity || 3}
                                    </span>
                                </div>
                            )}

                            {isFilled && !canEdit && !item.isContainer && (item.quantityCurrent !== undefined || item.quantityTotal !== undefined) && (
                                <div className="inv-quantity-display">
                                    <span className="qty-label">QTD:</span>
                                    <span className="qty-value">{item.quantityCurrent ?? 1}/{item.quantityTotal ?? 1}</span>
                                </div>
                            )}
                        </div>

                        {isSlotActive && (
                            <div className="slot-actions-overlay">
                                {item?.url && (
                                    <button
                                        className="slot-action-btn eye"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewImageUrl(item.url || null);
                                            setActiveSlotIndex(null);
                                        }}
                                        title="Visualizar Imagem"
                                    >
                                        <Eye size={15} />
                                    </button>
                                )}
                                {canEdit && (
                                    <button
                                        className="slot-action-btn pencil"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleInventoryChange(i, containerId);
                                            setActiveSlotIndex(null);
                                        }}
                                        title="Editar Item"
                                    >
                                        <Pencil size={15} />
                                    </button>
                                )}
                                {isFilled && canEdit && (
                                    <button
                                        className="slot-action-btn clear"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClearInventorySlot(i, containerId);
                                            setActiveSlotIndex(null);
                                        }}
                                        title="Limpar Slot"
                                    >
                                        <X size={15} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderStorageSection = (container: Item) => {
        const currentCapacity = Math.max(container.capacity || 3, container.contents?.length || 0);
        const minimumCapacity = Math.max(1, getLastFilledSlotIndex(container.contents) + 1);
        const canRemove = currentCapacity > minimumCapacity;

        return (
        <div key={container.id} className="inventory-subsection">
            {renderSubsectionHeader(
                container.name || "ARMAZENAMENTO",
                () => handleExpandContainerSlots(container),
                () => handleReduceContainerSlots(container),
                {
                    showBackpack: true,
                    canRemove,
                }
            )}
            {renderInventorySlots(container.contents, container.capacity || 3, container.id, "VAZIO")}
        </div>
        );
    };

    return (
        <>
        <div 
            ref={containerRef}
            className={`inventory-container ${isFloating ? 'inventory-floating' : 'inventory-static'} ${isDragging ? 'dragging' : ''}`}
            style={isFloating ? { 
                left: `${dragPos.x}px`, 
                top: `${dragPos.y}px`,
                cursor: isDragging ? 'grabbing' : 'auto'
            } : {}}
        >
                <div 
                    className="readout-header mobile-col compact-header drag-handle"
                    onMouseDown={onMouseDownHeader}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    <div className="header-group">
                        <span className="symbol">🜏</span>
                        <span>INVENTÁRIO & ARSENAL</span>
                    </div>
                </div>
                <div className="inventory-inner">
                    {hasStorageTabs && (
                        <div className="inventory-tab-navigation">
                            <button
                                type="button"
                                className={`inventory-tab-btn ${activeInventoryTab === "all" ? "active" : ""}`}
                                onClick={() => setActiveInventoryTab("all")}
                            >
                                TODOS
                            </button>
                            <button
                                type="button"
                                className={`inventory-tab-btn ${activeInventoryTab === "main" ? "active" : ""}`}
                                onClick={() => setActiveInventoryTab("main")}
                            >
                                PRINCIPAL
                            </button>
                            {storageContainers.map((container) => (
                                <button
                                    key={container.id}
                                    type="button"
                                    className={`inventory-tab-btn ${activeInventoryTab === `container:${container.id}` ? "active" : ""}`}
                                    onClick={() => setActiveInventoryTab(`container:${container.id}`)}
                                >
                                    {(container.name || "ARMAZENAMENTO").toUpperCase()}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="inventory-tab-panel">
                        {!hasStorageTabs && (
                            <div className="inventory-subsection">
                                {renderSubsectionHeader(
                                    "Principal",
                                    handleAddMainInventorySlot,
                                    handleRemoveMainInventorySlot,
                                    { canRemove: mainInventorySlots > Math.max(1, getLastFilledSlotIndex(character.inventory) + 1) }
                                )}
                                {renderInventorySlots(character.inventory, mainInventorySlots, null, "SLOT VAZIO")}
                            </div>
                        )}

                        {hasStorageTabs && activeInventoryTab === "all" && (
                            <>
                                <div className="inventory-subsection">
                                    {renderSubsectionHeader(
                                        "Principal",
                                        handleAddMainInventorySlot,
                                        handleRemoveMainInventorySlot,
                                        { canRemove: mainInventorySlots > Math.max(1, getLastFilledSlotIndex(character.inventory) + 1) }
                                    )}
                                    {renderInventorySlots(character.inventory, mainInventorySlots, null, "SLOT VAZIO")}
                                </div>
                                {storageContainers.map((container) => renderStorageSection(container))}
                            </>
                        )}

                        {hasStorageTabs && activeInventoryTab === "main" && (
                            <div className="inventory-subsection">
                                {renderSubsectionHeader(
                                    "Principal",
                                    handleAddMainInventorySlot,
                                    handleRemoveMainInventorySlot,
                                    { canRemove: mainInventorySlots > Math.max(1, getLastFilledSlotIndex(character.inventory) + 1) }
                                )}
                                {renderInventorySlots(character.inventory, mainInventorySlots, null, "SLOT VAZIO")}
                            </div>
                        )}

                        {hasStorageTabs && activeInventoryTab.startsWith("container:") && (
                            <>
                                {storageContainers
                                    .filter((container) => activeInventoryTab === `container:${container.id}`)
                                    .map((container) => renderStorageSection(container))}
                            </>
                        )}
                    </div>
                </div>

                {/* Inventory Modal */}
                {inventoryModal && (
                    <div className="inventory-modal-overlay" onClick={() => {
                        setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } });
                        setInventoryModal(null);
                    }}>
                        <div className="inventory-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <span className="modal-symbol">🜏</span>
                                <span>EDITAR ITEM (SLOT {inventoryModal.index + 1})</span>
                            </div>

                            <div className="inv-modal-form">
                                {inventoryValidationError && (
                                    <div className="inv-modal-error" style={{
                                        background: 'rgba(255, 80, 80, 0.15)',
                                        border: '1px solid #ff5050',
                                        color: '#ff8080',
                                        padding: '10px',
                                        borderRadius: '4px',
                                        marginBottom: '16px',
                                        fontSize: '0.85rem',
                                        fontFamily: 'var(--font-header)',
                                        letterSpacing: '0.05em',
                                        textAlign: 'center'
                                    }}>
                                        ⚠️ {inventoryValidationError.toUpperCase()}
                                    </div>
                                )}
                                <div className="inv-modal-field">
                                    <label>NOME DO ITEM</label>
                                    <input
                                        ref={itemNameInputRef}
                                        type="text"
                                        className="inv-modal-input"
                                        placeholder="Nome do item..."
                                        value={inventoryModal.item.name}
                                        onChange={e => handleInventoryNameChange(e.target.value)}
                                        onFocus={() => updateInventoryNameSuggestions(inventoryModal.item.name)}
                                        onBlur={() => {
                                            window.setTimeout(() => {
                                                setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } });
                                            }, 150);
                                        }}
                                        autoFocus
                                    />
                                </div>
                                {inventoryItemSuggestions.active && (
                                    <MentionSuggestions
                                        query={inventoryItemSuggestions.query}
                                        entities={globalItemSuggestionEntities}
                                        onSelect={handleSelectInventorySuggestion}
                                        position={inventoryItemSuggestions.position}
                                        onClose={() => setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } })}
                                    />
                                )}

                                <div className="inv-modal-field">
                                    <label>DESCRICAO</label>
                                    <textarea
                                        className="inv-modal-textarea"
                                        placeholder="Descricao do item..."
                                        value={inventoryModal.item.description || ''}
                                        onChange={e => updateInventoryModalField('description', e.target.value)}
                                        rows={3}
                                    />
                                </div>

                                <div className="inv-modal-field">
                                    <label>URL DA IMAGEM/LINK</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            className="inv-modal-input"
                                            placeholder="https://..."
                                            value={inventoryModal.item.url || ''}
                                            onChange={e => updateInventoryModalField('url', e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        {isGM && (
                                            <button
                                                onClick={() => setShowVISelector(true)}
                                                title="Selecionar da VI"
                                                style={{
                                                    background: 'rgba(var(--accent-rgb), 0.1)',
                                                    border: '1px solid var(--accent-color)',
                                                    color: 'var(--accent-color)',
                                                    cursor: 'pointer',
                                                    padding: '0 12px',
                                                    fontSize: '1.2rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                🖼️
                                            </button>
                                        )}
                                        {inventoryModal.item.url && (
                                            <button
                                                onClick={() => window.open(inventoryModal.item.url, '_blank')}
                                                title="Abrir Link"
                                                style={{
                                                    background: 'rgba(var(--accent-rgb), 0.1)',
                                                    border: '1px solid var(--accent-color)',
                                                    color: 'var(--accent-color)',
                                                    cursor: 'pointer',
                                                    padding: '0 12px',
                                                    fontSize: '1.2rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                🔗
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="inv-modal-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                                    <input
                                        type="checkbox"
                                        id="inv-is-container"
                                        checked={inventoryModal.item.isContainer || false}
                                        onChange={e => updateInventoryModalField('isContainer', e.target.checked)}
                                        style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                                    />
                                    <label htmlFor="inv-is-container" style={{ cursor: 'pointer', fontSize: '1rem', color: 'var(--accent-color)' }}>
                                        ARMAZENAMENTO
                                    </label>
                                </div>

                                {inventoryModal.item.isContainer && (
                                    <div className="inv-modal-field">
                                        <label>CAPACIDADE (SLOTS)</label>
                                        <input
                                            type="number"
                                            className="inv-modal-input"
                                            value={inventoryModal.item.capacity || 3}
                                            onChange={e => updateInventoryModalField('capacity', parseInt(e.target.value) || 3)}
                                            min={1}
                                            max={20}
                                        />
                                    </div>
                                )}

                                <div className="inv-modal-row">
                                    <div className="inv-modal-field small">
                                        <label>BÔNUS</label>
                                        <input
                                            type="number"
                                            className="inv-modal-input"
                                            value={inventoryModal.item.bonus}
                                            onChange={e => updateInventoryModalField('bonus', parseInt(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="inv-modal-field small">
                                        <label>QTD ATUAL</label>
                                        <input
                                            type="number"
                                            className="inv-modal-input"
                                            min={0}
                                            value={inventoryModal.item.quantityCurrent ?? 1}
                                            onChange={e => updateInventoryModalField('quantityCurrent', parseInt(e.target.value) || 0)}
                                        />
                                    </div>

                                    <div className="inv-modal-field small">
                                        <label>QTD TOTAL</label>
                                        <input
                                            type="number"
                                            className="inv-modal-input"
                                            min={0}
                                            value={inventoryModal.item.quantityTotal ?? 1}
                                            onChange={e => updateInventoryModalField('quantityTotal', parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                {isGM && (
                                    <>
                                        <div className="inv-modal-field">
                                            <label>TAMANHO DO ITEM (L=Leve, M=Médio, G=Grande)</label>
                                            <div className="inv-size-selector">
                                                <button
                                                    type="button"
                                                    className={`size-btn size-l ${inventoryModal.item.size === 'L' ? 'active' : ''}`}
                                                    onClick={() => updateInventoryModalField('size', inventoryModal.item.size === 'L' ? undefined : 'L')}
                                                >
                                                    L
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`size-btn size-m ${inventoryModal.item.size === 'M' ? 'active' : ''}`}
                                                    onClick={() => updateInventoryModalField('size', inventoryModal.item.size === 'M' ? undefined : 'M')}
                                                >
                                                    M
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`size-btn size-g ${inventoryModal.item.size === 'G' ? 'active' : ''}`}
                                                    onClick={() => updateInventoryModalField('size', inventoryModal.item.size === 'G' ? undefined : 'G')}
                                                >
                                                    G
                                                </button>
                                            </div>
                                        </div>
                                        <div className="inv-modal-field" style={{ marginTop: '12px' }}>
                                            <label>RESTRIÇÀO DO SLOT (Opcional - L, M, G)</label>
                                            <div className="inv-size-selector">
                                                <button
                                                    type="button"
                                                    className={`size-btn size-l ${inventoryModal.item.maxSize === 'L' ? 'active' : ''}`}
                                                    onClick={() => updateInventoryModalField('maxSize', inventoryModal.item.maxSize === 'L' ? undefined : 'L')}
                                                >
                                                    L
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`size-btn size-m ${inventoryModal.item.maxSize === 'M' ? 'active' : ''}`}
                                                    onClick={() => updateInventoryModalField('maxSize', inventoryModal.item.maxSize === 'M' ? undefined : 'M')}
                                                >
                                                    M
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`size-btn size-g ${inventoryModal.item.maxSize === 'G' ? 'active' : ''}`}
                                                    onClick={() => updateInventoryModalField('maxSize', inventoryModal.item.maxSize === 'G' ? undefined : 'G')}
                                                >
                                                    G
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button className="modal-btn save" onClick={handleSaveInventoryItem}>
                                    CONFIRMAR
                                </button>
                                <button className="modal-btn cancel" onClick={() => {
                                    setInventoryItemSuggestions({ active: false, query: "", position: { top: 0, left: 0 } });
                                    setInventoryModal(null);
                                }}>
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* VI Selector Modal */}
                {showVISelector && (
                    <div className="vi-modal-overlay" onClick={() => setShowVISelector(false)}>
                        <div className="vi-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="vi-modal-header">
                                <h3>SELECIONAR IMAGEM DA VI</h3>
                                <button onClick={() => setShowVISelector(false)}>✕</button>
                            </div>
                            <VIControlPanel
                                sessionId={sessionId}
                                isGM={!!isGM}
                                onSelect={(url) => {
                                    if (inventoryModal) {
                                        updateInventoryModalField('url', url);
                                    }
                                    setShowVISelector(false);
                                }}
                                style={{ flex: 1, overflow: 'hidden', height: 'auto' }}
                            />
                        </div>
                    </div>
                )}

                {/* Image Viewer Modal */}
                {viewImageUrl && (
                    <div className="image-viewer-overlay" onClick={() => setViewImageUrl(null)}>
                        <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
                            <img src={viewImageUrl} alt="Visualização do Item" />
                            <button className="close-viewer-btn" onClick={() => setViewImageUrl(null)}>✕</button>
                        </div>
                    </div>
                )}
                <style jsx>{`
                    .inventory-tab-navigation {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        margin: 0 0 18px 0;
                        padding-bottom: 14px;
                        border-bottom: 1px solid rgba(var(--accent-rgb), 0.14);
                    }

                    .inventory-tab-btn {
                        background: rgba(var(--accent-rgb), 0.06);
                        border: 1px solid rgba(var(--accent-rgb), 0.14);
                        color: rgba(255, 255, 255, 0.72);
                        padding: 8px 12px;
                        border-radius: 999px;
                        font-family: var(--font-header);
                        font-size: 0.62rem;
                        letter-spacing: 0.16em;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }

                    .inventory-tab-btn:hover {
                        color: #f2e3b6;
                        border-color: rgba(var(--accent-rgb), 0.26);
                        background: rgba(var(--accent-rgb), 0.1);
                    }

                    .inventory-tab-btn.active {
                        color: var(--accent-color);
                        border-color: rgba(var(--accent-rgb), 0.34);
                        background: linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.08));
                        box-shadow: inset 0 -1px 0 rgba(var(--accent-rgb), 0.5);
                    }

                    .inventory-tab-panel {
                        display: flex;
                        flex-direction: column;
                        gap: 18px;
                    }

                    .inventory-subsection {
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }

                    .inventory-subsection-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 0 4px;
                    }

                    .inventory-subsection-title {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-family: var(--font-header);
                        font-size: 0.66rem;
                        letter-spacing: 0.18em;
                        color: rgba(var(--accent-rgb), 0.82);
                    }

                    .inventory-subsection-add {
                        width: 24px;
                        height: 24px;
                        border-radius: 999px;
                        border: 1px solid rgba(var(--accent-rgb), 0.22);
                        background: rgba(var(--accent-rgb), 0.08);
                        color: var(--accent-color);
                        font-family: var(--font-header);
                        font-size: 0.92rem;
                        line-height: 1;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    }

                    .inventory-subsection-add:hover {
                        border-color: rgba(var(--accent-rgb), 0.36);
                        background: rgba(var(--accent-rgb), 0.14);
                    }

                    .inv-size-indicator.restriction {
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px dashed rgba(var(--accent-rgb), 0.3);
                        opacity: 0.6;
                    }
                `}</style>
        </div>
        </>
    );
}
