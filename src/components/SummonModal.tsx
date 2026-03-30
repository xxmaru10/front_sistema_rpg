"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users } from "lucide-react";
import { Character } from "@/types/domain";

interface SummonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSummon: (characterId: string | null, shouldClone: boolean, hazardData?: { name: string; difficulty: number }) => void;
    availableCharacters: Character[];
    title?: string;
}

export function SummonModal({ isOpen, onClose, onSummon, availableCharacters, title = "CONVOCAR INIMIGO" }: SummonModalProps) {
    const [mode, setMode] = useState<"NPC" | "HAZARD">("NPC");
    const [selectedCharId, setSelectedCharId] = useState<string>("");
    const [shouldClone, setShouldClone] = useState(false);
    const [hazardName, setHazardName] = useState("");
    const [hazardDiff, setHazardDiff] = useState(4);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.body.style.overflow = "unset";
            setMounted(false);
        };
    }, [isOpen]);

    // Pre-select first character when modal opens and none is selected
    useEffect(() => {
        if (isOpen && availableCharacters.length > 0 && !selectedCharId) {
            setSelectedCharId(availableCharacters[0].id);
        }
    }, [isOpen, availableCharacters.length]);

    // Update shouldClone when selection changes
    /*useEffect(() => {
        if (selectedCharId) {
            const char = availableCharacters.find(c => c.id === selectedCharId);
            if (char) {
                 setShouldClone(!char.activeInArena);
            }
        }
    }, [selectedCharId, availableCharacters]);*/
    // Commented out to avoid overriding user manual toggle if they click around. 
    // Maybe only do it on initial open? Or is it better to be reactive? 
    // Reactive is usually better for "Smart" defaults. Let's enable it but maybe be careful.
    // Actually, simple is better. Let the user toggle.

    // Better implementation of selection change:
    const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedCharId(newId);
    };

    if (!isOpen || !mounted) return null;

    const handleSummon = () => {
        if (mode === "NPC") {
            if (selectedCharId) {
                onSummon(selectedCharId, shouldClone);
                onClose();
            }
        } else {
            if (hazardName.trim()) {
                // Pass hazard data as special payload? 
                // Let's pass it through characterId as a prefix or update onSummon signature.
                // Updating onSummon signature is better.
                onSummon(null, false, { name: hazardName, difficulty: hazardDiff });
                onClose();
            }
        }
    };

    return createPortal(
        <div className="mystic-modal-overlay tarot-reveal" onClick={onClose}>
            <div className="mystic-modal-container" onClick={e => e.stopPropagation()}>
                <div className="ritual-header">
                    <span className="ritual-title">{mode === "NPC" ? title : "CRIAR DESAFIO NO COMBATE"}</span>
                    <button onClick={onClose} className="ritual-close-btn">
                        <X size={20} />
                    </button>
                </div>

                <div className="ritual-content">
                    {/* Mode Toggle */}
                    <div className="mode-toggle">
                        <button
                            className={`toggle-btn ${mode === "NPC" ? "active" : ""}`}
                            onClick={() => setMode("NPC")}
                        >
                            NPC EXISTENTE
                        </button>
                        <button
                            className={`toggle-btn ${mode === "HAZARD" ? "active" : ""}`}
                            onClick={() => setMode("HAZARD")}
                        >
                            NOVO DESAFIO
                        </button>
                    </div>

                    {mode === "NPC" ? (
                        availableCharacters.length === 0 ? (
                            <div className="empty-state-message">
                                Nenhum NPC disponível na aba de Personagens (I).
                                <br />
                                Crie um NPC lá primeiro para poder convocá-lo aqui.
                            </div>
                        ) : (
                            <div className="input-field">
                                <label>SELECIONE A AMEAÇA</label>
                                <div className="select-wrapper">
                                    <Users className="select-icon" size={16} />
                                    <select
                                        className="occult-input"
                                        value={selectedCharId}
                                        onChange={handleSelectionChange}
                                        autoFocus
                                    >
                                        {availableCharacters.map(char => (
                                            <option key={char.id} value={char.id}>
                                                {char.name.toUpperCase()} {char.activeInArena ? "(EM COMBATE)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <label className="checkbox-field" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={shouldClone}
                                        onChange={e => setShouldClone(e.target.checked)}
                                        style={{ width: '16px', height: '16px', accentColor: '#c5a059' }}
                                    />
                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                        CRIAR CÓPIA (CLONE)
                                    </span>
                                </label>

                                <span className="type-hint">
                                    {shouldClone
                                        ? "Criará uma nova ficha com estresse zerado."
                                        : "Usará a ficha original. Se já estiver na arena, apenas mudará de lado."}
                                </span>
                            </div>
                        )
                    ) : (
                        <div className="input-field challenge-mode">
                            <label>NOME DO DESAFIO (EX: MURO DE FOGO)</label>
                            <input
                                type="text"
                                className="occult-input"
                                placeholder="QUAL O DESAFIO?"
                                value={hazardName}
                                onChange={e => setHazardName(e.target.value)}
                                autoFocus
                            />

                            <label style={{ marginTop: '15px' }}>DIFICULDADE (NÍVEL)</label>
                            <div className="diff-input-group">
                                <input
                                    type="number"
                                    className="occult-input"
                                    value={hazardDiff}
                                    onChange={e => setHazardDiff(parseInt(e.target.value) || 0)}
                                />
                                <span className="type-hint">A dificuldade será exibida no card roxo.</span>
                            </div>
                        </div>
                    )}

                    <div className="modal-actions">
                        <button
                            className="ritual-action-btn"
                            onClick={handleSummon}
                            disabled={mode === "NPC" ? !selectedCharId : !hazardName.trim()}
                        >
                            {mode === "NPC" ? "CONVOCAR" : "MANIFESTAR DESAFIO"}
                        </button>
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
                    max-width: 480px;
                    background: #0a0a0a;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 20px rgba(197, 160, 89, 0.1);
                    position: relative;
                }

                .ritual-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 30px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.1);
                    background: rgba(197, 160, 89, 0.02);
                }

                .ritual-title {
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.3em;
                    color: var(--accent-color);
                    text-transform: uppercase;
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
                    padding: 40px 30px;
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }

                .mode-toggle {
                    display: flex;
                    gap: 1px;
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    background: rgba(197, 160, 89, 0.05);
                    padding: 4px;
                }

                .toggle-btn {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.4);
                    padding: 10px;
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    letter-spacing: 0.1em;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .toggle-btn.active {
                    background: rgba(197, 160, 89, 0.15);
                    color: var(--accent-color);
                    text-shadow: 0 0 10px rgba(197, 160, 89, 0.4);
                }

                .empty-state-message {
                    color: rgba(255, 255, 255, 0.5);
                    text-align: center;
                    font-family: var(--font-narrative);
                    line-height: 1.6;
                    padding: 20px;
                    border: 1px dashed rgba(197, 160, 89, 0.2);
                }

                .input-field {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .input-field label {
                    font-family: var(--font-header);
                    font-size: 0.6rem;
                    letter-spacing: 0.1em;
                    color: var(--accent-color);
                    opacity: 0.8;
                }

                .select-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .select-icon {
                    position: absolute;
                    left: 15px;
                    color: var(--accent-color);
                    opacity: 0.5;
                    pointer-events: none;
                }

                .occult-input {
                    width: 100%;
                    background: rgba(197, 160, 89, 0.03);
                    border: 1px solid rgba(197, 160, 89, 0.15);
                    padding: 14px 20px 14px 45px;
                    color: white;
                    font-family: var(--font-main);
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.3s;
                    cursor: pointer;
                    appearance: none;
                }

                .occult-input:focus {
                    border-color: var(--accent-color);
                    background: rgba(197, 160, 89, 0.08);
                    box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
                }

                .occult-input option {
                    background: #1a1a1a;
                    color: var(--text-primary);
                    padding: 10px;
                }

                .type-hint {
                    display: block;
                    font-size: 0.65rem;
                    color: rgba(197, 160, 89, 0.6);
                    font-style: italic;
                    margin-top: 4px;
                    letter-spacing: 0.03em;
                }

                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                }

                .ritual-action-btn {
                    width: 100%;
                    height: 54px;
                    background: transparent;
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                }

                .ritual-action-btn:hover:not(:disabled) {
                    background: var(--accent-color);
                    color: #000;
                    box-shadow: 0 0 30px var(--accent-glow);
                }

                .ritual-action-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                    border-color: rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.3);
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
