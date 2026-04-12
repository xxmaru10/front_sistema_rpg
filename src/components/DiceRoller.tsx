"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { useDiceRoller } from "@/hooks/useDiceRoller";
import { RollerInputs } from "./DiceRoller/RollerInputs";
import { DiceChamber } from "./DiceRoller/DiceChamber";
import { Character } from "@/types/domain";
import { Dices } from "lucide-react";

interface DiceRollerProps {
    sessionId: string;
    actorUserId: string;
    characters: Character[];
    fixedCharacterId?: string;
    isIntegrated?: boolean;
    targetDiff?: number;
    challengeDescription?: string;
    disabled?: boolean;
    controlsHidden?: boolean;
    isGM?: boolean;
    stateTargetId?: string;
    isReaction?: boolean;
    lastAttackTotal?: number;
    stateDamageType?: "PHYSICAL" | "MENTAL";
    soundSettings?: {
        victory?: string;
        defeat?: string;
        hit?: string;
        death?: string;
        defense?: string;
        dice?: string;
        portrait?: string;
    };
    currentTurnActorId?: string | null;
    isCombat?: boolean;
}

export function DiceRoller(props: DiceRollerProps) {
    const {
        sessionId,
        actorUserId,
        characters,
        fixedCharacterId,
        isIntegrated = false,
        targetDiff,
        challengeDescription,
        disabled = false,
        isGM = false,
        stateTargetId,
        isReaction = false,
        lastAttackTotal,
        stateDamageType,
        soundSettings,
        currentTurnActorId,
        isCombat = false,
        controlsHidden = false
    } = props;

    const roller = useDiceRoller({
        sessionId,
        actorUserId,
        characters,
        fixedCharacterId,
        targetDiff,
        challengeDescription,
        disabled,
        isGM,
        stateTargetId,
        isReaction,
        lastAttackTotal,
        stateDamageType,
        soundSettings,
        currentTurnActorId
    });

    const challengeColors = useMemo(() => {
        if (targetDiff === undefined) return null;
        const diff = targetDiff;
        if (diff >= 8) return { primary: '#ff3333', glow: 'rgba(255, 51, 51, 0.3)', bg: 'rgba(50, 10, 10, 1)' };
        if (diff >= 6) return { primary: '#ff6600', glow: 'rgba(255, 102, 0, 0.3)', bg: 'rgba(45, 20, 10, 1)' };
        if (diff >= 4) return { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.3)', bg: 'rgba(35, 15, 50, 1)' };
        if (diff >= 2) return { primary: '#50a6ff', glow: 'rgba(80, 166, 255, 0.3)', bg: 'rgba(10, 20, 40, 1)' };
        return { primary: '#4ade80', glow: 'rgba(74, 222, 128, 0.3)', bg: 'rgba(10, 35, 20, 1)' };
    }, [targetDiff]);

    const rollTriggerRef = useRef<HTMLButtonElement>(null);
    const [rollNudge, setRollNudge] = useState(false);
    const requestRollAttention = useCallback(() => {
        if (!isIntegrated) return;
        setRollNudge(true);
    }, [isIntegrated]);

    if (characters.length === 0) return null;

    return (
        <div className={`probability-grid tarot-style animate-reveal ${isIntegrated ? 'integrated' : ''} ${disabled ? 'disabled-mode' : ''} ${controlsHidden ? 'controls-hidden-mode' : ''} ${isReaction && !disabled ? 'reaction-active' : ''} ${roller.actionType === 'ATTACK' ? `damage-type-${roller.damageType.toLowerCase()}` : ""}`}>
            {!isIntegrated && (
                <div className="roller-brand">
                    <div className="brand-dot"></div>
                    <h3 className="brand-title">ROLADOR DE DADOS FATE</h3>
                    {isReaction && !disabled && (
                        <span className="reaction-label animate-pulse">REAGINDO!</span>
                    )}
                </div>
            )}

            {disabled ? (
                <div className="disabled-overlay-message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '0 20px', color: '#ff4444', fontWeight: 'bold', letterSpacing: '0.1em', textAlign: 'center', fontSize: isIntegrated ? '0.9rem' : '1.2rem' }}>
                    AGUARDE A SUA VEZ
                </div>
            ) : controlsHidden ? (
                /* When it's not the player's turn: keep the strip rendered
                   but collapse all inner controls so only the log button
                   (rendered outside this component) remains visible. */
                null
            ) : (
                <>
                    <RollerInputs
                        isIntegrated={isIntegrated}
                        fixedCharacterId={fixedCharacterId}
                        characters={characters}
                        selectedCharId={roller.selectedCharId}
                        setSelectedCharId={roller.setSelectedCharId}
                        selectedSkill={roller.selectedSkill}
                        handleSkillSelect={roller.handleSkillSelect}
                        actionType={roller.actionType}
                        setActionType={roller.setActionType}
                        damageType={roller.damageType}
                        toggleDamageType={roller.toggleDamageType}
                        setExplicitDamageType={roller.setExplicitDamageType}
                        selectedItemId={roller.selectedItemId}
                        setSelectedItemId={roller.setSelectedItemId}
                        allItems={roller.allItems}
                        manualBonus={roller.manualBonus}
                        setManualBonus={roller.setManualBonus}
                        targetIds={roller.targetIds}
                        handleTargetAdd={roller.handleTargetAdd}
                        handleTargetRemove={roller.handleTargetRemove}
                        isGM={isGM}
                        activeChar={roller.activeChar}
                        isReaction={isReaction}
                        isCombat={isCombat}
                        onRequestRollAttention={requestRollAttention}
                    />

                    <button
                        ref={rollTriggerRef}
                        onClick={() => {
                            setRollNudge(false);
                            roller.handleRoll();
                        }}
                        className={`matrix-trigger ${isIntegrated ? 'integrated' : ''} ${roller.isRolling ? 'rolling' : ''} ${rollNudge && isCombat ? 'roll-nudge' : ''}`}
                        disabled={roller.isRolling}
                        title="Rolar dados"
                    >
                        <div className={`trigger-content ${isIntegrated ? 'integrated' : ''}`}>
                            {roller.isRolling ? (
                                isIntegrated ? "..." : "CONVOCANDO O DESTINO..."
                            ) : isIntegrated ? (
                                <Dices size={21} />
                            ) : (
                                "ROLAR"
                            )}
                        </div>
                        <div className="trigger-progress" style={{ width: roller.isRolling ? '100%' : '0%' }}></div>
                    </button>

                    <DiceChamber
                        isRolling={roller.isRolling}
                        diceRotations={roller.diceRotations}
                        lastTotal={roller.lastTotal}
                        getLadderLabel={roller.getLadderLabel}
                        isIntegrated={isIntegrated}
                    />
                </>
            )}

            <style jsx>{`
                .probability-grid {
                    padding: 48px 40px;
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    border: none !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .probability-grid.integrated {
                    padding: 6px 8px;
                    gap: 6px;
                    width: auto;
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: flex-start;
                    overflow: visible;
                    flex: 0 0 auto;
                }

                .probability-grid.integrated > * {
                    flex: 0 0 auto;
                }

                .roller-brand {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 8px;
                }

                .brand-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--accent-color);
                    box-shadow: 0 0 15px var(--accent-glow);
                    border-radius: 50%;
                }

                .brand-title {
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.25em;
                    color: var(--accent-color);
                    opacity: 0.8;
                }

                .damage-type-physical {
                    --accent-color: #ff4444;
                    --accent-glow: rgba(255, 68, 68, 0.4);
                }

                .damage-type-mental {
                    --accent-color: #a855f7;
                    --accent-glow: rgba(168, 85, 247, 0.4);
                }

                .matrix-trigger {
                    position: relative;
                    height: 60px;
                    min-width: 170px;
                    background: #000000;
                    border: 2px solid var(--accent-color);
                    border-radius: 40px;
                    cursor: pointer;
                    overflow: hidden;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                    box-shadow: 0 0 25px var(--accent-glow), inset 0 0 20px var(--accent-glow);
                }

                .matrix-trigger.integrated {
                    height: 44px;
                    width: 44px;
                    min-width: 44px;
                    border-radius: 12px;
                    border-width: 1.5px;
                    background: rgba(255, 255, 255, 0.94);
                    border-color: rgba(255, 255, 255, 0.92);
                    box-shadow: 0 0 22px rgba(255,255,255,0.4), inset 0 0 14px rgba(255,255,255,0.3), 0 0 12px rgba(255, 215, 90, 0.28);
                }

                .trigger-content {
                    position: relative;
                    z-index: 2;
                    font-family: var(--font-header);
                    font-size: 1.1rem;
                    letter-spacing: 0.3em;
                    color: var(--accent-color);
                    transition: all 0.4s;
                    text-shadow: 0 0 10px var(--accent-glow), 0 0 20px var(--accent-glow);
                }

                .trigger-content.integrated {
                    letter-spacing: 0;
                    font-size: 0.85rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #06090f;
                    text-shadow: none;
                }

                .matrix-trigger:hover .trigger-content { 
                    color: #fff; 
                    letter-spacing: 0.4em; 
                    text-shadow: 0 0 20px #fff, 0 0 40px var(--accent-glow); 
                }

                .matrix-trigger.integrated:hover .trigger-content {
                    letter-spacing: 0;
                    text-shadow: 0 0 14px #fff, 0 0 20px var(--accent-glow);
                }
                .matrix-trigger:hover { 
                    background: radial-gradient(circle at center, rgba(var(--accent-rgb), 0.6) 0%, rgba(var(--accent-rgb), 0.1) 100%);
                    box-shadow: 0 0 50px var(--accent-glow), inset 0 0 30px var(--accent-glow);
                    border-color: #fff;
                    transform: scale(1.02);
                }

                .matrix-trigger.integrated:hover {
                    transform: scale(1.08);
                    background: #ffffff;
                    border-color: #ffffff;
                    box-shadow: 0 0 36px rgba(255,255,255,0.5), inset 0 0 18px rgba(255,255,255,0.35), 0 0 18px rgba(255, 220, 90, 0.4);
                }

                .trigger-progress {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 100%;
                    background: var(--accent-color);
                    z-index: 1;
                    transition: width 1.5s linear;
                    opacity: 0.3;
                }

                .rolling .trigger-content { color: #000; }

                .probability-grid.integrated.controls-hidden-mode {
                    /* Keep the container visible but collapse inner content */
                }

                .probability-grid.integrated.disabled-mode {
                    opacity: 0.5;
                    pointer-events: none;
                    filter: grayscale(90%);
                    transition: all 0.5s ease;
                }

                .probability-grid.integrated.reaction-active {
                    opacity: 1;
                    filter: none !important;
                    box-shadow: 0 0 40px rgba(168, 85, 247, 0.2);
                }

                .reaction-label {
                    font-family: var(--font-header);
                    font-size: 0.7rem;
                    color: #a855f7;
                    font-weight: bold;
                    letter-spacing: 0.2em;
                    margin-left: auto;
                    text-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
                }

                .matrix-trigger.roll-nudge {
                    animation: rollNudgePulse 0.55s ease-in-out infinite;
                    border-color: rgba(255, 215, 0, 1);
                    box-shadow: 0 0 22px rgba(250, 204, 21, 0.55), 0 0 44px rgba(250, 120, 40, 0.35);
                }

                @keyframes rollNudgePulse {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    20% { transform: translate(-2px, 1px) rotate(-4deg); }
                    40% { transform: translate(2px, -1px) rotate(4deg); }
                    60% { transform: translate(-1px, -1px) rotate(-3deg); }
                    80% { transform: translate(1px, 1px) rotate(3deg); }
                }
            `}</style>
        </div>
    );
}
