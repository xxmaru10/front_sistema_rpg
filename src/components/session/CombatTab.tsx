"use client";

import { useEffect, useMemo, useState } from "react";
import { Character, Aspect, ActionEvent } from "@/types/domain";
import { ChevronLeft, ChevronRight, FastForward, Trash2, Dice5 } from "lucide-react";
import { CombatCard } from "@/components/CombatCard";
import { TurnTimer } from "@/components/TurnTimer";
import { DiceRoller } from "@/components/DiceRoller";
import { CombatLog } from "@/components/CombatLog";
import { isCharacterEliminated } from "@/lib/gameLogic";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface CombatTabProps {
    sessionId: string;
    actorUserId: string;
    userRole: 'GM' | 'PLAYER';
    fixedCharacterId?: string;
    state: any;
    events: ActionEvent[];
    eventSessionMap: Record<string, number>;
    isRefreshing?: boolean;
    combatantList: Character[];
    aspectList: Aspect[];
    challengeMode: boolean;
    currentTurnActorId: string | null;
    isCurrentPlayerActive: boolean | undefined;
    lastActionTimestamp: string | null;
    lastReactionAttack: { total: number } | null | undefined;
    showDiceRoller: boolean;
    setShowDiceRoller: (value: boolean) => void;
    handleRemoveCharacter: (id: string) => void;
    handleNextTurn: (skipRound: boolean) => void;
    handleTogglePause: () => void;
    handleForcePass: () => void;
    handlePreviousTurn: () => void;
    handleChallengeUpdate: (patch: Partial<{ isActive: boolean; text: string; difficulty: number; aspects?: string[] }>) => void;
    characterList: Character[];
    onRefresh?: () => void;
}

