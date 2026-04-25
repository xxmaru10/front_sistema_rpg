"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_SKILLS } from "@/types/domain";

interface ConsequenceModalProps {
    isOpen: boolean;
    initialText: string;
    initialDebuffSkill?: string;
    initialDebuffValue?: number;
    onSave: (text: string, debuffSkill: string, debuffValue: number) => void;
    onCancel: () => void;
    /** Override the skill list shown in the "PERÍCIA AFETADA" dropdown. Defaults to DEFAULT_SKILLS. */
    skills?: readonly string[];
}

export function ConsequenceModal({
    isOpen,
    initialText,
    initialDebuffSkill = "",
    initialDebuffValue = 0,
    onSave,
    onCancel,
    skills,
}: ConsequenceModalProps) {
    const skillList = skills ?? DEFAULT_SKILLS;
    const [text, setText] = useState(initialText);
    const [debuffSkill, setDebuffSkill] = useState(initialDebuffSkill);
    const [debuffValue, setDebuffValue] = useState(initialDebuffValue);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            setText(initialText);
            setDebuffSkill(initialDebuffSkill);
            setDebuffValue(initialDebuffValue);
        }
        return () => setMounted(false);
    }, [isOpen, initialText, initialDebuffSkill, initialDebuffValue]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="consequence-modal-overlay" onClick={onCancel} style={{ zIndex: 2147483647 }}>
            <div className="consequence-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-symbol">🜊</span>
                    <span>DEFINIR CONSEQUÊNCIA</span>
                </div>

                <input
                    type="text"
                    className="modal-input"
                    placeholder="Descreva a consequência..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    autoFocus
                />

                <div className="consequence-debuff-row">
                    <div className="debuff-field">
                        <label>PERÍCIA AFETADA</label>
                        <select
                            className="debuff-skill-select"
                            value={debuffSkill}
                            onChange={(e) => setDebuffSkill(e.target.value)}
                        >
                            <option value="">— Nenhuma —</option>
                            {skillList.map(skill => (
                                <option key={skill} value={skill}>{skill}</option>
                            ))}
                        </select>
                    </div>
                    <div className="debuff-field value-field">
                        <label>DEBUFF</label>
                        <div className="debuff-value-input">
                            <span className="debuff-minus">-</span>
                            <input
                                type="number"
                                min={0}
                                max={10}
                                className="debuff-number-input"
                                value={debuffValue}
                                onChange={(e) => setDebuffValue(Math.max(0, parseInt(e.target.value) || 0))}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button
                        className="modal-btn clear"
                        onClick={() => onSave("", "", 0)}
                        title="Limpar consequência e debuff"
                    >
                        LIMPAR
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                        className="modal-btn save"
                        onClick={() => onSave(text, debuffSkill, debuffValue)}
                    >
                        CONFIRMAR
                    </button>
                    <button className="modal-btn cancel" onClick={onCancel}>
                        CANCELAR
                    </button>
                </div>
                
                <style jsx>{`
                    .consequence-modal-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0, 0, 0, 0.85);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2147483647;
                    }

                    .consequence-modal {
                        background: linear-gradient(135deg, #0a0a0a 0%, #151515 100%);
                        border: 2px solid var(--accent-color);
                        padding: 32px;
                        width: 500px; /* Locked width to prevent "gigantic" issue */
                        max-width: 90vw;
                        display: flex;
                        flex-direction: column;
                        gap: 20px;
                        box-shadow: 0 0 60px rgba(197, 160, 89, 0.3), inset 0 0 40px rgba(0, 0, 0, 0.5);
                    }

                    .modal-header {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-family: var(--font-header);
                        font-size: 1.1rem;
                        color: var(--accent-color);
                        letter-spacing: 0.15em;
                        border-bottom: 1px solid rgba(197, 160, 89, 0.2);
                        padding-bottom: 12px;
                    }

                    .modal-symbol { font-size: 1.4rem; }

                    .modal-input {
                        background: rgba(0, 0, 0, 0.5);
                        border: 1px solid rgba(197, 160, 89, 0.3);
                        padding: 14px 16px;
                        color: #fff;
                        font-family: var(--font-header);
                        font-size: 1rem;
                        outline: none;
                    }

                    .modal-input:focus { border-color: var(--accent-color); }

                    .consequence-debuff-row {
                        display: flex;
                        gap: 16px;
                        align-items: flex-end;
                    }

                    .debuff-field { display: flex; flex-direction: column; gap: 6px; flex: 1; }
                    .value-field { flex: 0 0 80px; }

                    .debuff-field label {
                        font-size: 0.65rem;
                        color: var(--accent-color);
                        opacity: 0.7;
                    }

                    .debuff-skill-select {
                        background: #0a0a0a;
                        border: 1px solid rgba(197, 160, 89, 0.3);
                        padding: 10px;
                        color: #fff;
                    }

                    .debuff-value-input {
                        display: flex;
                        align-items: center;
                        background: rgba(0, 0, 0, 0.5);
                        border: 1px solid rgba(255, 100, 100, 0.4);
                        padding: 8px 12px;
                    }

                    .debuff-minus { color: #ff6b6b; margin-right: 4px; }

                    .debuff-number-input {
                        background: transparent;
                        border: none;
                        color: #fff;
                        width: 100%;
                        text-align: center;
                        font-size: 1rem;
                    }

                    .modal-actions { display: flex; gap: 12px; justify-content: flex-end; }

                    .modal-btn {
                        padding: 10px 20px;
                        font-family: var(--font-header);
                        letter-spacing: 0.1em;
                        cursor: pointer;
                        border: 1px solid;
                    }

                    .modal-btn.save {
                        background: rgba(197, 160, 89, 0.1);
                        border-color: var(--accent-color);
                        color: var(--accent-color);
                    }

                    .modal-btn.save:hover { background: rgba(197, 160, 89, 0.2); }

                    .modal-btn.clear {
                        background: rgba(255, 255, 255, 0.05);
                        border-color: rgba(255, 255, 255, 0.2);
                        color: rgba(255, 255, 255, 0.6);
                    }
                    .modal-btn.clear:hover {
                        background: rgba(255, 255, 255, 0.1);
                        color: #fff;
                        border-color: #fff;
                    }

                    .modal-btn.cancel {
                        background: rgba(100, 50, 50, 0.1);
                        border-color: #844;
                        color: #f88;
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
}
