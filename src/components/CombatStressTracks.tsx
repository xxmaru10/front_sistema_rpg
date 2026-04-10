"use client";

import { Character } from "@/types/domain";
import { Brain, Dumbbell } from "lucide-react";

interface CombatStressTracksProps {
    character: Character;
    canEditSelf: boolean;
    handleStressToggle: (track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => void;
}

export function CombatStressTracks({ character, canEditSelf, handleStressToggle }: CombatStressTracksProps) {
    const resolveValue = (track: "physical" | "mental", index: number) => {
        const values = character.stressValues?.[track] || [];
        const raw = values[index] ?? (index + 1);
        return Math.max(1, Math.min(1000, Math.trunc(raw)));
    };

    return (
        <div className="combat-stress-section">
            <div className="combat-track">
                <div className="track-display">
                    <span className="track-icon physical" aria-hidden="true">
                        <Dumbbell size={12} strokeWidth={2} />
                    </span>
                    <div className="track-circles">
                        {character.stress.physical.map((box, i) => (
                            <button
                                key={i}
                                className={`stress-circle ${box ? "marked" : ""}`}
                                onClick={() => canEditSelf && handleStressToggle("PHYSICAL", i, box)}
                                disabled={!canEditSelf}
                            >
                                {resolveValue("physical", i)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="combat-track">
                <div className="track-display">
                    <span className="track-icon mental" aria-hidden="true">
                        <Brain size={12} strokeWidth={2} />
                    </span>
                    <div className="track-circles">
                        {character.stress.mental.map((box, i) => (
                            <button
                                key={i}
                                className={`stress-circle ${box ? "marked" : ""}`}
                                onClick={() => canEditSelf && handleStressToggle("MENTAL", i, box)}
                                disabled={!canEditSelf}
                            >
                                {resolveValue("mental", i)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .combat-stress-section {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    padding: 8px 0;
                }

                .combat-track {
                    display: flex;
                    flex-direction: column;
                }

                .track-display {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .track-icon {
                    color: inherit;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.7;
                }

                .track-icon.physical {
                    color: rgba(255, 115, 115, 0.8);
                }

                .track-icon.mental {
                    color: rgba(181, 156, 255, 0.8);
                }
                
                .track-circles {
                    display: flex;
                    gap: 6px;
                }

                .stress-circle {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 1px solid currentColor;
                    background: transparent;
                    color: inherit;
                    font-size: 0.65rem;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 0;
                    line-height: 1;
                }

                .combat-track:nth-child(1) .stress-circle {
                    color: rgba(255, 115, 115, 0.6);
                }
                .combat-track:nth-child(2) .stress-circle {
                    color: rgba(181, 156, 255, 0.6);
                }

                .stress-circle:hover:not([disabled]) {
                    background: rgba(255, 255, 255, 0.05);
                }

                .stress-circle.marked {
                    background: #ff4444 !important;
                    border-color: #ff4444 !important;
                    color: #000 !important;
                    box-shadow: 0 0 10px rgba(255, 68, 68, 0.4);
                }
            `}</style>
        </div>
    );
}
