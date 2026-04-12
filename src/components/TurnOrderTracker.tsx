import React, { useEffect, useRef, useState } from "react";
import { Character } from "@/types/domain";
import { ChevronRight, Shield, Swords, Skull, AlertTriangle } from "lucide-react";
import { isCharacterEliminated } from "@/lib/gameLogic";
import { globalEventStore } from "@/lib/eventStore";

import { getPublicUrl } from "@/lib/storageClient";

import { TurnTimer } from "./TurnTimer";

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
}

const TrackerItem = ({ char, isActive, isTarget, index, itemsRef, effectType, damage, soundSettings }: {
    char: Character,
    isActive: boolean,
    isTarget: boolean,
    index: number,
    itemsRef: React.MutableRefObject<Map<string, HTMLDivElement | null>>,
    effectType?: 'slash' | 'shield',
    damage?: number,
    soundSettings?: TurnOrderTrackerProps['soundSettings']
}) => {
    const prevEliminatedRef = useRef(isCharacterEliminated(char));

    const getSfxUrl = (path?: string) => {
        if (!path) return '';
        return getPublicUrl(path);
      };

    // Play audio when effect appears
    useEffect(() => {
        if (effectType === 'slash') {
            const url = getSfxUrl(soundSettings?.hit) || "/audio/Effects/atack.MP3";
            console.log("Playing hit sound:", url);
            const audio = new Audio(url);
            audio.volume = 0.5;
            audio.play().catch(e => console.warn("Hit sound failed:", e));
        } else if (effectType === 'shield') {
            const url = getSfxUrl(soundSettings?.defense) || "/audio/Effects/defesa.MP3";
            console.log("Playing defense sound:", url);
            const audio = new Audio(url);
            audio.volume = 0.5;
            audio.play().catch(e => console.warn("Defense sound failed:", e));
        }
    }, [effectType, soundSettings]);

    // Death Sound logic
    useEffect(() => {
        const isCurrentlyEliminated = isCharacterEliminated(char);
        if (isCurrentlyEliminated && !prevEliminatedRef.current) {
            // Just died!
            const url = getSfxUrl(soundSettings?.death) || "/audio/Effects/morte.mp3";
            console.log("Playing death sound for", char.name, ":", url);
            const audio = new Audio(url);
            audio.volume = 0.6;
            audio.play().catch(e => console.warn("Death sound failed:", e));
        }
        prevEliminatedRef.current = isCurrentlyEliminated;
    }, [char, soundSettings]);

    const isHazard = char.isHazard;
    const arenaSide = char.arenaSide as string | undefined;
    const isThreat = (arenaSide === 'THREAT') || (char.isNPC && arenaSide !== 'HERO');

    // Determine color
    const sideColor = isHazard
        ? '#a855f7'
        : isThreat
            ? '#ff4444'
            : (char.isNPC ? '#50a6ff' : '#c5a059');

    // Calculate Damage/Stress Level
    const physicalTotal = char.stress.physical.length;
    const physicalMarked = char.stress.physical.filter(Boolean).length;
    const mentalTotal = char.stress.mental.length;
    const mentalMarked = char.stress.mental.filter(Boolean).length;

    // Consequences
    const consequenceKeys = Object.keys(char.consequences);
    const standardSlots = ["mild", "moderate", "severe"];
    const extraSlots = consequenceKeys.filter(k => !standardSlots.includes(k));
    const totalCapacity = physicalTotal + mentalTotal + standardSlots.length + extraSlots.length;

    let filledConsequences = 0;
    consequenceKeys.forEach(key => {
        if (char.consequences[key]?.text && char.consequences[key]?.text.trim().length > 0) {
            filledConsequences++;
        }
    });

    const totalMarked = physicalMarked + mentalMarked + filledConsequences;
    const damagePercentage = Math.min(100, Math.max(0, (totalMarked / Math.max(1, totalCapacity)) * 100));
    const isDead = isCharacterEliminated(char);

    return (
        <div
            ref={(el) => {
                if (el) itemsRef.current.set(char.id, el);
                else itemsRef.current.delete(char.id);
            }}
            className={`tracker-item ${isActive ? 'active' : ''} ${isTarget ? 'target' : ''}`}
            style={{ '--side-color': sideColor } as any}
        >
            <div className="portrait-tall">
                <div className="portrait-content">
                    {char.imageUrl ? (
                        <img src={char.imageUrl} alt={char.name} />
                    ) : (
                        <div className="portrait-placeholder">
                            {isHazard ? (
                                <AlertTriangle size={24} />
                            ) : isThreat ? (
                                <Skull size={24} />
                            ) : char.isNPC ? (
                                <Shield size={24} />
                            ) : (
                                <Swords size={24} />
                            )}
                        </div>
                    )}

                    {/* Liquid Overlay */}
                    <div
                        className="portrait-blood-overlay"
                        style={{ height: `${damagePercentage}%` }}
                    ></div>

                    {/* Combat Effects Overlays */}
                    {effectType === 'slash' && (
                        <div className="effect-overlay slash-effect">
                            <img src="/atack.gif" alt="Slash" className="effect-gif" />
                        </div>
                    )}
                    {effectType === 'shield' && (
                        <div className="effect-overlay shield-effect">
                            <img src="/defense.gif" alt="Shield" className="effect-gif" />
                        </div>
                    )}

                    {isDead && (
                        <div className="portrait-death-overlay">
                            <Skull size={48} className="death-skull" />
                        </div>
                    )}
                </div>

                {/* Damage Number Overlay - Moved outside portrait-content to allow "falling out" */}
                {effectType === 'slash' && damage !== undefined && damage > 0 && (
                    <div className="damage-number">-{damage}</div>
                )}

                <div className="turn-number">{index + 1}</div>
            </div>
            <div className="char-mini-name">{char.name.split(' ')[0].toUpperCase()}</div>
        </div>
    );
};

