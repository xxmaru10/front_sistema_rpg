"use client";

interface DiceChamberProps {
    isRolling: boolean;
    diceRotations: { x: number, y: number }[];
    lastTotal: number | null;
    getLadderLabel: (val: number) => string;
    isIntegrated: boolean;
}

export function DiceChamber({
    isRolling,
    diceRotations,
    lastTotal,
    getLadderLabel,
    isIntegrated
}: DiceChamberProps) {
    return (
        <div className={`void-chamber ornate-border ${isIntegrated ? 'integrated' : ''}`}>
            {!isIntegrated && (
                <div className={`scene-3d ${isIntegrated ? 'integrated' : ''}`}>
                    <div className={`dice-row-3d ${isIntegrated ? 'integrated' : ''}`}>
                        {diceRotations.map((rot, i) => (
                            <div key={i} className={`dice-unit ${isIntegrated ? 'integrated' : ''}`}>
                                <div
                                    className="alchemical-cube"
                                    style={{
                                        transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
                                        transition: isRolling ? 'none' : 'transform 1s cubic-bezier(0.19, 1, 0.22, 1)'
                                    }}
                                >
                                    <div className="face front">+</div>
                                    <div className="face back">+</div>
                                    <div className="face right">−</div>
                                    <div className="face left">−</div>
                                    <div className="face top">●</div>
                                    <div className="face bottom">●</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {lastTotal !== null && !isRolling && (
                <div className={`quantum-result animate-pop ${isIntegrated ? 'integrated' : ''}`}>
                    {!isIntegrated && <div className="res-ladder">{getLadderLabel(lastTotal).toUpperCase()}</div>}
                    <div className={`res-value ${lastTotal > 0 ? 'pos' : lastTotal < 0 ? 'neg' : ''}`}>
                        {lastTotal > 0 ? `+${lastTotal}` : lastTotal}
                    </div>
                </div>
            )}

            <style jsx>{`
                .void-chamber {
                    background: radial-gradient(circle at center, rgba(26, 26, 26, 0.1) 0%, rgba(8, 8, 8, 0.1) 100%);
                    height: 240px;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--accent-color);
                    overflow: hidden;
                    box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.1);
                    transition: all 0.4s ease;
                }

                .void-chamber.integrated {
                    height: 40px;
                    min-width: 112px;
                    margin: 0;
                    border-radius: 10px;
                    justify-content: center;
                    padding: 0 10px;
                }

                .scene-3d { perspective: 1000px; z-index: 2; margin-bottom: 20px; }
                .scene-3d.integrated { margin-bottom: 0; }
                
                .dice-row-3d { display: flex; gap: 24px; }
                .dice-row-3d.integrated { gap: 6px; }

                .dice-unit { width: 50px; height: 50px; }
                .dice-unit.integrated { width: 22px; height: 22px; }

                .alchemical-cube {
                    width: 100%;
                    height: 100%;
                    position: relative;
                    transform-style: preserve-3d;
                }

                .face {
                    position: absolute;
                    width: 50px;
                    height: 50px;
                    background: rgba(8, 8, 8, 0.5);
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: var(--font-header);
                    font-size: 1.5rem;
                    box-shadow: inset 0 0 20px rgba(197, 160, 89, 0.1);
                }

                .void-chamber.integrated .face {
                    width: 22px;
                    height: 22px;
                    font-size: 0.72rem;
                }

                .face.front  { transform: rotateY(0deg) translateZ(25px); color: var(--accent-color); border-color: var(--accent-color); text-shadow: 0 0 10px var(--accent-glow); }
                .face.back   { transform: rotateY(180deg) translateZ(25px); color: var(--accent-color); }
                .face.right  { transform: rotateY(90deg) translateZ(25px); color: var(--danger-color); border-color: var(--danger-color); }
                .face.left   { transform: rotateY(-90deg) translateZ(25px); color: var(--danger-color); }
                .face.top    { transform: rotateX(90deg) translateZ(25px); background: #111; color: var(--accent-color); }
                .face.bottom { transform: rotateX(-90deg) translateZ(25px); background: #111; color: var(--accent-color); }

                .void-chamber.integrated .face.front { transform: rotateY(0deg) translateZ(11px); }
                .void-chamber.integrated .face.back { transform: rotateY(180deg) translateZ(11px); }
                .void-chamber.integrated .face.right { transform: rotateY(90deg) translateZ(11px); }
                .void-chamber.integrated .face.left { transform: rotateY(-90deg) translateZ(11px); }
                .void-chamber.integrated .face.top { transform: rotateX(90deg) translateZ(11px); }
                .void-chamber.integrated .face.bottom { transform: rotateX(-90deg) translateZ(11px); }

                .quantum-result {
                    position: absolute;
                    bottom: 20px;
                    right: 30px;
                    text-align: right;
                    z-index: 3;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                .quantum-result.integrated {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0;
                    background: rgba(0, 0, 0, 0.56);
                    backdrop-filter: blur(8px);
                    padding: 0;
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    border-radius: 9px;
                    z-index: 10;
                    text-align: center;
                }

                .res-ladder {
                    font-family: var(--font-header);
                    font-size: 0.7rem;
                    letter-spacing: 0.25em;
                    color: var(--accent-color);
                    margin-bottom: -5px;
                    opacity: 0.8;
                    text-shadow: 0 0 10px rgba(197, 160, 89, 0.2);
                }

                .res-value {
                    font-family: var(--font-header);
                    font-size: 3.5rem;
                    line-height: 1;
                    color: var(--accent-color);
                    font-weight: 400;
                }

                .quantum-result.integrated .res-value {
                    font-size: 1.35rem;
                    font-weight: 700;
                    letter-spacing: 0.03em;
                    line-height: 1;
                }

                .quantum-result.integrated .res-ladder {
                    font-size: 0.45rem;
                    letter-spacing: 0.12em;
                    margin-bottom: 0;
                    opacity: 0.72;
                }

                .res-value.pos { text-shadow: 0 0 30px var(--accent-glow); }
                .res-value.neg { color: #ff3333; text-shadow: 0 0 30px rgba(255, 51, 51, 0.4); }

                .animate-pop { animation: pop 0.6s cubic-bezier(0.19, 1, 0.22, 1); }
                @keyframes pop {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
