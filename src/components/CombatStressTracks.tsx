"use client";

import { Character } from "@/types/domain";

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
        <div className="combat-stress-container">
            <div className="combat-stress-section">
                <div className="combat-track">
                    <div className="track-display">
                        <span className="track-icon physical png" aria-hidden="true" />
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
                <div className="divider" aria-hidden="true" />
                <div className="combat-track">
                    <div className="track-display">
                        <span className="track-icon mental png" aria-hidden="true" />
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
            </div>

            <style jsx>{`
                .combat-stress-container {
                    background:
                        radial-gradient(circle at 22% 34%, rgba(255, 255, 255, 0.09) 0%, transparent 42%),
                        radial-gradient(circle at 78% 68%, rgba(255, 255, 255, 0.06) 0%, transparent 45%),
                        linear-gradient(to right, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 55%, transparent 100%);
                    backdrop-filter: blur(14px) saturate(1.08);
                    -webkit-backdrop-filter: blur(14px) saturate(1.08);
                    border: 1px solid rgba(var(--accent-rgb), 0.52);
                    border-radius: 8px;
                    padding: 6px 14px;
                    width: fit-content;
                    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.68), inset 0 0 14px rgba(255, 255, 255, 0.04);
                    transform: translateY(-2px);
                    position: relative;
                    z-index: 5;
                    overflow-x: auto;
                    overflow-y: hidden;
                }

                .combat-stress-section {
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;
                    gap: 16px;
                }

                .divider {
                    width: 1px;
                    height: 20px;
                    background: rgba(255, 255, 255, 0.1);
                }

                .combat-track {
                    display: flex;
                    flex-direction: column;
                }

                .track-display {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .track-icon {
                    color: inherit;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.95;
                    filter: drop-shadow(0 0 6px rgba(var(--accent-rgb), 0.46));
                }

                .track-icon.png {
                    width: 19px;
                    height: 19px;
                    background-color: rgb(var(--accent-rgb));
                    background-color: color-mix(in srgb, rgb(var(--accent-rgb)) 76%, #ffffff 24%);
                    -webkit-mask-image: var(--stress-icon-url);
                    mask-image: var(--stress-icon-url);
                    -webkit-mask-repeat: no-repeat;
                    mask-repeat: no-repeat;
                    -webkit-mask-position: center;
                    mask-position: center;
                    -webkit-mask-size: contain;
                    mask-size: contain;
                }

                .track-icon.physical {
                    --stress-icon-url: url('/interface/fisico.png');
                    color: color-mix(in srgb, rgb(var(--accent-rgb)) 65%, #ff8888);
                }

                .track-icon.mental {
                    --stress-icon-url: url('/interface/mental.png');
                    color: color-mix(in srgb, rgb(var(--accent-rgb)) 62%, #a992ff);
                }
                
                .track-circles {
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 4px;
                    max-width: none;
                    white-space: nowrap;
                }

                .stress-circle {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    border: 1px solid currentColor;
                    background: transparent;
                    color: inherit;
                    font-size: 0.66rem;
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
                    color: rgba(255, 115, 115, 0.7);
                }
                .combat-track:nth-child(3) .stress-circle {
                    color: rgba(181, 156, 255, 0.7);
                }

                .stress-circle:hover:not([disabled]) {
                    background: rgba(255, 255, 255, 0.1);
                    transform: scale(1.1);
                }

                .stress-circle.marked {
                    background: #ff4444 !important;
                    border-color: #ff4444 !important;
                    color: #000 !important;
                    box-shadow: 0 0 10px rgba(255, 44, 44, 0.5);
                }

                @media (max-width: 768px) {
                    .combat-stress-container {
                        padding: 7px 10px;
                        max-width: min(95vw, 320px);
                    }

                    .combat-stress-section {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 8px;
                    }

                    .divider {
                        display: none;
                    }

                    .track-display {
                        align-items: flex-start;
                    }

                    .track-circles {
                        flex-wrap: wrap;
                        row-gap: 5px;
                        max-width: 100%;
                    }

                    .stress-circle {
                        width: 21px;
                        height: 21px;
                        font-size: 0.63rem;
                    }
                }
            `}</style>
        </div>
    );
}
