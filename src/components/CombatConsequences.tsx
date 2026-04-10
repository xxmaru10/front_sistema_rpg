"use client";

import { Character } from "@/types/domain";

interface CombatConsequencesProps {
    character: Character;
    isGM: boolean;
    openConsequenceModal: (slot: string, currentValue: string, debuffSkill?: string, debuffValue?: number) => void;
}

export function CombatConsequences({ character, isGM, openConsequenceModal }: CombatConsequencesProps) {
    const defaultSlots = ["mild", "moderate", "severe", "extreme"];
    const slotOrder = ["mild", "mild2", "moderate", "severe", "extreme"];
    const allSlots = new Set<string>(defaultSlots);

    Object.keys(character.consequences || {}).forEach((slot) => allSlots.add(slot));

    const orderedSlots = Array.from(allSlots).sort((left, right) => {
        const leftIndex = slotOrder.indexOf(left);
        const rightIndex = slotOrder.indexOf(right);

        if (leftIndex !== -1 || rightIndex !== -1) {
            if (leftIndex === -1) return 1;
            if (rightIndex === -1) return -1;
            return leftIndex - rightIndex;
        }

        return left.localeCompare(right);
    });

    return (
        <div className="combat-consequences">
            <div className="consequences-title">CONSEQUÊNCIAS</div>
            <div className="consequences-list">
                {orderedSlots.map((slot) => {
                    const cons = character.consequences?.[slot];

                    let label = slot.toUpperCase();
                    if (slot === "mild" || slot.includes("mild")) label = "-2 LEVE";
                    else if (slot === "moderate" || slot.includes("moderate")) label = "-4 MODERADA";
                    else if (slot === "severe" || slot.includes("severe")) label = "-6 GRAVE";
                    else if (slot === "extreme" || slot.includes("extreme")) label = "-8 EXTREMA";

                    const isFilled = cons && cons.text && cons.text.trim().length > 0;
                    
                    let valueText = "";
                    if (slot === "mild" || slot.includes("mild")) valueText = "-2";
                    else if (slot === "moderate" || slot.includes("moderate")) valueText = "-4";
                    else if (slot === "severe" || slot.includes("severe")) valueText = "-6";
                    else if (slot === "extreme" || slot.includes("extreme")) valueText = "-8";

                    return (
                        <div
                            key={slot}
                            className={`combat-consequence-box ${isFilled ? 'filled' : 'empty'}`}
                            onClick={() => {
                                if (!isGM) return;
                                openConsequenceModal(slot, cons?.text || "", cons?.debuff?.skill, cons?.debuff?.value);
                            }}
                            title={isFilled ? cons.text.toUpperCase() : `Vazio (${valueText})`}
                        >
                            <span className="cons-content">
                                {isFilled ? cons.text.toUpperCase() : valueText}
                            </span>
                            {isFilled && cons.debuff && (
                                <span className="cons-debuff-badge">
                                    -{cons.debuff.value} {cons.debuff.skill.slice(0, 3).toUpperCase()}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .combat-consequences {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .consequences-title {
                    font-size: 0.55rem;
                    letter-spacing: 0.15em;
                    color: rgba(255,255,255,0.4);
                    margin-bottom: 2px;
                    font-weight: bold;
                }

                .consequences-list {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 4px;
                }

                .combat-consequence-box {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 28px;
                    padding: 4px 8px;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }

                .combat-consequence-box:hover {
                    border-color: rgba(197, 160, 89, 0.5);
                    background: rgba(197, 160, 89, 0.05);
                }

                .combat-consequence-box.filled {
                    border-color: rgba(255, 68, 68, 0.4);
                    background: rgba(255, 68, 68, 0.05);
                }

                .cons-content {
                    font-size: 0.65rem;
                    font-weight: bold;
                    color: #888;
                    text-align: center;
                    line-height: 1.2;
                }

                .filled .cons-content {
                    color: #ff6666;
                    text-shadow: 0 0 8px rgba(255, 68, 68, 0.3);
                }

                .cons-debuff-badge {
                    position: absolute;
                    top: -6px;
                    right: -4px;
                    background: #ff4444;
                    color: white;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-size: 0.5rem;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
            `}</style>
        </div>
    );
}
