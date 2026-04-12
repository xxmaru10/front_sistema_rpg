import React, { useEffect, useRef, useState, useMemo } from "react";
import { Character } from "@/types/domain";
import { ChevronRight, ChevronLeft, Shield, Swords, Skull, AlertTriangle, FastForward, Trash2 } from "lucide-react";
import { isCharacterEliminated } from "@/lib/gameLogic";
import { globalEventStore } from "@/lib/eventStore";
import { supabase } from "@/lib/supabaseClient";
import { TurnTimer } from "./TurnTimer";
import { v4 as uuidv4 } from "uuid";

const BUCKET_NAME = "campaign-uploads";

interface TurnOrderTrackerProps {
    characters: Character[];
    currentTurnIndex: number;
    activeCharacterId: string | null;
    targetId?: string;
    soundSettings?: {
        victory?: string;
        defeat?: string;
        hit?: string;
        death?: string;
        defense?: string;
        battleStart?: string;
    };
    lastTurnChangeTimestamp?: string;
    
    // Novas props para a HUD
    userRole?: "GM" | "PLAYER";
    currentRound?: number;
    handleNextTurn?: () => void;
    handlePreviousTurn?: () => void;
    handleForcePass?: () => void;
    handleTogglePause?: () => void;
    isReaction?: boolean;
    timerPaused?: boolean;
    timerPausedAt?: string | null;
    isCurrentPlayerActive?: boolean;
    actorUserId?: string;
    sessionId?: string;
    handleNextRound?: () => void;
    handleEndCombat?: () => void;
}

const TrackerItem = ({ 
    char, 
    isActive, 
    isTarget, 
    distance,
    effectType, 
    damage, 
    soundSettings 
}: {
    char: Character,
    isActive: boolean,
    isTarget: boolean,
    distance: number | 'hidden',
    effectType?: 'slash' | 'shield',
    damage?: number,
    soundSettings?: TurnOrderTrackerProps['soundSettings']
}) => {
    const prevEliminatedRef = useRef(isCharacterEliminated(char));

    const getSfxUrl = (path?: string) => {
        if (!path) return "";
        if (path.startsWith("http") || path.startsWith("/audio/")) return path;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        return data.publicUrl;
    };

    useEffect(() => {
        if (effectType === 'slash') {
            const url = getSfxUrl(soundSettings?.hit) || "/audio/Effects/atack.MP3";
            const audio = new Audio(url);
            audio.volume = 0.5;
            audio.play().catch(e => console.warn("Hit sound failed:", e));
        } else if (effectType === 'shield') {
            const url = getSfxUrl(soundSettings?.defense) || "/audio/Effects/defesa.MP3";
            const audio = new Audio(url);
            audio.volume = 0.5;
            audio.play().catch(e => console.warn("Defense sound failed:", e));
        }
    }, [effectType, soundSettings]);

    useEffect(() => {
        const isCurrentlyEliminated = isCharacterEliminated(char);
        if (isCurrentlyEliminated && !prevEliminatedRef.current) {
            const url = getSfxUrl(soundSettings?.death) || "/audio/Effects/morte.mp3";
            const audio = new Audio(url);
            audio.volume = 0.6;
            audio.play().catch(e => console.warn("Death sound failed:", e));
        }
        prevEliminatedRef.current = isCurrentlyEliminated;
    }, [char, soundSettings]);

    const isHazard = char.isHazard;
    const arenaSide = char.arenaSide as string | undefined;
    const isThreat = (arenaSide === 'THREAT') || (char.isNPC && arenaSide !== 'HERO');

    const sideColor = isHazard
        ? '#a855f7'
        : isThreat
            ? '#ff4444'
            : '#3b82f6'; // Azul para jogadores e aliados

    const physicalTotal = char.stress.physical.length;
    const physicalMarked = char.stress.physical.filter(Boolean).length;
    const mentalTotal = char.stress.mental.length;
    const mentalMarked = char.stress.mental.filter(Boolean).length;

    const consequenceKeys = Object.keys(char.consequences);
    const standardSlots = ["mild", "moderate", "severe"];
    const extraSlots = consequenceKeys.filter(k => !standardSlots.includes(k));
    const totalCapacity = physicalTotal + mentalTotal + standardSlots.length + extraSlots.length;

    let filledConsequences = 0;
    consequenceKeys.forEach(key => {
        if (char.consequences[key]?.text && typeof char.consequences[key]?.text === 'string' && char.consequences[key]?.text.trim().length > 0) {
            filledConsequences++;
        }
    });

    const totalMarked = physicalMarked + mentalMarked + filledConsequences;
    const damagePercentage = Math.min(100, Math.max(0, (totalMarked / Math.max(1, totalCapacity)) * 100));
    const isDead = isCharacterEliminated(char);

    return (
        <div
            className={`tracker-item ${isActive ? 'center-active' : ''} ${isTarget ? 'is-target' : ''}`}
            data-distance={distance}
            style={{ '--side-color': sideColor } as any}
        >
            <div className="diamond-portrait">
                <div className="portrait-inner">
                    {char.imageUrl ? (
                        <img src={char.imageUrl} alt={char.name} />
                    ) : (
                        <div className="portrait-placeholder">
                            {isHazard ? (
                                <AlertTriangle size={32} />
                            ) : isThreat ? (
                                <Skull size={32} />
                            ) : char.isNPC ? (
                                <Shield size={32} />
                            ) : (
                                <Swords size={32} />
                            )}
                        </div>
                    )}

                    <div
                        className="portrait-blood-overlay"
                        style={{ height: `${damagePercentage}%` }}
                    />

                    {effectType === 'slash' && (
                        <div className="effect-overlay">
                            <img src="/atack.gif" alt="Slash" className="effect-gif" />
                        </div>
                    )}
                    {effectType === 'shield' && (
                        <div className="effect-overlay">
                            <img src="/defense.gif" alt="Shield" className="effect-gif" />
                        </div>
                    )}

                    {isDead && (
                        <div className="portrait-death-overlay">
                            <Skull size={48} className="death-skull" />
                        </div>
                    )}
                </div>
            </div>

            {effectType === 'slash' && damage !== undefined && damage > 0 && (
                <div className="damage-number">-{damage}</div>
            )}
        </div>
    );
};

