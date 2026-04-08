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
                <div className="track-header">
                    <span className="track-icon physical" aria-hidden="true">
                        <Dumbbell size={11} strokeWidth={1.9} />
                    </span>
                    <span>FÍSICO</span>
                </div>
                <div className="track-boxes">
                    {character.stress.physical.map((box, i) => (
                        <button
                            key={i}
                            className={`stress-box ${box ? "marked" : ""}`}
                            onClick={() => canEditSelf && handleStressToggle("PHYSICAL", i, box)}
                            disabled={!canEditSelf}
                        >
                            {resolveValue("physical", i)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="combat-track">
                <div className="track-header">
                    <span className="track-icon mental" aria-hidden="true">
                        <Brain size={11} strokeWidth={1.9} />
                    </span>
                    <span>MENTAL</span>
                </div>
                <div className="track-boxes">
                    {character.stress.mental.map((box, i) => (
                        <button
                            key={i}
                            className={`stress-box ${box ? "marked" : ""}`}
                            onClick={() => canEditSelf && handleStressToggle("MENTAL", i, box)}
                            disabled={!canEditSelf}
                        >
                            {resolveValue("mental", i)}
                        </button>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .combat-stress-section {
                    display: flex;
                    gap: 12px;
                    padding: 8px 0;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .combat-track {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }

                .track-header {
                    font-size: 0.6rem;
                    color: #888;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    line-height: 1.1;
                }
                
                .track-icon {
                    color: inherit;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .track-icon.physical {
                    color: rgba(255, 115, 115, 0.88);
                }

                .track-icon.mental {
                    color: rgba(181, 156, 255, 0.9);
                }
                
                .track-boxes {
                    display: flex;
                    gap: 4px;
                    margin-top: 1px;
                }

                .stress-box {
                    min-width: 28px;
                    width: auto;
                    height: 20px;
                    padding: 0 4px;
                    border: 1px solid #333;
                    background: #111;
                    color: #444;
                    font-size: 0.62rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .stress-box:hover:not([disabled]) {
                    border-color: #ff4444;
                }

                .stress-box.marked {
                    color: #000;
                    font-weight: bold;
                }

                /* Tema-dependent colors need to be handled via character stats or passed as props, 
                   but since we want to keep it simple and 1:1, we'll keep the logic here */
                .stress-box.marked {
                    background: #c5a059;
                    border-color: #c5a059;
                    box-shadow: 0 0 8px rgba(197, 160, 89, 0.4);
                }
            `}</style>
        </div>
    );
}
