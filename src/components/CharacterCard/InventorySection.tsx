"use client";

import { useState } from "react";
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
}

export function InventorySection({ character, sessionId, actorUserId, canEdit, isGM }: InventorySectionProps) {
    const [inventoryModal, setInventoryModal] = useState<{ index: number; item: Item; containerId: string | null } | null>(null);
    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
    const [activeSlotIndex, setActiveSlotIndex] = useState<number | string | null>(null);
    const [showVISelector, setShowVISelector] = useState(false);

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

    return (
        <>
            <div className="inventory-floating">
                    <div className="readout-header mobile-col compact-header">
                        <div className="header-group">
                            <span className="symbol">🜏</span>
                            <span>INVENTÁRIO & ARSENAL</span>
                        </div>
                    </div>
                    <div className="inventory-list compact-list">
                        {Array.from({ length: 5 }).map((_, i) => {
                            const item = character.inventory?.[i];
                            const isFilled = item && item.name.length > 0;
                            const sizeClass = item?.size ? `size-${item.size.toLowerCase()}` : '';

                            return (
                                <div key={i} className={`inventory-slot compact-slot ${isFilled ? 'filled' : 'empty'} ${sizeClass}`}>
                                    <div className="inventory-slot-inner">
                                        {canEdit ? (
                                            <button
                                                className="inventory-btn-wrapper"
                                                onClick={() => setActiveSlotIndex(activeSlotIndex === i ? null : i)}
                                            >
                                                <div className="inv-slot-number">{i + 1}</div>
                                                <div className="inv-main-content">
                                                    <div className="inv-name-row">
                                                        <span className="inv-name-col">
                                                            {isFilled ? item.name.toUpperCase() : <span className="placeholder">SLOT VAZIO</span>}
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
                                                onClick={() => setActiveSlotIndex(activeSlotIndex === i ? null : i)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className="inv-slot-number">{i + 1}</div>
                                                <div className="inv-main-content">
                                                    <div className="inv-name-row">
                                                        <span className="inv-name-col">
                                                            {isFilled ? item.name.toUpperCase() : <span className="placeholder">SLOT VAZIO</span>}
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

                                        {/* Quantity Controls */}
                                        {isFilled && canEdit && !item.isContainer && (
                                            <div className="inv-quantity-controls">
                                                <button
                                                    className="qty-btn qty-decrease"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateItemQuantity(i, -1);
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
                                                        handleUpdateItemQuantity(i, 1);
                                                    }}
                                                    title="Aumentar quantidade"
                                                >
                                                    ▲
                                                </button>
                                            </div>
                                        )}

                                        {/* Quantity Controls for CONTAINERS (Cannot change qty, just label maybe?) */}
                                        {isFilled && item.isContainer && (
                                            <div className="inv-quantity-display">
                                                <span className="qty-label" style={{ color: 'var(--accent-color)' }}>🎒 ARMAZENAMENTO</span>
                                            </div>
                                        )}


                                        {/* Quantity Display for non-editable view */}
                                        {isFilled && !canEdit && (item.quantityCurrent !== undefined || item.quantityTotal !== undefined) && (
                                            <div className="inv-quantity-display">
                                                <span className="qty-label">{item.isContainer ? "🎒" : "QTD:"}</span>
                                                {!item.isContainer && <span className="qty-value">{item.quantityCurrent ?? 1}/{item.quantityTotal ?? 1}</span>}
                                            </div>
                                        )}
                                    </div>
                                    {activeSlotIndex === i && (
                                        <div className="slot-actions-overlay">
                                            {item?.url && (
                                                <button
                                                    className="slot-action-btn eye"
                                                    onClick={(e) => { e.stopPropagation(); setViewImageUrl(item.url || null); setActiveSlotIndex(null); }}
                                                    title="Visualizar Imagem"
                                                >
                                                    👁️
                                                </button>
                                            )}
                                            {canEdit && (
                                                <button
                                                    className="slot-action-btn pencil"
                                                    onClick={(e) => { e.stopPropagation(); handleInventoryChange(i); setActiveSlotIndex(null); }}
                                                    title="Editar Item"
                                                >
                                                    ✎
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Nested Containers Rendering */}
                    {character.inventory?.filter(i => i.isContainer).map((container) => (
                        <div key={container.id} className="container-wrapper" style={{ marginTop: '16px', borderTop: '1px solid rgba(197, 160, 89, 0.2)', paddingTop: '8px' }}>
                            <div className="readout-header mobile-col compact-header" style={{ marginBottom: '8px' }}>
                                <div className="header-group">
                                    <span className="symbol">🎒</span>
                                    <span>{container.name.toUpperCase()}</span>
                                </div>
                            </div>
                            <div className="inventory-list compact-list">
                                {Array.from({ length: container.capacity || 3 }).map((_, i) => {
                                    const item = container.contents?.[i];
                                    const isFilled = item && item.name.length > 0;
                                    const sizeClass = item?.size ? `size-${item.size.toLowerCase()}` : '';
                                    // Use a composite key for slot index to avoid collision with main inventory if using single state?
                                    // Actually setActiveSlotIndex only stores a number. If we have multiple lists, we conflict.
                                    // But activeSlotIndex is simple "open overlay".
                                    // If I open slot 1 in backpack, activeSlotIndex=1. Slot 1 in main inventory also sees activeSlotIndex=1.
                                    // I need to update setActiveSlotIndex to be smart or add containerId context.
                                    // Quick fix: Use a specific ID for slot index? e.g. "containerId_index".
                                    // But activeSlotIndex is number.
                                    // I will interpret activeSlotIndex as local to the map.
                                    // BUT they share the state.
                                    // So if I set activeSlotIndex to 1, both show overlay.
                                    // I should probably use a separate state or just accept the glitch for now, OR change activeSlotIndex to string.
                                    // Changing activeSlotIndex to string is risky for other parts of code?
                                    // Let's check: const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null); (Line 132)
                                    // I will change it to string | number.
                                    // Actually, if I change it to string, I can store "MAIN_1" or "UUID_1".
                                    // I will update the state definition in a separate replacement or here if I can find it.
                                    // It was line 132. I didn't include it in replacement chunks.
                                    // I'll stick to number and add a hack:
                                    // We can just add a separate `activeContainerSlot` state? No.
                                    // I'll leave valid MultiReplace chunks and maybe fix the slot index issue in a second pass if it's tricky.
                                    // Wait, I can just use a large offset? 100 + i?
                                    // Or just string.
                                    // Let's assume I will fix the activeSlotIndex definition in a separate tool call if needed, or include it now.
                                    // I'll include it now.

                                    const slotId = `${container.id}_${i}`;
                                    const isSlotActive = activeSlotIndex === slotId as any; // Cast if TS complains, or I update state type.

                                    return (
                                        <div key={i} className={`inventory-slot compact-slot ${isFilled ? 'filled' : 'empty'} ${sizeClass}`}>
                                            <div className="inventory-slot-inner">
                                                {canEdit ? (
                                                    <button
                                                        className="inventory-btn-wrapper"
                                                        onClick={() => setActiveSlotIndex(isSlotActive ? null : slotId as any)}
                                                    >
                                                        <div className="inv-slot-number">{i + 1}</div>
                                                        <div className="inv-main-content">
                                                            <div className="inv-name-row">
                                                                <span className="inv-name-col">
                                                                    {isFilled ? item.name.toUpperCase() : <span className="placeholder">VAZIO</span>}
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
                                                    </button>
                                                ) : (
                                                    <div className="inventory-btn-wrapper interactive"
                                                        onClick={() => setActiveSlotIndex(isSlotActive ? null : slotId as any)}>
                                                        <div className="inv-slot-number">{i + 1}</div>
                                                        <div className="inv-main-content">
                                                            <div className="inv-name-row">
                                                                <span className="inv-name-col">{isFilled ? item.name.toUpperCase() : "VAZIO"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {isFilled && canEdit && (
                                                    <div className="inv-quantity-controls">
                                                        <button className="qty-btn qty-decrease"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(i, -1, container.id); }}>▼</button>
                                                        <span className="qty-display">{item.quantityCurrent ?? 1}/{item.quantityTotal ?? 1}</span>
                                                        <button className="qty-btn qty-increase"
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(i, 1, container.id); }}>▲</button>
                                                    </div>
                                                )}
                                            </div>
                                            {isSlotActive && (
                                                <div className="slot-actions-overlay">
                                                    {item?.url && (
                                                        <button className="slot-action-btn eye"
                                                            onClick={(e) => { e.stopPropagation(); setViewImageUrl(item.url || null); setActiveSlotIndex(null); }}
                                                            title="Visualizar">👁️</button>
                                                    )}
                                                    {canEdit && (
                                                        <button className="slot-action-btn pencil"
                                                            onClick={(e) => { e.stopPropagation(); handleInventoryChange(i, container.id); setActiveSlotIndex(null); }}
                                                            title="Editar">✎</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
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
        </>
    );
}