export function TurnOrderTracker({
    characters,
    currentTurnIndex,
    activeCharacterId,
    targetId,
    soundSettings,
    lastTurnChangeTimestamp,
    userRole = "PLAYER",
    currentRound = 1,
    handleNextTurn,
    handlePreviousTurn,
    handleForcePass,
    handleTogglePause,
    isReaction = false,
    timerPaused = false,
    timerPausedAt = null,
    isCurrentPlayerActive = false,
    actorUserId,
    sessionId = "",
    handleNextRound,
    handleEndCombat
}: TurnOrderTrackerProps) {
    const [focusId, setFocusId] = useState<string | null>(null);
    const [effectTrigger, setEffectTrigger] = useState<{ id: string, type: 'slash' | 'shield', damage: number } | null>(null);
    const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const unsubscribe = globalEventStore.subscribe((event) => {
            if (event.type === "COMBAT_OUTCOME") {
                const payload = event.payload;
                const actTargetId = payload.defenderId;
                const result = payload.result;
                const isHit = result > 0;

                if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);

                setFocusId(actTargetId);
                setEffectTrigger({
                    id: actTargetId,
                    type: isHit ? 'slash' : 'shield',
                    damage: result > 0 ? result : 0
                });

                const duration = isHit ? 3330 : 2500;
                focusTimeoutRef.current = setTimeout(() => {
                    setFocusId(null);
                    setEffectTrigger(null);
                    focusTimeoutRef.current = null;
                }, duration);
            }
        });
        return () => {
            unsubscribe();
            if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
        };
    }, []);

    // Calcula de forma circular as distâncias a partir do centro
    const centerCharacterId = focusId || activeCharacterId;
    let centerIndex = currentTurnIndex;
    
    if (focusId) {
        const fIdx = characters.findIndex(c => c.id === focusId);
        if (fIdx !== -1) centerIndex = fIdx;
    } else if (activeCharacterId && characters[currentTurnIndex]?.id !== activeCharacterId) {
        const aIdx = characters.findIndex(c => c.id === activeCharacterId);
        if (aIdx !== -1) centerIndex = aIdx;
    }

    const calculatedDistances = useMemo(() => {
        const dists: Record<string, number | 'hidden'> = {};
        const len = characters.length;
        
        characters.forEach((char, index) => {
            if (len === 0) return;
            
            let dist = (index - centerIndex) % len;
            if (dist > Math.floor(len / 2)) dist -= len;
            if (dist < -Math.floor(len / 2)) dist += len;
            
            // Limit to showing 5 items (0, -1, 1, -2, 2)
            if (Math.abs(dist) <= 2) {
                dists[char.id] = dist;
            } else {
                dists[char.id] = 'hidden';
            }
        });
        return dists;
    }, [characters, centerIndex]);

    if (!characters || characters.length === 0) return null;

    // Checks current player state for Player View Buttons
    const amITarget = useMemo(() => {
        if (!isReaction || !targetId) return false;
        const targetChar = characters.find(c => c.id === targetId);
        return targetChar?.ownerUserId?.trim().toLowerCase() === actorUserId?.trim().toLowerCase();
    }, [isReaction, targetId, characters, actorUserId]);

    return (
        <div className="turn-tracker-container animate-reveal-tracker">
            
            {/* Semicircle Carousel */}
            <div className="semicircle-arena">
                <div className="connection-arc"></div>
                {userRole === "GM" && (
                    <>
                        <button className="hud-floating-nav prev" onClick={handlePreviousTurn} title="Voltar Turno">
                            <ChevronLeft size={32} />
                        </button>
                        <button className="hud-floating-nav next" onClick={handleNextTurn} title="Avançar Turno">
                            <ChevronRight size={32} />
                        </button>
                    </>
                )}
                
                {characters.map((char) => {
                    const dist = calculatedDistances[char.id] ?? 'hidden';
                    return (
                        <TrackerItem
                            key={char.id}
                            char={char}
                            isActive={dist === 0 && !isReaction}
                            isTarget={char.id === targetId || char.id === focusId}
                            distance={dist}
                            effectType={effectTrigger?.id === char.id ? effectTrigger.type : undefined}
                            damage={effectTrigger?.id === char.id ? effectTrigger.damage : undefined}
                            soundSettings={soundSettings}
                        />
                    );
                })}

            </div>

            {/* GM Controls: Below Center Diamond */}
            {userRole === "GM" && (
                <div className="gm-center-controls">
                    {handleNextRound && (
                        <button className="gm-round-btn" onClick={handleNextRound} title="Passar Rodada">
                            <FastForward size={16} />
                        </button>
                    )}
                    {handleEndCombat && (
                        <button className="gm-trash-btn" onClick={handleEndCombat} title="Encerrar combate">
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
            )}

            {/* Bottom HUD: Player Controls */}
            {userRole === "PLAYER" && (
                <div className="hud-bottom">
                    <div className="player-turn-controls">
                        {amITarget ? (
                            <button
                                className="hud-action-btn highlight-reaction"
                                onClick={() => {
                                    globalEventStore.append({
                                        id: uuidv4(),
                                        sessionId: sessionId,
                                        seq: 0,
                                        type: "COMBAT_REACTION_ENDED",
                                        actorUserId: actorUserId || "",
                                        createdAt: new Date().toISOString(),
                                        visibility: "PUBLIC",
                                        payload: {}
                                    } as any);
                                }}
                            >
                                FINALIZAR REAÇÃO
                            </button>
                        ) : isCurrentPlayerActive ? (
                             <button className="hud-action-btn next-step-btn" onClick={handleNextTurn} title="Passar Turno">
                                 <FastForward size={22} />
                             </button>
                        ) : null}
                    </div>
                </div>
            )}

            <style jsx>{`
                .turn-tracker-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: flex-start;
                    width: 100%;
                    max-width: 800px;
                    margin: 0 auto;
                    position: relative;
                    padding-top: 0;
                    margin-top: -14px;
                    z-index: 2147483640; /* High z-index to stay above everything else */
                }

                .hud-top {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    margin-bottom: 0px;
                    z-index: 60;
                }

                .round-badge {
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    letter-spacing: 0.12em;
                    font-size: 0.72rem;
                    font-weight: bold;
                    text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.5);
                    line-height: 1;
                }

                .center-timer-wrapper {
                    position: absolute;
                    bottom: -15px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 50;
                    display: flex;
                    justify-content: center;
                }

                /* Semicircle Area - Downward Curve */
                .semicircle-arena {
                    position: relative;
                    width: 700px;
                    height: 110px;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    margin-bottom: 10px;
                    margin-top: -8px;
                }

                .connection-arc {
                    position: absolute;
                    width: 340px;
                    height: 200px;
                    border: 2px solid transparent;
                    border-bottom: 2px solid rgba(255, 255, 255, 0.15);
                    border-radius: 50%;
                    top: -168px; /* arco passa pelas pontas laterais dos losangos */
                    left: 50%;
                    transform: translateX(-50%);
                    pointer-events: none;
                    z-index: 5;
                }

                :global(.tracker-item) {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
                    transform-origin: center center;
                    filter: grayscale(0.6);
                    cursor: pointer;
                }

                :global(.tracker-item:hover) {
                    filter: grayscale(0.2);
                }

                :global(.tracker-item.center-active) {
                    filter: grayscale(0);
                }

                /* Posicionamento do Semicirculo invertido (Centro no fundo) */
                :global(.tracker-item[data-distance="0"]) {
                    transform: translate(-50%, 10px) scale(1);
                    opacity: 1;
                    z-index: 20;
                }

                :global(.tracker-item[data-distance="-1"]) {
                    transform: translate(calc(-50% - 80px), -18px) scale(0.75);
                    opacity: 0.8;
                    z-index: 15;
                    filter: brightness(0.7) grayscale(0.4);
                }

                :global(.tracker-item[data-distance="1"]) {
                    transform: translate(calc(-50% + 80px), -18px) scale(0.75);
                    opacity: 0.8;
                    z-index: 15;
                    filter: brightness(0.7) grayscale(0.4);
                }

                :global(.tracker-item[data-distance="-2"]) {
                    transform: translate(calc(-50% - 140px), -48px) scale(0.55);
                    opacity: 0.5;
                    z-index: 10;
                    filter: brightness(0.4) grayscale(0.8);
                }

                :global(.tracker-item[data-distance="2"]) {
                    transform: translate(calc(-50% + 140px), -48px) scale(0.55);
                    opacity: 0.5;
                    z-index: 10;
                    filter: brightness(0.4) grayscale(0.8);
                }

                :global(.tracker-item[data-distance="hidden"]) {
                    transform: translate(-50%, -60px) scale(0.2);
                    opacity: 0;
                    pointer-events: none;
                    z-index: 1;
                }

                /* Inclinação dos losangos para seguir o arco */
                :global(.tracker-item[data-distance="-2"] .diamond-portrait) {
                    transform: rotate(67deg);
                }
                :global(.tracker-item[data-distance="-2"] .portrait-inner) {
                    transform: translate(-50%, -50%) rotate(-67deg);
                }
                :global(.tracker-item[data-distance="-1"] .diamond-portrait) {
                    transform: rotate(57deg);
                }
                :global(.tracker-item[data-distance="-1"] .portrait-inner) {
                    transform: translate(-50%, -50%) rotate(-57deg);
                }
                :global(.tracker-item[data-distance="1"] .diamond-portrait) {
                    transform: rotate(33deg);
                }
                :global(.tracker-item[data-distance="1"] .portrait-inner) {
                    transform: translate(-50%, -50%) rotate(-33deg);
                }
                :global(.tracker-item[data-distance="2"] .diamond-portrait) {
                    transform: rotate(23deg);
                }
                :global(.tracker-item[data-distance="2"] .portrait-inner) {
                    transform: translate(-50%, -50%) rotate(-23deg);
                }

                /* Losango */
                :global(.diamond-portrait) {
                    width: 54px;
                    height: 54px;
                    background: #050505;
                    transform: rotate(45deg);
                    border-radius: 10px;
                    overflow: hidden;
                    border: 2px solid var(--side-color);
                    box-shadow: 0 5px 10px rgba(0, 0, 0, 0.7);
                    position: relative;
                    transition: all 0.4s ease;
                }

                :global(.center-active .diamond-portrait) {
                    width: 68px;
                    height: 68px;
                    border-width: 3px;
                    border-color: var(--side-color);
                    box-shadow: 0 0 28px var(--side-color), 0 0 8px var(--side-color), inset 0 0 12px var(--side-color);
                }

                :global(.is-target .diamond-portrait) {
                    border-color: #a855f7;
                    box-shadow: 0 0 40px #a855f7, inset 0 0 20px #a855f7;
                }

                :global(.portrait-inner) {
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

                :global(.portrait-inner img) {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                :global(.portrait-placeholder) {
                    color: var(--side-color);
                    opacity: 0.6;
                }

                :global(.portrait-blood-overlay) {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(180, 0, 0, 0.6);
                    transition: height 0.5s ease-in-out;
                    pointer-events: none;
                    mix-blend-mode: multiply;
                    z-index: 2;
                }

                :global(.effect-overlay) {
                    position: absolute;
                    inset: 0;
                    z-index: 10;
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeInOut 2s forwards;
                }

                :global(.effect-gif) {
                    width: 80%;
                    height: 80%;
                    object-fit: contain;
                    filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
                }

                :global(.damage-number) {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ff2222;
                    font-size: 3rem;
                    font-weight: 900;
                    text-shadow: 0 0 15px rgba(255, 0, 0, 0.8), 2px 2px 0px #000;
                    z-index: 50;
                    opacity: 0;
                    pointer-events: none;
                    animation: damageJump 2.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    animation-delay: 1.1s;
                }

                :global(.portrait-death-overlay) {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ff0000;
                    z-index: 3;
                    pointer-events: none;
                }

                :global(.death-skull) {
                    filter: drop-shadow(0 0 8px rgba(255, 0, 0, 0.8));
                    animation: skullPulse 1.5s infinite;
                }

                .gm-center-controls {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    z-index: 30;
                    margin-top: 6px;
                    margin-bottom: 4px;
                }

                .gm-round-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(10, 10, 15, 0.85);
                    border: 1px solid rgba(197, 160, 89, 0.5);
                    color: rgba(197, 160, 89, 0.7);
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .gm-round-btn:hover {
                    border-color: var(--accent-color);
                    color: var(--accent-color);
                    background: rgba(var(--accent-rgb), 0.15);
                    transform: scale(1.1);
                }

                .gm-trash-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(10, 10, 15, 0.85);
                    border: 1px solid rgba(255, 68, 68, 0.5);
                    color: rgba(255, 68, 68, 0.7);
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .gm-trash-btn:hover {
                    border-color: #ff4444;
                    color: #ff4444;
                    background: rgba(255, 68, 68, 0.15);
                    transform: scale(1.1);
                }

                /* HUD Bottom: Controles */
                .hud-bottom {
                    display: flex;
                    justify-content: center;
                    width: 100%;
                    z-index: 60;
                    margin-top: 32px; /* Push it down further avoid timer overlap */
                }

                .hud-timer-container {
                    min-width: 60px;
                    display: flex;
                    justify-content: center;
                    color: var(--accent-color);
                    font-size: 0.8rem;
                    font-weight: bold;
                    letter-spacing: 0.08em;
                    text-shadow: 0 0 12px rgba(var(--accent-rgb), 0.9), 0 0 24px rgba(var(--accent-rgb), 0.5);
                    filter: brightness(1.3);
                }

                .top-timer {
                    margin-top: 0;
                    margin-bottom: 0;
                }

                .hud-floating-nav {
                    background: transparent;
                    border: none;
                    color: rgba(197, 160, 89, 0.6);
                    position: absolute;
                    top: 42px;
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 0;
                    z-index: 25;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .hud-floating-nav.prev {
                    left: calc(50% - 78px);
                }

                .hud-floating-nav.next {
                    left: calc(50% + 50px);
                }

                .hud-floating-nav:hover {
                    color: #C5A059;
                    transform: scale(1.15);
                    filter: drop-shadow(0 0 8px rgba(197, 160, 89, 0.6));
                }

                .player-turn-controls {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }

                .hud-action-btn {
                    background: rgba(10, 10, 15, 0.9);
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    padding: 4px 12px;
                    font-family: var(--font-header);
                    font-size: 0.8rem;
                    letter-spacing: 0.15em;
                    border-radius: 12px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.3s;
                    box-shadow: 0 0 15px rgba(var(--accent-rgb), 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .next-step-btn {
                    padding: 6px 16px;
                    border-radius: 30px;
                    background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.1) 0%, rgba(var(--accent-rgb), 0.3) 100%);
                }

                .hud-action-btn:hover {
                    background: rgba(var(--accent-rgb), 0.2);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 20px rgba(var(--accent-rgb), 0.4);
                }

                .highlight-reaction {
                    border-color: #a855f7;
                    color: #fff;
                    background: rgba(168, 85, 247, 0.5);
                    animation: pulse-reaction 1.5s infinite alternate;
                }

                @keyframes pulse-reaction {
                    from { box-shadow: 0 0 10px rgba(168, 85, 247, 0.4); }
                    to { box-shadow: 0 0 25px rgba(168, 85, 247, 0.8); }
                }

                @keyframes damageJump {
                    0% { opacity: 0; transform: scale(0.3) translateY(20px) rotate(0deg); }
                    15% { opacity: 1; transform: scale(1.4) translateY(-40px) translateX(20px) rotate(15deg); }
                    30% { transform: scale(1) translateY(0) translateX(40px) rotate(30deg); }
                    60% { opacity: 1; transform: scale(1.1) translateY(-20px) translateX(60px) rotate(45deg); }
                    100% { opacity: 0; transform: scale(0.8) translateY(250px) translateX(100px) rotate(90deg); }
                }

                @keyframes fadeInOut {
                    0% { opacity: 0; transform: scale(0.5); }
                    20% { opacity: 1; transform: scale(1.2); }
                    80% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.8); }
                }

                @keyframes skullPulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
