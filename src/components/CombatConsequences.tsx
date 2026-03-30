"use client";

import { Character } from "@/types/domain";

interface CombatConsequencesProps {
    character: Character;
    isGM: boolean;
    openConsequenceModal: (slot: string, currentValue: string, debuffSkill?: string, debuffValue?: number) => void;
}

export function CombatConsequences({ character, isGM, openConsequenceModal }: CombatConsequencesProps) {
    return (
        <div className="combat-consequences">
            <div className="consequences-title">CONSEQUÊNCIAS</div>
            <div className="consequences-list">
                {Object.keys(character.consequences).map((slot) => {
                    const cons = character.consequences[slot];

                    let label = slot.toUpperCase();
                    if (slot === "mild" || slot.includes("mild")) label = "-2 LEVE";
                    else if (slot === "moderate" || slot.includes("moderate")) label = "-4 MODERADA";
                    else if (slot === "severe" || slot.includes("severe")) label = "-6 GRAVE";
                    else if (slot === "extreme" || slot.includes("extreme")) label = "-8 EXTREMA";

                    const isFilled = cons && cons.text && cons.text.trim().length > 0;

                    return (
                        <div
                            key={slot}
                            className="combat-consequence-row"
                            onClick={() => openConsequenceModal(slot, cons?.text || "", cons?.debuff?.skill, cons?.debuff?.value)}
                        >
                            <span className="cons-label">{label}</span>
                            <span className={`cons-value ${isFilled ? 'filled' : 'empty'}`}>
                                {isFilled ? cons.text.toUpperCase() : "..."}
                                {isFilled && cons.debuff && (
                                    <span className="cons-debuff-badge">
                                        -{cons.debuff.value} {cons.debuff.skill.slice(0, 3).toUpperCase()}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .combat-consequences {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .consequences-title {
                    font-size: 0.55rem;
                    letter-spacing: 0.15em;
                    color: rgba(255,255,255,0.2);
                    margin-bottom: 2px;
                }

                .consequences-list {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .combat-consequence-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.7rem;
                    cursor: pointer;
                    padding: 2px 4px;
                }
                .combat-consequence-row:hover {
                    background: rgba(255,255,255,0.03);
                }

                .cons-label {
                    color: #c5a059;
                    font-weight: bold;
                    min-width: 70px;
                    font-size: 0.6rem;
                }

                .cons-value {
                    flex: 1;
                    color: #666;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .cons-value.filled {
                    color: #ff4444;
                    text-shadow: 0 0 5px rgba(255, 68, 68, 0.4);
                }

                .cons-debuff-badge {
                    background: rgba(255, 68, 68, 0.2);
                    color: #ff8888;
                    padding: 0 4px;
                    border-radius: 2px;
                    font-size: 0.6rem;
                    border: 1px solid rgba(255, 68, 68, 0.3);
                }
            `}</style>
        </div>
    );
}
