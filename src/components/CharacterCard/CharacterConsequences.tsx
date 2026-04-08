"use client";

import { createPortal } from "react-dom";
import { Character } from "@/types/domain";
import { ConsequenceModal } from "@/components/ConsequenceModal";

interface ConsequenceModalState {
    slot: string;
    current: string;
    debuffSkill: string;
    debuffValue: number;
}

interface CharacterConsequencesProps {
    character: Character;
    isGM: boolean;
    consequenceModal: ConsequenceModalState | null;
    showAddConsequenceModal: boolean;
    onConsequenceClick: (slot: string) => void;
    onSaveConsequence: (text: string, debuffSkill: string, debuffValue: number) => void;
    onCancelConsequenceModal: () => void;
    onDeleteConsequence: (slot: string, e: React.MouseEvent) => void;
    onAddConsequence: (type: "mild" | "moderate" | "severe") => void;
    onOpenAddModal: () => void;
    onCloseAddModal: () => void;
}

export function CharacterConsequences({
    character,
    isGM,
    consequenceModal,
    showAddConsequenceModal,
    onConsequenceClick,
    onSaveConsequence,
    onCancelConsequenceModal,
    onDeleteConsequence,
    onAddConsequence,
    onOpenAddModal,
    onCloseAddModal,
}: CharacterConsequencesProps) {
    const defaultSlots = ["mild", "moderate", "severe"];
    const allKeys = new Set<string>();
    defaultSlots.forEach((slot) => allKeys.add(slot));
    if (character.consequences) {
        Object.keys(character.consequences).forEach((k) => allKeys.add(k));
    }

    const sortedSlots = Array.from(allKeys).map((slot) => {
        let label = "EXTRA";
        let penalty = 0;
        if (slot === "mild") { label = "LEVE"; penalty = -2; }
        else if (slot === "mild2") { label = "LEVE"; penalty = -2; }
        else if (slot === "moderate") { label = "MODERADA"; penalty = -4; }
        else if (slot === "severe") { label = "GRAVE"; penalty = -6; }
        else {
            if (slot.includes("mild")) { label = "LEVE"; penalty = -2; }
            else if (slot.includes("moderate")) { label = "MODERADA"; penalty = -4; }
            else if (slot.includes("severe")) { label = "GRAVE"; penalty = -6; }
        }
        return { slot, label, penalty };
    }).sort((a, b) => {
        if (a.penalty !== b.penalty) return b.penalty - a.penalty;
        const isStandardA = ["mild", "mild2", "moderate", "severe"].includes(a.slot);
        const isStandardB = ["mild", "mild2", "moderate", "severe"].includes(b.slot);
        if (isStandardA && !isStandardB) return -1;
        if (!isStandardA && isStandardB) return 1;
        return a.slot.localeCompare(b.slot);
    });

    return (
        <>
            <div
                className="logic-readout consequences-matrix compact-consequences"
                style={{
                    background: "rgba(0, 0, 0, 0.18)",
                    border: "1px solid rgba(var(--accent-rgb), 0.12)",
                    borderRadius: "18px",
                    padding: "14px 16px",
                    boxShadow: "none",
                }}
            >
                <div
                    className="readout-header mobile-col"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "0 0 10px 0",
                        marginBottom: "12px",
                        borderBottom: "1px solid rgba(var(--accent-rgb), 0.12)",
                        background: "transparent",
                    }}
                >
                    <div className="header-group" style={{ gap: "8px" }}>
                        <span className="symbol">🜊</span>
                        <span style={{ fontSize: "0.7rem", letterSpacing: "0.22em" }}>CONSEQUÊNCIAS</span>
                        {isGM && (
                            <button
                                onClick={onOpenAddModal}
                                className="add-mild2-btn"
                                title="Adicionar Nova Consequência"
                                style={{ marginLeft: "4px" }}
                            >
                                +
                            </button>
                        )}
                    </div>
                </div>

                <div className="consequences-list" style={{ display: "grid", gap: "10px" }}>
                    {sortedSlots.map((cons) => {
                        const consData = character.consequences[cons.slot as "mild" | "mild2" | "moderate" | "severe"];
                        const textValue = consData?.text || "";
                        const isFilled = textValue.trim().length > 0;

                        return (
                            <div
                                key={cons.slot}
                                className={`consequence-slot ${isFilled ? "filled" : "empty"} small-slot`}
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: isGM ? "auto minmax(0, 1fr) auto" : "auto minmax(0, 1fr)",
                                    alignItems: "center",
                                    gap: "10px",
                                    marginBottom: 0,
                                    padding: "10px 12px",
                                    borderRadius: "14px",
                                    border: "1px solid rgba(var(--accent-rgb), 0.12)",
                                    background: isFilled ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.015)",
                                }}
                            >
                                <div className="slot-meta" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span
                                        className="penalty-badge"
                                        style={{
                                            minWidth: "38px",
                                            height: "26px",
                                            padding: "0 8px",
                                            borderRadius: "999px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            background: "rgba(var(--accent-rgb), 0.12)",
                                            border: "1px solid rgba(var(--accent-rgb), 0.2)",
                                            color: "#f3dfac",
                                            boxShadow: "none",
                                            fontSize: "0.76rem",
                                        }}
                                    >
                                        {cons.penalty}
                                    </span>
                                    <span
                                        className="slot-label"
                                        style={{
                                            fontSize: "0.72rem",
                                            letterSpacing: "0.18em",
                                            color: "rgba(var(--accent-rgb), 0.88)",
                                        }}
                                    >
                                        {cons.label}
                                    </span>
                                </div>

                                {isGM ? (
                                    <div className="consequence-input-wrapper">
                                        <button
                                            className="consequence-input-area"
                                            onClick={() => onConsequenceClick(cons.slot)}
                                            style={{
                                                width: "100%",
                                                background: "transparent",
                                                border: "none",
                                                padding: 0,
                                                textAlign: "left",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {isFilled ? (
                                                <div
                                                    className="consequence-content"
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "flex-start",
                                                        gap: "6px",
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <span
                                                        className="active-consequence"
                                                        style={{
                                                            fontSize: "0.9rem",
                                                            lineHeight: 1.35,
                                                            color: "#efe4c7",
                                                            fontStyle: "normal",
                                                            opacity: 0.95,
                                                            wordBreak: "break-word",
                                                        }}
                                                    >
                                                        {textValue.toUpperCase()}
                                                    </span>
                                                    {consData?.debuff?.skill && (
                                                        <span
                                                            className="consequence-debuff-badge"
                                                            style={{
                                                                background: "rgba(255, 107, 107, 0.1)",
                                                                border: "1px solid rgba(255, 107, 107, 0.22)",
                                                                color: "#ff9494",
                                                                padding: "3px 8px",
                                                                borderRadius: "999px",
                                                                fontSize: "0.62rem",
                                                                letterSpacing: "0.08em",
                                                            }}
                                                        >
                                                            {consData.debuff.skill} -{consData.debuff.value}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span
                                                    className="placeholder-text"
                                                    style={{
                                                        display: "block",
                                                        minHeight: "22px",
                                                    }}
                                                />
                                            )}
                                        </button>
                                        <button
                                            className="delete-consequence-btn"
                                            onClick={(e) => onDeleteConsequence(cons.slot, e)}
                                            title="Remover Consequência"
                                            style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "999px",
                                                marginLeft: 0,
                                                padding: 0,
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <div className="consequence-input-area" style={{ minWidth: 0 }}>
                                        {isFilled ? (
                                            <div
                                                className="consequence-content"
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "flex-start",
                                                    gap: "6px",
                                                    minWidth: 0,
                                                }}
                                            >
                                                <span
                                                    className="active-consequence"
                                                    style={{
                                                        fontSize: "0.9rem",
                                                        lineHeight: 1.35,
                                                        color: "#efe4c7",
                                                        fontStyle: "normal",
                                                        opacity: 0.95,
                                                        wordBreak: "break-word",
                                                    }}
                                                >
                                                    {textValue.toUpperCase()}
                                                </span>
                                                {consData?.debuff?.skill && (
                                                    <span
                                                        className="consequence-debuff-badge"
                                                        style={{
                                                            background: "rgba(255, 107, 107, 0.1)",
                                                            border: "1px solid rgba(255, 107, 107, 0.22)",
                                                            color: "#ff9494",
                                                            padding: "3px 8px",
                                                            borderRadius: "999px",
                                                            fontSize: "0.62rem",
                                                            letterSpacing: "0.08em",
                                                        }}
                                                    >
                                                        {consData.debuff.skill} -{consData.debuff.value}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span
                                                className="placeholder-text"
                                                style={{
                                                    display: "block",
                                                    minHeight: "22px",
                                                }}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Consequence Edit Modal */}
            {consequenceModal && (
                <ConsequenceModal
                    isOpen={!!consequenceModal}
                    initialText={consequenceModal.current}
                    initialDebuffSkill={consequenceModal.debuffSkill}
                    initialDebuffValue={consequenceModal.debuffValue}
                    onSave={onSaveConsequence}
                    onCancel={onCancelConsequenceModal}
                />
            )}

            {/* Add Consequence Portal */}
            {showAddConsequenceModal &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        className="consequence-modal-overlay"
                        onClick={onCloseAddModal}
                    >
                        <div
                            className="consequence-modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h4 className="modal-title">ADICIONAR CONSEQUÊNCIA</h4>
                            <div className="modal-options">
                                <button
                                    className="modal-option-btn"
                                    onClick={() => onAddConsequence("mild")}
                                >
                                    <span className="badge badge-mild">-2</span> LEVE
                                </button>
                                <button
                                    className="modal-option-btn"
                                    onClick={() => onAddConsequence("moderate")}
                                >
                                    <span className="badge badge-moderate">-4</span> MODERADA
                                </button>
                                <button
                                    className="modal-option-btn"
                                    onClick={() => onAddConsequence("severe")}
                                >
                                    <span className="badge badge-severe">-6</span> GRAVE
                                </button>
                            </div>
                            <button className="modal-close-btn" onClick={onCloseAddModal}>
                                CANCELAR
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

            <style jsx>{`
                .consequence-input-wrapper {
                    display: flex;
                    width: 100%;
                    gap: 4px;
                }

                .consequence-input-wrapper .consequence-input-area {
                    flex: 1;
                }

                .delete-consequence-btn {
                    background: rgba(255, 0, 0, 0.1);
                    border: 1px solid rgba(255, 0, 0, 0.3);
                    color: #ff4444;
                    cursor: pointer;
                    padding: 0 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    margin-left: 4px;
                    z-index: 10;
                    transition: all 0.2s;
                }

                .delete-consequence-btn:hover {
                    background: rgba(255, 0, 0, 0.25);
                    border-color: #ff4444;
                }

                :global(.modal-title) {
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                    letter-spacing: 0.2em;
                    color: var(--accent-color);
                    margin: 0 0 8px 0;
                }

                :global(.modal-options) {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                :global(.modal-option-btn) {
                    background: rgba(197, 160, 89, 0.05);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    color: var(--accent-color);
                    padding: 12px 20px;
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                    letter-spacing: 0.1em;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.2s;
                }

                :global(.modal-option-btn:hover) {
                    background: rgba(197, 160, 89, 0.15);
                    border-color: var(--accent-color);
                }

                :global(.badge) {
                    font-weight: bold;
                    font-size: 1rem;
                }

                :global(.badge-mild) {
                    color: #4f4;
                }

                :global(.badge-moderate) {
                    color: #fa4;
                }

                :global(.badge-severe) {
                    color: #f44;
                }

                :global(.modal-close-btn) {
                    background: none;
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    color: var(--accent-color);
                    padding: 10px 20px;
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.15em;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 4px;
                    transition: all 0.2s;
                }

                :global(.modal-close-btn:hover) {
                    background: rgba(197, 160, 89, 0.1);
                }
            `}</style>
        </>
    );
}
