"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Character } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { ArrowUp, ArrowDown, Check, X, ListOrdered } from "lucide-react";

interface TurnOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    characters: Character[];
    sessionId: string;
    actorUserId: string;
    initialOrder?: string[];
}

export function TurnOrderModal({ isOpen, onClose, characters, sessionId, actorUserId, initialOrder }: TurnOrderModalProps) {
    const [order, setOrder] = useState<Character[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = "hidden";
            let sorted: Character[] = [];

            if (initialOrder && initialOrder.length > 0) {
                // Use existing order but filter only active ones
                const characterMap = new Map(characters.map(c => [c.id, c]));
                sorted = initialOrder
                    .map(id => characterMap.get(id))
                    .filter((c): c is Character => !!c);

                // Add any missing characters that are in session but not in order
                const orderedIds = new Set(initialOrder);
                const missing = characters.filter(c => !orderedIds.has(c.id));
                sorted = [...sorted, ...missing];
            } else {
                // Default order as provided (alphabetical or insertion)
                sorted = [...characters];
            }
            setOrder(sorted);
        }
        return () => {
            document.body.style.overflow = "unset";
        };
        // Disable exhaustive-deps to prevent re-sorting when characters change while modal is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newOrder = [...order];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        setOrder(newOrder);
    };

    const moveDown = (index: number) => {
        if (index === order.length - 1) return;
        const newOrder = [...order];
        [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
        setOrder(newOrder);
    };

    const handleConfirm = () => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "TURN_ORDER_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterIds: order.map(c => c.id) }
        } as any);
        onClose();
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="turn-order-overlay tarot-reveal" onClick={onClose}>
            <div className="turn-order-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="ritual-header">
                    <div className="ritual-header-left">
                        <ListOrdered size={18} className="ritual-icon" />
                        <h3 className="ritual-title">ORDEM DE TURNO</h3>
                    </div>
                    <button onClick={onClose} className="ritual-close-btn">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="ritual-content custom-scrollbar">
                    <div className="order-list">
                        {order.map((char, index) => {
                            const sideColor = char.isHazard ? '#a855f7' : char.arenaSide === 'THREAT' ? '#ff4444' : char.arenaSide === 'HERO' ? (char.isNPC ? '#50a6ff' : '#c5a059') : '#c5a059';

                            return (
                                <div
                                    key={char.id}
                                    className="order-item group"
                                >
                                    <div
                                        className="index-badge"
                                        style={{ backgroundColor: `${sideColor}15`, color: sideColor, border: `1px solid ${sideColor}40` }}
                                    >
                                        {index + 1}
                                    </div>

                                    <div className="char-info">
                                        <div className="char-name">
                                            {char.name.toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="order-actions">
                                        <button
                                            onClick={() => moveUp(index)}
                                            disabled={index === 0}
                                            className="action-btn"
                                            title="Mover para cima"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                        <button
                                            onClick={() => moveDown(index)}
                                            disabled={index === order.length - 1}
                                            className="action-btn"
                                            title="Mover para baixo"
                                        >
                                            <ArrowDown size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="ritual-footer">
                    <button
                        onClick={onClose}
                        className="footer-btn cancel"
                    >
                        CANCELAR
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="footer-btn confirm"
                    >
                        <Check size={16} /> CONFIRMAR ORDEM
                    </button>
                </div>
            </div>

            <style jsx>{`
                .turn-order-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    display: grid;
                    place-items: center;
                    z-index: 99999;
                    padding: 20px;
                }

                .turn-order-container {
                    width: 100%;
                    max-width: 480px;
                    background: #0a0a0a;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 20px rgba(197, 160, 89, 0.1);
                    position: relative;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                }

                .ritual-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 30px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.1);
                    background: rgba(197, 160, 89, 0.02);
                }

                .ritual-header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .ritual-icon {
                    color: var(--accent-color);
                    opacity: 0.8;
                }

                .ritual-title {
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.3em;
                    color: var(--accent-color);
                    text-transform: uppercase;
                    margin: 0;
                }

                .ritual-close-btn {
                    background: transparent;
                    border: none;
                    color: var(--accent-color);
                    cursor: pointer;
                    opacity: 0.6;
                    transition: all 0.3s;
                }

                .ritual-close-btn:hover {
                    opacity: 1;
                    transform: rotate(90deg);
                }

                .ritual-content {
                    padding: 30px;
                    overflow-y: auto;
                    flex: 1;
                }

                .order-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .order-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 12px 16px;
                    background: rgba(197, 160, 89, 0.03);
                    border: 1px solid rgba(197, 160, 89, 0.1);
                    transition: all 0.3s;
                }

                .order-item:hover {
                    border-color: rgba(197, 160, 89, 0.4);
                    background: rgba(197, 160, 89, 0.06);
                }

                .index-badge {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: bold;
                    flex-shrink: 0;
                }

                .char-info {
                    flex: 1;
                    min-width: 0;
                }

                .char-name {
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                    color: white;
                    letter-spacing: 0.1em;
                    margin-bottom: 2px;
                    /* margin-bottom: 2px; */ /* Removed as char-meta is gone */
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .order-actions {
                    display: flex;
                    gap: 4px;
                    opacity: 0.4;
                    transition: opacity 0.3s;
                }

                .order-item:hover .order-actions {
                    opacity: 1;
                }

                .action-btn {
                    padding: 6px;
                    background: transparent;
                    border: 1px solid rgba(197, 160, 89, 0.1);
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .action-btn:hover:not(:disabled) {
                    background: rgba(197, 160, 89, 0.2);
                    color: var(--accent-color);
                    border-color: var(--accent-color);
                }

                .action-btn:disabled {
                    opacity: 0.2;
                    cursor: not-allowed;
                }

                .ritual-footer {
                    padding: 20px 30px;
                    border-top: 1px solid rgba(197, 160, 89, 0.1);
                    background: rgba(197, 160, 89, 0.02);
                    display: flex;
                    gap: 15px;
                }

                .footer-btn {
                    flex: 1;
                    height: 48px;
                    border: 1px solid var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.15em;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .footer-btn.cancel {
                    background: transparent;
                    color: var(--accent-color);
                    opacity: 0.6;
                }

                .footer-btn.cancel:hover {
                    opacity: 1;
                    background: rgba(197, 160, 89, 0.05);
                }

                .footer-btn.confirm {
                    background: var(--accent-color);
                    color: #000;
                    font-weight: bold;
                }

                .footer-btn.confirm:hover {
                    box-shadow: 0 0 20px var(--accent-glow);
                    transform: translateY(-2px);
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0a0a0c;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #c5a05930;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #c5a05950;
                }

                @keyframes tarotReveal {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .tarot-reveal {
                    animation: tarotReveal 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
            `}</style>
        </div>,
        document.body
    );
}
