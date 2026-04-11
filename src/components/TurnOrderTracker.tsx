import React, { useEffect, useRef, useState, useMemo } from "react";
import { Character } from "@/types/domain";
import { ChevronRight, ChevronLeft, Shield, Swords, Skull, AlertTriangle, FastForward } from "lucide-react";
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
            : (char.isNPC ? '#50a6ff' : '#c5a059');

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
            
            {(distance === 0 || distance === -1 || distance === 1) && (
                <div className="char-mini-name">{char.name.split(' ')[0].toUpperCase()}</div>
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
    sessionId = ""
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
            
            {/* Top HUD: Round */}
            <div className="hud-top">
                <div className="round-badge">RODADA {currentRound}</div>
            </div>

            {/* Semicircle Carousel */}
            <div className="semicircle-arena">
                <div className="connection-arc"></div>
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

            {/* Bottom HUD: Turn Controls & Timer */}
            <div className="hud-bottom">
                {userRole === "GM" ? (
                    <div className="gm-turn-controls">
                        <button className="hud-nav-btn prev" onClick={handlePreviousTurn} title="Voltar Turno">
                            <ChevronLeft size={24} />
                        </button>
                        
                        <div className="hud-timer-container">
                            <TurnTimer
                                startTime={lastTurnChangeTimestamp ?? ''}
                                durationMinutes={isReaction ? 2 : 3}
                                isPaused={timerPaused}
                                pausedAt={timerPausedAt || undefined}
                                isGM={false} // Disable own controls since we use simplified timer here
                                onExpire={() => { console.log("Timer expired."); }}
                                onTogglePause={handleTogglePause || (() => {})}
                                onForcePass={handleForcePass || (() => {})}
                            />
                        </div>

                        <button className="hud-nav-btn next" onClick={handleNextTurn} title="Avançar Turno">
                            <ChevronRight size={24} />
                        </button>
                    </div>
                ) : (
                    <div className="player-turn-controls">
                        <div className="hud-timer-container player-timer">
                            <TurnTimer
                                startTime={lastTurnChangeTimestamp ?? ''}
                                durationMinutes={isReaction ? 2 : 3}
                                isPaused={timerPaused}
                                pausedAt={timerPausedAt || undefined}
                                isGM={false}
                                onExpire={() => { console.log("Timer expired."); }}
                                onTogglePause={() => {}}
                                onForcePass={() => {}}
                            />
                        </div>
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
                            <button className="hud-action-btn" onClick={handleNextTurn}>
                                PASSAR TURNO
                            </button>
                        ) : null}
                    </div>
                )}
            </div>

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
                    padding-top: 10px;
                    z-index: 50;
                }

                .hud-top {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 20px;
                    z-index: 60;
                }

                .round-badge {
                    background: rgba(10, 10, 10, 0.8);
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    padding: 4px 16px;
                    border-radius: 20px;
                    font-family: var(--font-header);
                    letter-spacing: 0.15em;
                    font-size: 0.8rem;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), 0 0 10px rgba(var(--accent-rgb), 0.2);
                    backdrop-filter: blur(4px);
                    font-weight: bold;
                }

                .timer-wrapper {
                    width: 250px;
                }

                /* Semicircle Area - Downward Curve */
                .semicircle-arena {
                    position: relative;
                    width: 700px;
                    height: 250px;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }

                .connection-arc {
                    position: absolute;
                    width: 600px;
                    height: 380px;
                    border: 2px solid transparent;
                    border-bottom: 2px solid rgba(255, 255, 255, 0.15);
                    border-radius: 50%;
                    top: -240px; /* Moves the circle up so the bottom arc passes through the avatars */
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
                    transform: translate(-50%, 120px) scale(1);
                    opacity: 1;
                    z-index: 20;
                }
                
                :global(.tracker-item[data-distance="-1"]) {
                    transform: translate(calc(-50% - 140px), 80px) scale(0.75);
                    opacity: 0.8;
                    z-index: 15;
                    filter: brightness(0.7) grayscale(0.4);
                }
                
                :global(.tracker-item[data-distance="1"]) {
                    transform: translate(calc(-50% + 140px), 80px) scale(0.75);
                    opacity: 0.8;
                    z-index: 15;
                    filter: brightness(0.7) grayscale(0.4);
                }
                
                :global(.tracker-item[data-distance="-2"]) {
                    transform: translate(calc(-50% - 240px), 40px) scale(0.55);
                    opacity: 0.5;
                    z-index: 10;
                    filter: brightness(0.4) grayscale(0.8);
                }
                
                :global(.tracker-item[data-distance="2"]) {
                    transform: translate(calc(-50% + 240px), 40px) scale(0.55);
                    opacity: 0.5;
                    z-index: 10;
                    filter: brightness(0.4) grayscale(0.8);
                }
                
                :global(.tracker-item[data-distance="hidden"]) {
                    transform: translate(-50%, -20px) scale(0.2);
                    opacity: 0;
                    pointer-events: none;
                    z-index: 1;
                }

                /* Losango */
                :global(.diamond-portrait) {
                    width: 76px;
                    height: 76px;
                    background: #050505;
                    transform: rotate(45deg);
                    border-radius: 14px;
                    overflow: hidden;
                    border: 2px solid var(--side-color);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.7);
                    position: relative;
                    transition: all 0.4s ease;
                }

                :global(.center-active .diamond-portrait) {
                    width: 96px;
                    height: 96px;
                    border-width: 3px;
                    border-color: #fff;
                    box-shadow: 0 0 30px var(--side-color), inset 0 0 15px var(--side-color);
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

                :global(.char-mini-name) {
                    margin-top: 24px;
                    font-family: var(--font-header);
                    font-size: 0.6rem;
                    letter-spacing: 0.1em;
                    color: #aaa;
                    background: rgba(0,0,0,0.6);
                    padding: 2px 8px;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.1);
                    text-shadow: 0 1px 2px #000;
                    z-index: 25;
                }

                :global(.center-active .char-mini-name) {
                    color: #fff;
                    font-weight: bold;
                    border-color: var(--side-color);
                    box-shadow: 0 0 10px var(--side-color);
                    font-size: 0.75rem;
                }

                /* HUD Bottom: Controles */
                .hud-bottom {
                    display: flex;
                    justify-content: center;
                    width: 100%;
                    z-index: 60;
                }

                .gm-turn-controls {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                }

                .hud-timer-container {
                    min-width: 80px;
                    display: flex;
                    justify-content: center;
                    color: var(--accent-color);
                    font-size: 1.2rem;
                    font-weight: bold;
                    letter-spacing: 0.1em;
                    text-shadow: 0 0 10px rgba(var(--accent-rgb), 0.5);
                }

                .player-timer {
                    margin-bottom: 20px;
                }

                .hud-nav-btn {
                    background: transparent;
                    border: none;
                    color: rgba(197, 160, 89, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 0;
                }

                .hud-nav-btn:hover {
                    color: #C5A059;
                    transform: scale(1.1);
                    filter: drop-shadow(0 0 5px rgba(197, 160, 89, 0.5));
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
                    padding: 8px 24px;
                    font-family: var(--font-header);
                    font-size: 0.8rem;
                    letter-spacing: 0.15em;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.3s;
                    box-shadow: 0 0 15px rgba(var(--accent-rgb), 0.2);
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