export function TurnOrderTracker({
    characters,
    currentTurnIndex,
    activeCharacterId,
    targetId,
    soundSettings,
    lastTurnChangeTimestamp
}: TurnOrderTrackerProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef<Map<string, HTMLDivElement | null>>(new Map());

    const [focusId, setFocusId] = useState<string | null>(null);
    const [effectTrigger, setEffectTrigger] = useState<{ id: string, type: 'slash' | 'shield', damage: number } | null>(null);
    const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Combat Event Listener at Parent Level to coordinate focus
    useEffect(() => {
        const unsubscribe = globalEventStore.subscribe((event) => {
            if (event.type === "COMBAT_OUTCOME") {
                const payload = event.payload;
                const targetId = payload.defenderId;
                const result = payload.result;
                const isHit = result > 0;

                // Clear any existing focus timeout
                if (focusTimeoutRef.current) {
                    clearTimeout(focusTimeoutRef.current);
                }

                // Set Focus to Target
                setFocusId(targetId);

                // Trigger Effect on specific item
                setEffectTrigger({
                    id: targetId,
                    type: isHit ? 'slash' : 'shield',
                    damage: result > 0 ? result : 0
                });

                // Clear focus after animation (Extended time for damage display)
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

    // Auto-scroll to center active character OR focused character
    useEffect(() => {
        const targetToScroll = focusId || activeCharacterId;

        if (targetToScroll && itemsRef.current.has(targetToScroll)) {
            const node = itemsRef.current.get(targetToScroll);
            if (node) {
                node.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeCharacterId, focusId]);

    if (!characters || characters.length === 0) return null;

    return (
        <div className="turn-tracker-container animate-reveal-tracker">
            <div className="tracker-scroll custom-scrollbar" ref={scrollContainerRef}>
                <div className="tracker-items-center">
                    {characters.map((char, index) => (
                        <TrackerItem
                            key={char.id}
                            char={char}
                            isActive={char.id === activeCharacterId}
                            isTarget={char.id === targetId || char.id === focusId}
                            index={index}
                            itemsRef={itemsRef}
                            effectType={effectTrigger?.id === char.id ? effectTrigger.type : undefined}
                            damage={effectTrigger?.id === char.id ? effectTrigger.damage : undefined}
                            soundSettings={soundSettings}
                        />
                    ))}
                </div>
            </div>

            {/* Timer only for active character - REMOVED: Managed centrally in page.tsx */}
            {/* {activeCharacterId && characters.find(c => c.id === activeCharacterId) && (
                <div className="turn-timer-wrapper">
                    <TurnTimer
                         // ... props
                    />
                </div>
            )} */}

            <style jsx>{`
                .turn-timer-wrapper {
                    position: absolute;
                    top: -40px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 300px;
                    z-index: 100;
                }
                .turn-tracker-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: none;
                    padding: 0;
                    width: 100%;
                    box-shadow: none;
                    backdrop-filter: none;
                    min-height: auto;
                    gap: 24px;
                    overflow: hidden;
                }

                .tracker-scroll {
                    display: flex;
                    align-items: center;
                    overflow-x: auto;
                    padding: 20px 0;
                    flex-grow: 1;
                    scroll-behavior: smooth;
                    justify-content: flex-start;
                    width: 100%;
                    mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
                }

                .tracker-items-center {
                    display: flex;
                    align-items: flex-end;
                    gap: 16px;
                    margin: 0;
                    padding: 0 calc(50% - 60px);
                    min-width: min-content;
                }
                
                /* Global styles for TrackerItem because scoped jsx in loop is tricky or just cleaner here */
                :global(.tracker-item) {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
                    opacity: 0.5; 
                    transform: scale(0.9);
                    position: relative;
                    flex-shrink: 0;
                    cursor: pointer;
                    filter: grayscale(0.6);
                }

                :global(.tracker-item:hover) {
                    opacity: 0.8;
                    transform: scale(0.95);
                    filter: grayscale(0.2);
                }

                :global(.tracker-item.active) {
                    opacity: 1;
                    transform: scale(1.15) translateY(-5px);
                    z-index: 10;
                    filter: grayscale(0);
                    margin: 0 10px;
                }
                
                :global(.portrait-tall) {
                    width: 110px;
                    height: 180px;
                    border-radius: 6px;
                    border: 1px solid var(--side-color);
                    padding: 2px;
                    background: rgba(10, 10, 12, 0.8);
                    position: relative;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
                    transition: all 0.3s;
                }
                
               :global(.active .portrait-tall) {
                    box-shadow: 0 0 40px var(--side-color), inset 0 0 20px var(--side-color);
                    border-width: 2px;
                    border-color: #fff;
                }

                :global(.tracker-item.target .portrait-tall) {
                    box-shadow: 0 0 40px #a855f7, inset 0 0 20px #a855f7;
                    border-color: #a855f7;
                    border-width: 2px;
                }

                :global(.tracker-item.target) {
                    opacity: 1;
                    filter: grayscale(0);
                    transform: scale(1.05);
                    z-index: 5;
                }

                :global(.portrait-content) {
                    width: 100%;
                    height: 100%;
                    border-radius: 2px;
                    overflow: hidden;
                    background: #050505;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
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
                
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: scale(0.5); }
                    20% { opacity: 1; transform: scale(1.2); }
                    80% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.8); }
                }

                :global(.damage-number) {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ff2222;
                    font-size: 4rem;
                    font-weight: 900;
                    text-shadow: 
                        0 0 15px rgba(255, 0, 0, 0.8), 
                        3px 3px 0px #000, 
                        -2px -2px 0px #000;
                    z-index: 50;
                    opacity: 0;
                    pointer-events: none;
                    animation: damageJump 2.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                    animation-delay: 1.1s;
                }

                @keyframes damageJump {
                    0% { opacity: 0; transform: scale(0.3) translateY(20px) rotate(0deg); }
                    15% { opacity: 1; transform: scale(1.4) translateY(-40px) translateX(20px) rotate(15deg); }
                    30% { transform: scale(1) translateY(0) translateX(40px) rotate(30deg); }
                    60% { opacity: 1; transform: scale(1.1) translateY(-20px) translateX(60px) rotate(45deg); }
                    100% { opacity: 0; transform: scale(0.8) translateY(250px) translateX(100px) rotate(90deg); }
                }

                :global(.portrait-death-overlay) {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ff0000;
                    font-size: 3rem;
                    font-weight: bold;
                    text-shadow: 0 0 10px #000;
                    pointer-events: none;
                    animation: fadeIn 0.5s;
                    z-index: 3;
                }

                :global(.death-skull) {
                    color: #ff0000;
                    filter: drop-shadow(0 0 8px rgba(255, 0, 0, 0.8)) drop-shadow(0 0 20px rgba(255, 0, 0, 0.5));
                    animation: skullPulse 1.5s ease-in-out infinite;
                }

                @keyframes skullPulse {
                    0%, 100% { transform: scale(1); opacity: 0.9; }
                    50% { transform: scale(1.1); opacity: 1; }
                }

                :global(.portrait-content img) {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    object-position: top center;
                    position: relative;
                    z-index: 1;
                }

                :global(.portrait-placeholder) {
                    color: var(--side-color);
                    opacity: 0.6;
                }

                :global(.turn-number) {
                    position: absolute;
                    top: -6px;
                    left: -6px;
                    background: var(--side-color);
                    color: #fff;
                    font-size: 0.6rem;
                    font-weight: bold;
                    width: 16px;
                    height: 16px;
                    border-radius: 3px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.2);
                    z-index: 3;
                    transition: all 0.3s;
                }
                
                :global(.active .turn-number) {
                    background: #fff;
                    color: #000;
                    transform: scale(1.2);
                }

                :global(.char-mini-name) {
                    font-family: var(--font-header);
                    font-size: 0.5rem;
                    letter-spacing: 0.05em;
                    color: #888;
                    white-space: nowrap;
                    text-shadow: 0 1px 2px rgba(0,0,0,1);
                    max-width: 50px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                :global(.active .char-mini-name) {
                    color: #fff;
                    font-weight: bold;
                    transform: scale(1.1);
                    text-shadow: 0 0 10px var(--side-color);
                }
                
                .animate-reveal-tracker {
                    opacity: 0;
                    transform: translateY(-5px);
                    animation: revealTracker 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }

                @keyframes revealTracker {
                    to { opacity: 1; transform: translateY(0); }
                }

                .custom-scrollbar::-webkit-scrollbar {
                    height: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.1);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(197, 160, 89, 0.1);
                    border-radius: 1px;
                }
            `}</style>
        </div>
    );
}
