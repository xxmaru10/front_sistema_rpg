"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Character } from "@/types/domain";
import { Shield, Swords, Skull, AlertTriangle } from "lucide-react";

const CONSEQUENCE_CAPACITIES: Record<string, number> = {
    mild: 2,
    mild2: 2,
    moderate: 4,
    severe: 6,
    extreme: 8,
};

const SLOT_ORDER = ["mild", "mild2", "moderate", "severe", "extreme"];

const SLOT_LABEL: Record<string, string> = {
    mild: "Leve",
    mild2: "Leve",
    moderate: "Moderada",
    severe: "Severa",
    extreme: "Extrema",
};

function getSlotCapacity(slot: string): number {
    if (CONSEQUENCE_CAPACITIES[slot] !== undefined) return CONSEQUENCE_CAPACITIES[slot];
    const lower = slot.toLowerCase();
    if (lower.includes("mild") || lower.includes("leve")) return 2;
    if (lower.includes("moderate") || lower.includes("moderada")) return 4;
    if (lower.includes("severe") || lower.includes("severa")) return 6;
    if (lower.includes("extreme") || lower.includes("extrema")) return 8;
    return 2;
}

function getSlotLabel(slot: string): string {
    if (SLOT_LABEL[slot]) return SLOT_LABEL[slot];
    return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export interface DamageResolutionApplied {
    stressPhysical: number[];
    stressMental: number[];
    consequences: { slot: string; text: string }[];
}

interface DamageResolutionModalProps {
    isOpen: boolean;
    defender: Character | null;
    damage: number;
    track: "PHYSICAL" | "MENTAL";
    onConfirm: (applied: DamageResolutionApplied) => void;
    onAutoCalculate: () => void;
    onSkip: () => void;
}

export function DamageResolutionModal({
    isOpen,
    defender,
    damage,
    track,
    onConfirm,
    onAutoCalculate,
    onSkip,
}: DamageResolutionModalProps) {
    const [markedPhysical, setMarkedPhysical] = useState<Set<number>>(new Set());
    const [markedMental, setMarkedMental] = useState<Set<number>>(new Set());
    const [consequenceTexts, setConsequenceTexts] = useState<Record<string, string>>({});

    // Reset state whenever a new damage resolution opens
    useEffect(() => {
        if (isOpen && defender) {
            setMarkedPhysical(new Set());
            setMarkedMental(new Set());
            setConsequenceTexts({});
        }
    }, [isOpen, defender?.id, damage]);

    const isNPC = !!defender?.isNPC;

    const orderedSlots = useMemo(() => {
        if (!defender) return [] as string[];
        const keys = Object.keys(defender.consequences || {});
        return keys.sort((a, b) => {
            const ia = SLOT_ORDER.indexOf(a);
            const ib = SLOT_ORDER.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return getSlotCapacity(a) - getSlotCapacity(b);
        });
    }, [defender]);

    // Damage absorbed so far by the GM's current selections
    const remainingDamage = useMemo(() => {
        if (!defender) return damage;

        let absorbed = 0;

        const physVals = defender.stressValues?.physical;
        markedPhysical.forEach(idx => {
            const raw = physVals?.[idx];
            absorbed += raw !== undefined ? Math.max(1, Math.trunc(raw)) : 1;
        });

        const mentVals = defender.stressValues?.mental;
        markedMental.forEach(idx => {
            const raw = mentVals?.[idx];
            absorbed += raw !== undefined ? Math.max(1, Math.trunc(raw)) : 1;
        });

        orderedSlots.forEach(slot => {
            const text = consequenceTexts[slot];
            if (text && text.trim().length > 0) {
                absorbed += getSlotCapacity(slot);
            }
        });

        return damage - absorbed;
    }, [defender, damage, markedPhysical, markedMental, consequenceTexts, orderedSlots]);

    const overAbsorbed = remainingDamage < 0;
    const canConfirm = remainingDamage === 0;

    if (!isOpen || !defender || typeof window === "undefined") return null;

    const togglePhysical = (idx: number) => {
        if (defender.stress.physical[idx]) return;
        setMarkedPhysical(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleMental = (idx: number) => {
        if (defender.stress.mental[idx]) return;
        setMarkedMental(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const setConsequenceText = (slot: string, text: string) => {
        setConsequenceTexts(prev => ({ ...prev, [slot]: text }));
    };

    const handleConfirmClick = () => {
        if (!canConfirm || overAbsorbed) return;
        const consequences = orderedSlots
            .map(slot => ({ slot, text: (consequenceTexts[slot] || "").trim() }))
            .filter(c => c.text.length > 0);
        onConfirm({
            stressPhysical: Array.from(markedPhysical),
            stressMental: Array.from(markedMental),
            consequences,
        });
    };

    const arenaSide = (defender as any).arenaSide as string | undefined;
    const isHazard = (defender as any).isHazard;
    const isThreat = (arenaSide === "THREAT") || (defender.isNPC && arenaSide !== "HERO");
    const sideColor = isHazard ? "#a855f7" : isThreat ? "#ff4444" : "#3b82f6";

    const damageNumberColor = overAbsorbed
        ? "#fb923c"
        : remainingDamage === 0
          ? "#6ee7b7"
          : remainingDamage <= 2
            ? "#fde047"
            : "#ff4d4d";

    return createPortal(
        <div className="dmg-modal-overlay" role="presentation">
            <div
                className="dmg-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dmg-modal-title"
                onClick={e => e.stopPropagation()}
            >
                {/* Header: Diamond + Name */}
                <div className="dmg-header">
                    <div
                        className="dmg-diamond"
                        style={{ "--side-color": sideColor } as any}
                    >
                        <div className="dmg-diamond-inner">
                            {defender.imageUrl ? (
                                <img src={defender.imageUrl} alt={defender.name} />
                            ) : (
                                <div className="dmg-placeholder">
                                    {isHazard ? (
                                        <AlertTriangle size={36} />
                                    ) : isThreat ? (
                                        <Skull size={36} />
                                    ) : defender.isNPC ? (
                                        <Shield size={36} />
                                    ) : (
                                        <Swords size={36} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div id="dmg-modal-title" className="dmg-name">
                        {defender.name}
                    </div>
                    <div className="dmg-track-label">
                        DANO {track === "PHYSICAL" ? "FÍSICO" : "MENTAL"}
                    </div>
                </div>

                {isNPC && (
                    <p className="dmg-hint-npc">
                        Personagem NPC: aloque estresse e/ou consequências até o dano restante chegar a zero,
                        ou use <strong>Cálculo automático</strong>.
                    </p>
                )}
                {!isNPC && (
                    <p className="dmg-hint-pc">
                        Personagem de jogador: você pode resolver aqui ou usar <strong>Não fazer nada</strong> para o
                        jogador marcar na ficha.
                    </p>
                )}

                <div className="dmg-received-row">
                    <div className="dmg-received-block">
                        <span className="dmg-label">DANO RECEBIDO</span>
                        <span className="dmg-number dmg-number-sm" style={{ color: "#fca5a5" }}>
                            {damage}
                        </span>
                    </div>
                    <div className="dmg-received-block">
                        <span className="dmg-label">DANO RESTANTE</span>
                        <span className="dmg-number" style={{ color: damageNumberColor }}>
                            {remainingDamage}
                        </span>
                    </div>
                </div>

                {overAbsorbed && (
                    <div className="dmg-overwarn">
                        A absorção ultrapassa o dano recebido. Desmarque caixas ou apague texto de consequência até o
                        restante bater em zero.
                    </div>
                )}

                {/* Stress Tracks */}
                <div className="dmg-section">
                    <div className="dmg-section-title">ESTRESSE FÍSICO</div>
                    <div className="dmg-stress-row">
                        {defender.stress.physical.length === 0 && (
                            <div className="dmg-empty">—</div>
                        )}
                        {defender.stress.physical.map((isMarked, idx) => {
                            const raw = defender.stressValues?.physical?.[idx];
                            const value = raw !== undefined ? Math.max(1, Math.trunc(raw)) : idx + 1;
                            const isNew = markedPhysical.has(idx);
                            return (
                                <button
                                    key={`p-${idx}`}
                                    type="button"
                                    className={`dmg-stress-box${isMarked ? " occupied" : ""}${isNew ? " new-mark" : ""}`}
                                    disabled={isMarked}
                                    onClick={() => togglePhysical(idx)}
                                    title={isMarked ? "Já marcada" : `Absorve ${value}`}
                                >
                                    {value}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="dmg-section">
                    <div className="dmg-section-title">ESTRESSE MENTAL</div>
                    <div className="dmg-stress-row">
                        {defender.stress.mental.length === 0 && (
                            <div className="dmg-empty">—</div>
                        )}
                        {defender.stress.mental.map((isMarked, idx) => {
                            const raw = defender.stressValues?.mental?.[idx];
                            const value = raw !== undefined ? Math.max(1, Math.trunc(raw)) : idx + 1;
                            const isNew = markedMental.has(idx);
                            return (
                                <button
                                    key={`m-${idx}`}
                                    type="button"
                                    className={`dmg-stress-box${isMarked ? " occupied" : ""}${isNew ? " new-mark" : ""}`}
                                    disabled={isMarked}
                                    onClick={() => toggleMental(idx)}
                                    title={isMarked ? "Já marcada" : `Absorve ${value}`}
                                >
                                    {value}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Consequences */}
                <div className="dmg-section">
                    <div className="dmg-section-title">CONSEQUÊNCIAS</div>
                    <div className="dmg-consequences">
                        {orderedSlots.length === 0 && (
                            <div className="dmg-empty">— Sem slots de consequência —</div>
                        )}
                        {orderedSlots.map(slot => {
                            const existing = defender.consequences ? defender.consequences[slot] : undefined;
                            const existingText = existing?.text?.trim() || "";
                            const isOccupied = existingText.length > 0;
                            const capacity = getSlotCapacity(slot);
                            const current = consequenceTexts[slot] || "";
                            const isNew = current.trim().length > 0;

                            return (
                                <div
                                    key={slot}
                                    className={`dmg-cons-row${isOccupied ? " occupied" : ""}${isNew ? " new-mark" : ""}`}
                                >
                                    <div className="dmg-cons-label">
                                        <span className="dmg-cons-name">{getSlotLabel(slot)}</span>
                                        <span className="dmg-cons-cap">-{capacity}</span>
                                    </div>
                                    {isOccupied ? (
                                        <div className="dmg-cons-locked">{existingText}</div>
                                    ) : (
                                        <input
                                            type="text"
                                            className="dmg-cons-input"
                                            placeholder="Descreva para aplicar…"
                                            value={current}
                                            onChange={e => setConsequenceText(slot, e.target.value)}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="dmg-actions">
                    <button
                        className="dmg-btn confirm"
                        onClick={handleConfirmClick}
                        disabled={!canConfirm || overAbsorbed}
                        title={
                            canConfirm
                                ? "Aplicar marcações na ficha"
                                : overAbsorbed
                                  ? "Absorção acima do dano — ajuste as seleções"
                                  : "Reduza o dano restante exatamente a 0 para confirmar"
                        }
                    >
                        CONFIRMAR
                    </button>
                    <button
                        className="dmg-btn auto"
                        onClick={onAutoCalculate}
                        title="Aplicar absorção automaticamente"
                    >
                        CÁLCULO AUTOMÁTICO
                    </button>
                    {!isNPC && (
                        <button
                            className="dmg-btn skip"
                            onClick={onSkip}
                            title="Deixar o jogador resolver"
                        >
                            NÃO FAZER NADA
                        </button>
                    )}
                </div>

                <style jsx>{`
                    .dmg-modal-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0, 0, 0, 0.88);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 2147483646;
                        backdrop-filter: blur(3px);
                    }

                    .dmg-modal {
                        background: linear-gradient(135deg, #0a0a0a 0%, #151515 100%);
                        border: 2px solid var(--accent-color);
                        padding: 28px 32px 24px;
                        width: 560px;
                        max-width: 92vw;
                        max-height: 92vh;
                        overflow-y: auto;
                        display: flex;
                        flex-direction: column;
                        gap: 18px;
                        box-shadow: 0 0 80px rgba(197, 160, 89, 0.25),
                                    0 0 40px rgba(255, 50, 50, 0.2),
                                    inset 0 0 40px rgba(0, 0, 0, 0.6);
                    }

                    /* Header */
                    .dmg-header {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        padding-bottom: 14px;
                        border-bottom: 1px solid rgba(197, 160, 89, 0.25);
                    }

                    .dmg-diamond {
                        width: 82px;
                        height: 82px;
                        background: #050505;
                        transform: rotate(45deg);
                        border-radius: 12px;
                        overflow: hidden;
                        border: 3px solid var(--side-color);
                        box-shadow:
                            0 0 28px var(--side-color),
                            0 0 8px var(--side-color),
                            inset 0 0 12px var(--side-color);
                        position: relative;
                        margin-top: 10px;
                    }

                    .dmg-diamond-inner {
                        position: absolute;
                        width: 150%;
                        height: 150%;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .dmg-diamond-inner img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }

                    .dmg-placeholder {
                        color: var(--side-color);
                        opacity: 0.7;
                    }

                    .dmg-name {
                        font-family: var(--font-header);
                        font-size: 1.25rem;
                        color: #fff;
                        letter-spacing: 0.12em;
                        text-align: center;
                        text-shadow: 0 0 10px rgba(var(--accent-rgb), 0.4);
                    }

                    .dmg-track-label {
                        font-family: var(--font-header);
                        font-size: 0.72rem;
                        color: var(--accent-color);
                        opacity: 0.7;
                        letter-spacing: 0.18em;
                    }

                    .dmg-hint-npc,
                    .dmg-hint-pc {
                        margin: 0;
                        font-size: 0.78rem;
                        line-height: 1.45;
                        color: rgba(230, 225, 210, 0.72);
                        text-align: center;
                        padding: 0 4px;
                    }

                    .dmg-hint-npc strong,
                    .dmg-hint-pc strong {
                        color: var(--accent-color);
                        font-weight: 600;
                    }

                    .dmg-received-row {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 28px;
                        padding: 8px 0 4px;
                    }

                    .dmg-received-block {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                        min-width: 140px;
                    }

                    .dmg-overwarn {
                        background: rgba(180, 40, 40, 0.2);
                        border: 1px solid rgba(255, 100, 100, 0.45);
                        color: #fecaca;
                        font-size: 0.8rem;
                        line-height: 1.4;
                        padding: 10px 14px;
                        border-radius: 6px;
                        text-align: center;
                    }

                    .dmg-number-sm {
                        font-size: 2.4rem !important;
                    }

                    /* Remaining damage */
                    .dmg-remaining {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 2px;
                    }

                    .dmg-label {
                        font-size: 0.68rem;
                        letter-spacing: 0.18em;
                        color: var(--accent-color);
                        opacity: 0.75;
                        font-family: var(--font-header);
                    }

                    .dmg-number {
                        font-family: var(--font-header);
                        font-size: 3.2rem;
                        font-weight: 900;
                        line-height: 1;
                        text-shadow:
                            0 0 16px currentColor,
                            0 0 32px currentColor,
                            2px 2px 0 rgba(0, 0, 0, 0.8);
                        transition: color 0.3s ease;
                    }

                    /* Sections */
                    .dmg-section {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .dmg-section-title {
                        font-family: var(--font-header);
                        font-size: 0.68rem;
                        letter-spacing: 0.16em;
                        color: var(--accent-color);
                        opacity: 0.75;
                    }

                    .dmg-stress-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }

                    .dmg-empty {
                        color: rgba(255, 255, 255, 0.35);
                        font-size: 0.85rem;
                        font-style: italic;
                    }

                    .dmg-stress-box {
                        width: 36px;
                        height: 36px;
                        background: rgba(0, 0, 0, 0.6);
                        border: 1px solid rgba(197, 160, 89, 0.4);
                        color: #fff;
                        font-family: var(--font-header);
                        font-size: 0.9rem;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                    }

                    .dmg-stress-box:hover:not(:disabled) {
                        border-color: var(--accent-color);
                        background: rgba(var(--accent-rgb), 0.15);
                        transform: scale(1.05);
                    }

                    .dmg-stress-box.occupied {
                        background: rgba(120, 20, 20, 0.6);
                        border-color: rgba(200, 40, 40, 0.6);
                        color: rgba(255, 180, 180, 0.6);
                        cursor: not-allowed;
                        text-decoration: line-through;
                    }

                    .dmg-stress-box.new-mark {
                        background: rgba(200, 40, 40, 0.35);
                        border-color: #ff4444;
                        color: #fff;
                        box-shadow: 0 0 12px rgba(255, 68, 68, 0.6);
                    }

                    /* Consequences */
                    .dmg-consequences {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .dmg-cons-row {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 8px 12px;
                        background: rgba(0, 0, 0, 0.4);
                        border: 1px solid rgba(197, 160, 89, 0.2);
                        transition: all 0.2s;
                    }

                    .dmg-cons-row.new-mark {
                        border-color: #ff4444;
                        background: rgba(200, 40, 40, 0.1);
                        box-shadow: 0 0 12px rgba(255, 68, 68, 0.3);
                    }

                    .dmg-cons-row.occupied {
                        background: rgba(120, 20, 20, 0.2);
                        border-color: rgba(200, 40, 40, 0.4);
                        opacity: 0.6;
                    }

                    .dmg-cons-label {
                        display: flex;
                        flex-direction: column;
                        min-width: 88px;
                        gap: 2px;
                    }

                    .dmg-cons-name {
                        font-family: var(--font-header);
                        font-size: 0.8rem;
                        color: var(--accent-color);
                        letter-spacing: 0.08em;
                    }

                    .dmg-cons-cap {
                        font-size: 0.7rem;
                        color: #ff6b6b;
                        font-weight: bold;
                    }

                    .dmg-cons-input {
                        flex: 1;
                        background: rgba(0, 0, 0, 0.5);
                        border: 1px solid rgba(197, 160, 89, 0.3);
                        padding: 8px 10px;
                        color: #fff;
                        font-family: var(--font-header);
                        font-size: 0.85rem;
                        outline: none;
                        transition: all 0.2s;
                    }

                    .dmg-cons-input:focus {
                        border-color: var(--accent-color);
                        background: rgba(0, 0, 0, 0.75);
                    }

                    .dmg-cons-locked {
                        flex: 1;
                        color: rgba(255, 180, 180, 0.8);
                        font-size: 0.85rem;
                        font-style: italic;
                        text-decoration: line-through;
                    }

                    /* Actions */
                    .dmg-actions {
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                        padding-top: 12px;
                        border-top: 1px solid rgba(197, 160, 89, 0.2);
                    }

                    .dmg-btn {
                        padding: 10px 18px;
                        font-family: var(--font-header);
                        font-size: 0.75rem;
                        letter-spacing: 0.12em;
                        cursor: pointer;
                        border: 1px solid;
                        background: transparent;
                        transition: all 0.2s;
                    }

                    .dmg-btn:disabled {
                        opacity: 0.35;
                        cursor: not-allowed;
                    }

                    .dmg-btn.confirm {
                        background: rgba(110, 231, 183, 0.1);
                        border-color: #6ee7b7;
                        color: #6ee7b7;
                    }

                    .dmg-btn.confirm:hover:not(:disabled) {
                        background: rgba(110, 231, 183, 0.25);
                        box-shadow: 0 0 16px rgba(110, 231, 183, 0.4);
                    }

                    .dmg-btn.auto {
                        background: rgba(197, 160, 89, 0.1);
                        border-color: var(--accent-color);
                        color: var(--accent-color);
                    }

                    .dmg-btn.auto:hover {
                        background: rgba(var(--accent-rgb), 0.2);
                        box-shadow: 0 0 16px rgba(var(--accent-rgb), 0.35);
                    }

                    .dmg-btn.skip {
                        background: rgba(100, 100, 120, 0.1);
                        border-color: rgba(180, 180, 200, 0.5);
                        color: rgba(200, 200, 220, 0.8);
                    }

                    .dmg-btn.skip:hover {
                        background: rgba(180, 180, 200, 0.15);
                        color: #fff;
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
}
