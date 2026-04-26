"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Minus } from "lucide-react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Aspect, AspectScope } from "@/types/domain";

interface AspectManagerProps {
    sessionId: string;
    actorUserId: string;
    aspects: Aspect[];
    onClose: () => void;
}

export function AspectManager({ sessionId, actorUserId, aspects, onClose }: AspectManagerProps) {
    const [name, setName] = useState("");
    const [scope, setScope] = useState<AspectScope>("SCENE");
    const [freeInvokes, setFreeInvokes] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
            setMounted(false);
        };
    }, []);

    const handleCreateAspect = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "ASPECT_CREATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                id: uuidv4(),
                name: name.trim(),
                scope,
                freeInvokes,
                revealed: true
            }
        } as any);
        setName("");
        setFreeInvokes(0);
    };

    const handleInvoke = (aspectId: string, amount: number) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: amount > 0 ? "FREE_INVOKE_PRODUCED" : "FREE_INVOKE_CONSUMED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { aspectId, amount: Math.abs(amount) }
        } as any);
    };

    if (!mounted) return null;

    return createPortal(
        <div className="mystic-modal-overlay tarot-reveal" onClick={onClose}>
            <div className="mystic-modal-container" onClick={e => e.stopPropagation()}>
                <div className="ritual-header">
                    <span className="ritual-title">MANIFESTAÇÀO DE CONCEITOS</span>
                    <button onClick={onClose} className="ritual-close-btn">
                        <X size={20} />
                    </button>
                </div>

                <div className="ritual-content">
                    <form onSubmit={handleCreateAspect} className="occult-form">
                        <div className="input-field">
                            <label>TECER NOVO ASPECTO</label>
                            <input
                                placeholder="Descreva a verdade desta cena..."
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="occult-input"
                            />
                        </div>

                        <div className="dual-inputs">
                            <div className="input-field">
                                <label>ALCANCE</label>
                                <select
                                    value={scope}
                                    onChange={e => setScope(e.target.value as AspectScope)}
                                    className="occult-select"
                                >
                                    <option value="SCENE">SESSÀO / CENA</option>
                                    <option value="ZONE">LOCAL (ESFERA)</option>
                                    <option value="CHARACTER">VÍNCULO (PERSONAGEM)</option>
                                </select>
                            </div>
                            <div className="input-field">
                                <label>INV. LIVRES</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={freeInvokes}
                                    onChange={e => setFreeInvokes(parseInt(e.target.value) || 0)}
                                    className="occult-input"
                                />
                            </div>
                        </div>

                        <button type="submit" className="ritual-action-btn">
                            MANIFESTAR ASPECTO
                        </button>
                    </form>

                    <div className="active-concepts-section">
                        <div className="section-header">ASPECTOS ATIVOS NA RESONÂNCIA</div>

                        <div className="aspects-list">
                            {aspects.length === 0 ? (
                                <div className="empty-readout">NENHUMA VERDADE ATIVA.</div>
                            ) : (
                                aspects.map(a => (
                                    <div key={a.id} className="aspect-item">
                                        <div className="aspect-info">
                                            <span className="aspect-scope">::{a.scope}</span>
                                            <span className="aspect-name">{a.name.toUpperCase()}</span>
                                        </div>
                                        <div className="aspect-controls">
                                            <span className="invoke-count">{a.freeInvokes}</span>
                                            <div className="control-btns">
                                                <button onClick={() => handleInvoke(a.id, -1)} className="control-btn"><Minus size={12} /></button>
                                                <button onClick={() => handleInvoke(a.id, 1)} className="control-btn"><Plus size={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .mystic-modal-overlay {
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

                .mystic-modal-container {
                    width: 100%;
                    max-width: 500px;
                    background: #0a0a0a;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 0 60px rgba(0,0,0,0.9);
                    max-height: 90vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .ritual-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 30px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.1);
                }

                .ritual-title {
                    font-family: var(--font-header);
                    font-size: 0.7rem;
                    letter-spacing: 0.25em;
                    color: var(--accent-color);
                }

                .ritual-close-btn {
                    background: transparent;
                    border: none;
                    color: var(--accent-color);
                    cursor: pointer;
                    opacity: 0.6;
                }

                .ritual-content {
                    padding: 30px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }

                .occult-form {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .input-field {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .input-field label {
                    font-family: var(--font-header);
                    font-size: 0.55rem;
                    color: var(--accent-color);
                    opacity: 0.7;
                    letter-spacing: 0.1em;
                }

                .occult-input, .occult-select {
                    background: rgba(197, 160, 89, 0.03);
                    border: 1px solid rgba(197, 160, 89, 0.15);
                    padding: 12px 16px;
                    color: white;
                    font-family: var(--font-main);
                    outline: none;
                }

                .occult-select {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23C5A059' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 15px center;
                }

                .dual-inputs {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 15px;
                }

                .ritual-action-btn {
                    height: 50px;
                    background: transparent;
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 0.8rem;
                    letter-spacing: 0.15em;
                    cursor: pointer;
                    transition: 0.3s;
                }

                .ritual-action-btn:hover {
                    background: var(--accent-color);
                    color: #000;
                    box-shadow: 0 0 20px var(--accent-glow);
                }

                .active-concepts-section {
                    border-top: 1px solid rgba(197, 160, 89, 0.15);
                    padding-top: 25px;
                }

                .section-header {
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    color: var(--accent-color);
                    margin-bottom: 20px;
                    opacity: 0.6;
                    text-align: center;
                }

                .aspects-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .aspect-item {
                    background: rgba(197, 160, 89, 0.02);
                    padding: 12px 18px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-left: 1px solid var(--accent-color);
                }

                .aspect-info {
                    display: flex;
                    flex-direction: column;
                }

                .aspect-scope {
                    font-size: 0.5rem;
                    color: var(--accent-color);
                    opacity: 0.5;
                }

                .aspect-name {
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                }

                .aspect-controls {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .invoke-count {
                    font-family: var(--font-header);
                    font-size: 1.4rem;
                    color: var(--accent-color);
                    min-width: 30px;
                    text-align: right;
                }

                .control-btns {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .control-btn {
                    background: transparent;
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    color: var(--accent-color);
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }

                .empty-readout {
                    text-align: center;
                    font-style: italic;
                    font-size: 0.8rem;
                    opacity: 0.4;
                    padding: 20px;
                }

                @keyframes tarotReveal {
                    from { opacity: 0; transform: scale(0.98) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .tarot-reveal {
                    animation: tarotReveal 0.5s ease-out forwards;
                }
            `}</style>
        </div>,
        document.body
    );
}
