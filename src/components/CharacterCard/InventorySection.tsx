"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Backpack } from "lucide-react";
import { Character, Item } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { VIControlPanel } from "@/components/VIControlPanel";

interface InventorySectionProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    canEdit: boolean;
    isGM: boolean;
    isFloating?: boolean;
}

export function InventorySection({ character, sessionId, actorUserId, canEdit, isGM, isFloating = true }: InventorySectionProps) {
    const [inventoryModal, setInventoryModal] = useState<{ index: number; item: Item; containerId: string | null } | null>(null);
    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | string | null>(null);
    const [activeInventoryTab, setActiveInventoryTab] = useState<string>("main");
    const [showVISelector, setShowVISelector] = useState(false);

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
        () => Math.max(5, character.inventory?.length || 0),
        [character.inventory]
    );
    const hasStorageTabs = storageContainers.length > 0;
    const storageTabsKey = storageContainers.map((container) => container.id).join("|");

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
            const container = character.inventory.find(i => i.id === containerId);
            currentItem = container?.contents?.[index] || {
                id: uuidv4(),
                name: "",
                description: "",
                bonus: 0,
                quantityCurrent: 1,
                quantityTotal: 1,
                size: undefined
            };
        } else {
            currentItem = character.inventory?.[index] || {
                id: uuidv4(),
                name: "",
                description: "",
                bonus: 0,
                quantityCurrent: 1,
                quantityTotal: 1,
                size: undefined
            };
        }
        setInventoryModal({ index, item: { ...currentItem }, containerId });
    };

    const handleSaveInventoryItem = () => {
        if (!inventoryModal) return;

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
            contents: inventoryModal.item.contents || []
        };

        if (inventoryModal.containerId) {
            // Saving item INSIDE a container
            const container = character.inventory.find(i => i.id === inventoryModal.containerId);
            if (container) {
                const newContents = [...(container.contents || [])];
                // Resize if needed
                while (newContents.length <= inventoryModal.index) {
                    newContents.push({ id: uuidv4(), name: "", bonus: 0 }); // Placeholder
                }
                newContents[inventoryModal.index] = newItem;

                const updatedContainer = { ...container, contents: newContents };

                globalEventStore.append({
                    id: uuidv4(),
                    sessionId,
                    seq: 0,
                    type: "CHARACTER_INVENTORY_UPDATED",
                    actorUserId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { characterId: character.id, item: updatedContainer }
                } as any);
            }
        } else {
            // Saving a root item (which might be a container)
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "CHARACTER_INVENTORY_UPDATED",
                actorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId: character.id, item: newItem }
            } as any);
        }

        setInventoryModal(null);
    };

    const updateInventoryModalField = (field: keyof Item, value: any) => {
        if (!inventoryModal) return;
        setInventoryModal({
            ...inventoryModal,
            item: { ...inventoryModal.item, [field]: value }
        });
    };

    const handleUpdateItemQuantity = (index: number, delta: number, containerId: string | null = null) => {
        if (containerId) {
            const container = character.inventory.find(i => i.id === containerId);
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
                actorUserId,
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
                actorUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId: character.id, item: updatedItem }
            } as any);
        }
    };

    const handleAddMainInventorySlot = () => {
        if (!isGM) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_INVENTORY_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                characterId: character.id,
                item: {
                    id: uuidv4(),
                    name: "",
                    description: "",
                    bonus: 0,
                    quantityCurrent: 1,
                    quantityTotal: 1,
                    size: undefined,
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
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, item: updatedContainer }
        } as any);
    };

    const renderSubsectionHeader = (
        title: string,
        onAddSlot?: () => void,
        options?: { showBackpack?: boolean }
    ) => (
        <div className="inventory-subsection-header">
            <div className="inventory-subsection-title">
                {options?.showBackpack && <Backpack size={15} />}
                <span>{title.toUpperCase()}</span>
            </div>
            {isGM && onAddSlot && (
                <button
                    type="button"
                    className="inventory-subsection-add"
                    onClick={onAddSlot}
                    title={`Adicionar slot em ${title.toLowerCase()}`}
                >
                    +
                </button>
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
                const sizeClass = item?.size ? `size-${item.size.toLowerCase()}` : "";
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
                                                {item.description}
                                            </div>
                                        )}
                                    </div>
                                    {isFilled && item.size && (
                                        <div className={`inv-size-indicator size-${item.size.toLowerCase()}`}>
                                            {item.size}
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
                                                {item.description}
                                            </div>
                                        )}
                                    </div>
                                    {isFilled && item.size && (
                                        <div className={`inv-size-indicator size-${item.size.toLowerCase()}`}>
                                            {item.size}
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
                                        👁️
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
                                        ✎
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderStorageSection = (container: Item) => (
        <div key={container.id} className="inventory-subsection">
            {renderSubsectionHeader(container.name || "ARMAZENAMENTO", () => handleExpandContainerSlots(container), {
                showBackpack: true,
            })}
            {renderInventorySlots(container.contents, container.capacity || 3, container.id, "VAZIO")}
        </div>
    );

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
                                {renderSubsectionHeader("Principal", handleAddMainInventorySlot)}
                                {renderInventorySlots(character.inventory, mainInventorySlots, null, "SLOT VAZIO")}
                            </div>
                        )}

                        {hasStorageTabs && activeInventoryTab === "all" && (
                            <>
                                <div className="inventory-subsection">
                                    {renderSubsectionHeader("Principal", handleAddMainInventorySlot)}
                                    {renderInventorySlots(character.inventory, mainInventorySlots, null, "SLOT VAZIO")}
                                </div>
                                {storageContainers.map((container) => renderStorageSection(container))}
                            </>
                        )}

                        {hasStorageTabs && activeInventoryTab === "main" && (
                            <div className="inventory-subsection">
                                {renderSubsectionHeader("Principal", handleAddMainInventorySlot)}
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
                    <div className="inventory-modal-overlay" onClick={() => setInventoryModal(null)}>
                        <div className="inventory-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <span className="modal-symbol">🜏</span>
                                <span>EDITAR ITEM (SLOT {inventoryModal.index + 1})</span>
                            </div>

                            <div className="inv-modal-form">
                                <div className="inv-modal-field">
                                    <label>NOME DO ITEM</label>
                                    <input
                                        type="text"
                                        className="inv-modal-input"
                                        placeholder="Nome do item..."
                                        value={inventoryModal.item.name}
                                        onChange={e => updateInventoryModalField('name', e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="inv-modal-field">
                                    <label>DESCRIÇÃO</label>
                                    <textarea
                                        className="inv-modal-textarea"
                                        placeholder="Descrição do item..."
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
                                                    background: 'rgba(197, 160, 89, 0.1)',
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
                                                    background: 'rgba(197, 160, 89, 0.1)',
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

                                {/* Armazenamento / Backpack Toggle */}
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

                                {/* Size selector - GM only */}
                                {isGM && (
                                    <div className="inv-modal-field">
                                        <label>TAMANHO (L=Leve, M=Médio, G=Grande)</label>
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
                                )}
                            </div>

                            <div className="modal-actions">
                                <button className="modal-btn save" onClick={handleSaveInventoryItem}>
                                    CONFIRMAR
                                </button>
                                <button className="modal-btn cancel" onClick={() => setInventoryModal(null)}>
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                )
                }

                {/* VI Selector Modal */}
                {
                    showVISelector && (
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
                    )
                }

                {/* Image Viewer Modal */}
                {
                    viewImageUrl && (
                        <div className="image-viewer-overlay" onClick={() => setViewImageUrl(null)}>
                            <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
                                <img src={viewImageUrl} alt="Visualização do Item" />
                                <button className="close-viewer-btn" onClick={() => setViewImageUrl(null)}>✕</button>
                            </div>
                        </div>
                    )
                }
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
                `}</style>
        </>
    );
}