export function CombatTab({
    sessionId,
    actorUserId,
    userRole,
    fixedCharacterId,
    state,
    events,
    eventSessionMap,
    isRefreshing,
    combatantList,
    aspectList,
    challengeMode,
    currentTurnActorId,
    isCurrentPlayerActive,
    lastActionTimestamp,
    lastReactionAttack,
    showDiceRoller,
    setShowDiceRoller,
    handleRemoveCharacter,
    handleNextTurn,
    handleTogglePause,
    handleForcePass,
    handlePreviousTurn,
    handleChallengeUpdate,
    characterList,
    onRefresh
}: CombatTabProps) {
    const [isHeroDrawerOpen, setIsHeroDrawerOpen] = useState(false);
    const [isThreatDrawerOpen, setIsThreatDrawerOpen] = useState(false);

    const heroCombatants = useMemo(
        () => combatantList.filter(c => !c.isHazard && (c.arenaSide === "HERO" || (!c.isNPC && !c.arenaSide))),
        [combatantList]
    );

    const threatCombatants = useMemo(
        () => combatantList.filter(c => !c.isHazard && c.isNPC && c.arenaSide !== "HERO"),
        [combatantList]
    );

    const threatHazards = useMemo(
        () => combatantList.filter(c => c.isHazard && c.arenaSide !== "HERO"),
        [combatantList]
    );

    const normalizedActorUserId = actorUserId?.trim().toLowerCase() || "";

    const heroPreview = useMemo(() => {
        if (heroCombatants.length === 0) return null;
        if (userRole === "PLAYER") {
            if (fixedCharacterId) {
                const linkedCharacter = heroCombatants.find(c => c.id === fixedCharacterId);
                if (linkedCharacter) return linkedCharacter;
            }

            const ownedCharacter = heroCombatants.find(
                c => (c.ownerUserId || "").trim().toLowerCase() === normalizedActorUserId
            );
            if (ownedCharacter) return ownedCharacter;
        }

        return heroCombatants[0];
    }, [heroCombatants, userRole, fixedCharacterId, normalizedActorUserId]);

    const threatPreview = useMemo(() => {
        if (threatCombatants.length === 0) return null;
        return threatCombatants[0];
    }, [threatCombatants]);

    const heroDrawerCards = isHeroDrawerOpen
        ? heroCombatants
        : heroPreview ? [heroPreview] : [];

    const threatDrawerCards = isThreatDrawerOpen
        ? threatCombatants
        : threatPreview ? [threatPreview] : [];
    const showChallengePanel = challengeMode && (userRole === "GM" || (state.challenge?.difficulty || 0) !== 0);

    const hasExpandedHeroes = false;
    const hasExpandedThreats = threatHazards.length > 0;
    const hasChallengePanel = showChallengePanel;

    useEffect(() => {
        if (heroCombatants.length === 0) setIsHeroDrawerOpen(false);
    }, [heroCombatants.length]);

    useEffect(() => {
        if (threatCombatants.length === 0) setIsThreatDrawerOpen(false);
    }, [threatCombatants.length]);

    return (
        <div className="combat-display animate-reveal">
            <div className="display-header">
                <div className="gm-actions-row">
                </div>
            </div>



            <div
                className={`combat-arena-layout${hasExpandedHeroes ? " has-expanded-left" : ""}${hasExpandedThreats ? " has-expanded-right" : ""}${hasChallengePanel ? " has-challenge-right" : ""}${isHeroDrawerOpen ? " hero-drawer-open" : ""}${isThreatDrawerOpen ? " threat-drawer-open" : ""}`}
            >
                {/* Coluna 1: Herói Ativo (Esquerda) */}
                <div className="combat-party combat-side-column">
                    {heroCombatants.length === 0 ? (
                        <div className="empty-combat-text p-4 text-center border border-dashed border-[var(--accent-color)30] rounded opacity-50 text-xs">
                            Nenhum aliado na sessão.
                        </div>
                    ) : (
                        <div className="combat-side-lane hero-side-lane">
                            <div className={`combat-avatar-drawer side-left hero-drawer${isHeroDrawerOpen ? " is-open" : ""}`}>

                                <div className="combat-avatar-panel">
                                    <div className={`combat-avatar-rail hero-avatar-rail ${isHeroDrawerOpen ? "is-expanded" : "is-collapsed"}`}>
                                        {heroDrawerCards.map(char => (
                                            isHeroDrawerOpen ? (
                                                <CombatCard
                                                    key={`${char.id}-hero-open`}
                                                    character={char}
                                                    sessionId={sessionId as string}
                                                    actorUserId={actorUserId}
                                                    isGM={userRole === "GM"}
                                                    onRemove={char.isNPC ? () => handleRemoveCharacter(char.id) : undefined}
                                                    isCurrentTurn={currentTurnActorId === char.id}
                                                    isLinkedCharacter={fixedCharacterId === char.id}
                                                    onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)}
                                                    avatarSide="left"
                                                />
                                            ) : (
                                                <CombatCard
                                                    key={`${char.id}-hero-preview`}
                                                    character={char}
                                                    sessionId={sessionId as string}
                                                    actorUserId={actorUserId}
                                                    isGM={userRole === "GM"}
                                                    isCurrentTurn={currentTurnActorId === char.id}
                                                    isLinkedCharacter={fixedCharacterId === char.id}
                                                    displayMode="compact"
                                                    avatarSide="left"
                                                    onToggleExpanded={() => setIsHeroDrawerOpen(true)}
                                                />
                                            )
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Coluna Central: Arena & Dice Roller */}
                <div className={`combat-center ${(userRole !== "GM" && !isCurrentPlayerActive && !challengeMode) ? 'controls-locked' : ''}`}>
                    <div className="scene-aspects-strip">
                        {aspectList.filter(a => a.scope === "SCENE").map(a => (
                            <div key={a.id} className="scene-aspect-token tarot-style">
                                <div className="aspect-token-name">{a.name.toUpperCase()}</div>
                                <div className="aspect-token-invokes">{a.freeInvokes}</div>
                            </div>
                        ))}
                    </div>

                    {/* Turn Timer Area */}
                    {currentTurnActorId && (
                        <div className="timer-wrapper animate-reveal">
                            <TurnTimer
                                startTime={lastActionTimestamp ?? ''}
                                durationMinutes={state.isReaction ? 2 : 3}
                                isPaused={!!state.timerPaused}
                                pausedAt={state.timerPausedAt}
                                isGM={userRole === "GM"}
                                onExpire={() => {
                                    // Disabled auto-pass per user request. Timer just rolls.
                                    // if (isCurrentPlayerActive || userRole === "GM") {
                                    //    handleForcePass();
                                    // }
                                    console.log("Timer expired, but auto-pass is disabled.");
                                }}
                                onTogglePause={handleTogglePause}
                                onForcePass={handleForcePass}
                            />
                        </div>
                    )}

                    {/* Combat Control Bar - Moved Here */}


                    {(!state.turnOrder || state.turnOrder.length === 0) ? null : (
                        <div className="combat-control-bar animate-reveal">
                            <div className="round-counter">
                                <span className="label">RODADA</span>
                                <span className="value">{state.currentRound || 1}</span>
                            </div>

                            <div className="combat-actions">
                                {userRole === "GM" ? (
                                    <div className="gm-turn-controls">
                                        <button className="nav-btn prev" onClick={handlePreviousTurn} title="Voltar Turno">
                                            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                        <span className="turn-indicator">
                                            {(state.currentTurnIndex || 0) + 1} / {state.turnOrder.length}
                                        </span>
                                        <button className="nav-btn next" onClick={() => handleNextTurn(false)} title="Avançar Turno">
                                            <ChevronRight size={20} />
                                        </button>
                                        <div className="divider-vt"></div>
                                        <button className="end-round-btn fancy-round-btn" onClick={() => handleNextTurn(true)}>
                                            <FastForward size={16} />
                                            PASSAR RODADA
                                        </button>
                                        <div className="divider-vt"></div>
                                        <button
                                            className="trash-end-combat-btn"
                                            onClick={() => {
                                                if (confirm("Encerrar combate e iniciar modo desafio? Todas as ameaças serão removidas.")) {
                                                    // 1. Activate Challenge Mode
                                                    handleChallengeUpdate({ isActive: true });

                                                    // 2. Clear Turn Order
                                                    globalEventStore.append({
                                                        id: uuidv4(),
                                                        sessionId,
                                                        seq: 0,
                                                        type: "TURN_ORDER_UPDATED",
                                                        actorUserId,
                                                        createdAt: new Date().toISOString(),
                                                        visibility: "PUBLIC",
                                                        payload: { characterIds: [] }
                                                    } as any);

                                                    // 3. Remove all Threats from Arena
                                                    const threats = characterList.filter(c => c.isNPC && c.arenaSide !== "HERO" && c.activeInArena === true);
                                                    threats.forEach(t => handleRemoveCharacter(t.id));

                                                    // 4. Clear any stuck reaction
                                                    globalEventStore.append({
                                                        id: uuidv4(),
                                                        sessionId,
                                                        seq: 0,
                                                        type: "COMBAT_REACTION_ENDED",
                                                        actorUserId,
                                                        createdAt: new Date().toISOString(),
                                                        visibility: "PUBLIC",
                                                        payload: {}
                                                    } as any);
                                                }
                                            }}
                                            title="Encerrar combate e iniciar modo desafio"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    /* Player View */
                                    <div className="player-turn-status">
                                        {state.isReaction && state.targetId ? (() => {
                                            const targetChar = state.characters[state.targetId];
                                            const amITarget = targetChar?.ownerUserId?.trim().toLowerCase() === actorUserId?.trim().toLowerCase();

                                            if (amITarget) {
                                                return (
                                                    <button
                                                        className="end-turn-btn pulse reaction-btn"
                                                        style={{ background: '#a855f7', color: '#fff', borderColor: '#a855f7' }}
                                                        onClick={() => {
                                                            globalEventStore.append({
                                                                id: uuidv4(),
                                                                sessionId,
                                                                seq: 0,
                                                                type: "COMBAT_REACTION_ENDED",
                                                                actorUserId,
                                                                createdAt: new Date().toISOString(),
                                                                visibility: "PUBLIC",
                                                                payload: {}
                                                            } as any);
                                                        }}
                                                    >
                                                        FINALIZAR REAÇÃO
                                                    </button>
                                                );
                                            }
                                            return (
                                                <div className="turn-status-message">
                                                    <span className="waiting-text" style={{ color: '#a855f7', opacity: 1, letterSpacing: '0.1em', fontWeight: 'bold' }}>
                                                        AGUARDANDO REAÇÃO...
                                                    </span>
                                                </div>
                                            );
                                        })() : isCurrentPlayerActive ? (
                                            <div className="player-active-actions" style={{ display: 'flex', gap: '8px' }}>
                                                <button className="end-turn-btn pulse" onClick={() => handleNextTurn(false)}>
                                                    FINALIZAR TURNO
                                                </button>
                                                {state.targetId && (
                                                    <button
                                                        className="end-turn-btn"
                                                        style={{ background: 'transparent', border: '1px solid #ff4444', color: '#ff4444' }}
                                                        onClick={() => {
                                                            globalEventStore.append({
                                                                id: uuidv4(),
                                                                sessionId,
                                                                seq: 0,
                                                                type: "COMBAT_TARGET_SET",
                                                                actorUserId,
                                                                createdAt: new Date().toISOString(),
                                                                visibility: "PUBLIC",
                                                                payload: { targetId: null }
                                                            } as any);
                                                        }}
                                                    >
                                                        LIMPAR ALVO
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="turn-status-message">
                                                {/* Check if player is next (skipping dead characters) */}
                                                {(() => {
                                                    let nextActiveChar = null;
                                                    const turnOrder = state.turnOrder || [];
                                                    const currentIndex = state.currentTurnIndex || 0;

                                                    // Look ahead for the next LIVING character
                                                    for (let i = 1; i < turnOrder.length; i++) {
                                                        const checkIndex = (currentIndex + i) % turnOrder.length;
                                                        const charId = turnOrder[checkIndex];
                                                        const char = state.characters[charId];

                                                        // Check if character exists and is NOT eliminated
                                                        if (char && !isCharacterEliminated(char)) {
                                                            nextActiveChar = char;
                                                            break;
                                                        }
                                                    }



                                                    // Robust comparison: handle potential case differences or undefined
                                                    const ownerId = nextActiveChar?.ownerUserId;
                                                    const currentActorId = actorUserId;

                                                    const amINext = ownerId && currentActorId && ownerId.trim().toLowerCase() === currentActorId.trim().toLowerCase();

                                                    if (amINext) {
                                                        return (
                                                            <span className="next-up-msg animate-pulse" style={{ display: 'block', fontSize: '1rem', color: '#50a6ff', marginTop: '4px', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                                                                VOCÊ É O PRÓXIMO...
                                                            </span>
                                                        );
                                                    }

                                                    return (
                                                        <span className="waiting-text" style={{ color: 'var(--accent-color)', opacity: 0.8, letterSpacing: '0.1em' }}>
                                                            AGUARDANDO...
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {(!showDiceRoller && userRole === "GM") && (
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                            <button
                                onClick={() => setShowDiceRoller(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'linear-gradient(135deg, rgba(80, 166, 255, 0.2), rgba(10, 18, 30, 0.8))',
                                    border: '1px solid rgba(80, 166, 255, 0.5)',
                                    color: '#50a6ff',
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    fontFamily: 'var(--font-header)',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.5), inset 0 0 20px rgba(80, 166, 255, 0.2)',
                                    transition: 'all 0.3s'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6), inset 0 0 30px rgba(80, 166, 255, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5), inset 0 0 20px rgba(80, 166, 255, 0.2)';
                                }}
                            >
                                <Dice5 size={24} />
                                ABRIR ZONA DE ROLAGEM
                            </button>
                        </div>
                    )}

                    {showDiceRoller && (
                        <div className="combat-dice-integrated animate-reveal">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                <button
                                    onClick={() => setShowDiceRoller(false)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ff4444',
                                        padding: '4px',
                                        cursor: 'pointer',
                                        fontSize: '1.5rem',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        lineHeight: 1
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.2) rotate(90deg)';
                                        e.currentTarget.style.color = '#ff0000';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                        e.currentTarget.style.color = '#ff4444';
                                    }}
                                    title="Fechar"
                                >
                                    ✕
                                </button>
                            </div>
                            <DiceRoller
                                sessionId={sessionId as string}
                                actorUserId={actorUserId}
                                characters={combatantList}
                                fixedCharacterId={fixedCharacterId}
                                isIntegrated={true}
                                isGM={userRole === "GM"}
                                stateTargetId={state.targetId}
                                isReaction={state.isReaction}
                                lastAttackTotal={lastReactionAttack?.total}
                                stateDamageType={state.damageType}
                                targetDiff={challengeMode ? (state.challenge?.difficulty || 0) : undefined}
                                challengeDescription={challengeMode ? (state.challenge?.text || "") : undefined}
                                disabled={!challengeMode && (state.turnOrder && state.turnOrder.length > 0) && !isCurrentPlayerActive && userRole !== "GM"}
                                soundSettings={state.soundSettings}
                            />
                        </div>
                    )}

                    {showDiceRoller && (
                        <div className="combat-log-wrapper">
                            <CombatLog
                                events={events}
                                characters={state.characters}
                                sessionNumber={state.sessionNumber}
                                eventSessionMap={eventSessionMap}
                                isRefreshing={isRefreshing}
                                onRefresh={onRefresh}
                            />
                        </div>
                    )}
                </div>

                {/* Coluna 3: Ameaças (Direita) */}
                {/* Coluna 3: Ameaças (Direita) OU Desafio */}
                <div className="combat-threats-column combat-side-column">
                    {showChallengePanel && (() => {
                        // Dynamic color based on difficulty level
                        const diff = state.challenge?.difficulty || 0;
                        let challengeColors = { primary: '#4ade80', glow: 'rgba(74, 222, 128, 0.3)', bg: 'rgba(10, 35, 20, 1)' }; // Default/1 - Green

                        if (diff >= 8) challengeColors = { primary: '#8000ff', glow: 'rgba(128, 0, 255, 0.3)', bg: 'rgba(40, 0, 80, 1)' }; // 8+ - Purple
                        else if (diff === 7) challengeColors = { primary: '#b30059', glow: 'rgba(179, 0, 89, 0.3)', bg: 'rgba(60, 0, 30, 1)' }; // 7 - Red-Purple
                        else if (diff === 6) challengeColors = { primary: '#ff0000', glow: 'rgba(255, 0, 0, 0.3)', bg: 'rgba(60, 0, 0, 1)' }; // 6 - Red
                        else if (diff === 5) challengeColors = { primary: '#ff6600', glow: 'rgba(255, 102, 0, 0.3)', bg: 'rgba(60, 20, 0, 1)' }; // 5 - Orange
                        else if (diff === 4) challengeColors = { primary: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)', bg: 'rgba(60, 40, 0, 1)' }; // 4 - Orange-Yellow
                        else if (diff === 3) challengeColors = { primary: '#ffff00', glow: 'rgba(255, 255, 0, 0.3)', bg: 'rgba(60, 60, 0, 1)' }; // 3 - Yellow
                        else if (diff === 2) challengeColors = { primary: '#ccff00', glow: 'rgba(204, 255, 0, 0.3)', bg: 'rgba(40, 60, 0, 1)' }; // 2 - Lime

                        return (
                            <div
                                className="challenge-panel"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0',
                                    height: 'fit-content',
                                    flexShrink: 0,
                                    background: `linear-gradient(135deg, ${challengeColors.bg} 0%, rgba(10, 10, 12, 1) 100%)`,
                                    border: `1px solid ${challengeColors.primary}40`,
                                    borderLeft: `4px solid ${challengeColors.primary}`,
                                    boxShadow: `inset 0 0 40px ${challengeColors.glow}, 0 0 20px ${challengeColors.glow}, 0 4px 20px rgba(0,0,0,0.7)`,
                                    borderRadius: '8px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.5s ease',
                                    marginBottom: '8px'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: `radial-gradient(circle at top right, ${challengeColors.primary}30, transparent 70%)`, pointerEvents: 'none' }}></div>

                                <h3 className="combat-col-title" style={{ color: challengeColors.primary, textShadow: `0 0 10px ${challengeColors.glow}`, borderBottom: `1px solid ${challengeColors.primary}30`, padding: '4px 8px', fontSize: '0.7rem' }}>◈ DESAFIO ATIVO</h3>

                                <div className="challenge-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                                        <div style={{
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            border: `1px solid ${challengeColors.primary}40`,
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            boxShadow: `0 0 10px ${challengeColors.glow}`,
                                            minWidth: '50px'
                                        }}>
                                            <label style={{ fontSize: '0.35rem', color: `${challengeColors.primary}aa`, letterSpacing: '0.1em' }}>DIF</label>
                                            <input
                                                type="number"
                                                style={{
                                                    width: '35px',
                                                    height: '24px',
                                                    fontSize: '1.2rem',
                                                    textAlign: 'center',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: challengeColors.primary,
                                                    fontFamily: 'var(--font-header)',
                                                    fontWeight: 'bold',
                                                    textShadow: `0 0 10px ${challengeColors.primary}`,
                                                    outline: 'none',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                value={state.challenge?.difficulty || 0}
                                                onChange={(e) => userRole === "GM" && handleChallengeUpdate({ difficulty: parseInt(e.target.value) || 0 })}
                                                readOnly={userRole !== "GM"}
                                            />
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <textarea
                                                style={{
                                                    width: '100%',
                                                    resize: 'none',
                                                    height: '35px',
                                                    minHeight: '35px',
                                                    fontSize: '0.75rem',
                                                    lineHeight: '1.2',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderBottom: `1px solid ${challengeColors.primary}30`,
                                                    color: '#fff',
                                                    borderRadius: '0',
                                                    outline: 'none',
                                                    padding: '2px 0',
                                                    fontFamily: 'var(--font-main)',
                                                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                                                }}
                                                placeholder="Objetivo..."
                                                value={state.challenge?.text || ""}
                                                onChange={(e) => userRole === "GM" && handleChallengeUpdate({ text: e.target.value })}
                                                readOnly={userRole !== "GM"}
                                            />
                                        </div>
                                    </div>

                                    {(userRole === "GM" || (state.challenge?.aspects && state.challenge.aspects.some((a: string) => a.trim() !== ""))) && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ color: challengeColors.primary, fontSize: '0.45rem', fontWeight: 'bold', letterSpacing: '0.1em', opacity: 0.7 }}>ASPECTOS DA CENA</label>
                                            {[0, 1, 2].map(idx => {
                                                const aspectValue = (state.challenge?.aspects || [])[idx] || "";
                                                if (userRole !== "GM" && aspectValue.trim() === "") return null;

                                                return (
                                                    <input
                                                        key={idx}
                                                        type="text"
                                                        style={{
                                                            width: '100%',
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: 'none',
                                                            borderLeft: `2px solid ${challengeColors.primary}40`,
                                                            padding: '4px 8px',
                                                            fontSize: '0.75rem',
                                                            color: '#eee',
                                                            outline: 'none',
                                                            borderRadius: '2px',
                                                            fontStyle: 'italic'
                                                        }}
                                                        placeholder={`Aspecto ${idx + 1}...`}
                                                        value={aspectValue}
                                                        onChange={(e) => {
                                                            if (userRole !== "GM") return;
                                                            const newAspects = [...(state.challenge?.aspects || ["", "", ""])];
                                                            newAspects[idx] = e.target.value;
                                                            handleChallengeUpdate({ aspects: newAspects });
                                                        }}
                                                        readOnly={userRole !== "GM"}
                                                    />
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    <div className="combat-threats">
                        <div className="combat-side-lane threat-side-lane">
                            {threatCombatants.length === 0 && threatHazards.length === 0 ? (
                                <div className="empty-combat-text p-4 text-center border border-dashed border-[rgba(255,68,68,0.35)] rounded opacity-50 text-xs">
                                    Nenhuma ameaça na arena.
                                </div>
                            ) : null}

                            {threatHazards.length > 0 && (
                                <div className="combat-expanded-stack combat-hazard-stack combat-cards-stack scrollbar-arcane">
                                    {threatHazards.map(char => (
                                        <CombatCard
                                            key={char.id}
                                            character={char}
                                            sessionId={sessionId as string}
                                            actorUserId={actorUserId}
                                            isGM={userRole === "GM"}
                                            onRemove={() => handleRemoveCharacter(char.id)}
                                            isCurrentTurn={currentTurnActorId === char.id}
                                            onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)}
                                        />
                                    ))}
                                </div>
                            )}

                            {threatCombatants.length > 0 && (
                                <div className={`combat-avatar-drawer side-right threat-drawer${isThreatDrawerOpen ? " is-open" : ""}`}>

                                    <div className="combat-avatar-panel">
                                        <div className={`combat-avatar-rail threat-avatar-rail ${isThreatDrawerOpen ? "is-expanded" : "is-collapsed"}`}>
                                            {threatDrawerCards.map(char => (
                                                isThreatDrawerOpen ? (
                                                    <CombatCard
                                                        key={`${char.id}-threat-open`}
                                                        character={char}
                                                        sessionId={sessionId as string}
                                                        actorUserId={actorUserId}
                                                        isGM={userRole === "GM"}
                                                        onRemove={() => handleRemoveCharacter(char.id)}
                                                        isCurrentTurn={currentTurnActorId === char.id}
                                                        onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)}
                                                        avatarSide="right"
                                                    />
                                                ) : (
                                                    <CombatCard
                                                        key={`${char.id}-threat-preview`}
                                                        character={char}
                                                        sessionId={sessionId as string}
                                                        actorUserId={actorUserId}
                                                        isGM={userRole === "GM"}
                                                        isCurrentTurn={currentTurnActorId === char.id}
                                                        displayMode="compact"
                                                        avatarSide="right"
                                                        onToggleExpanded={() => setIsThreatDrawerOpen(true)}
                                                    />
                                                )
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
