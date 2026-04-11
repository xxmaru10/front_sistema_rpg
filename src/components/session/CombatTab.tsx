"use client";

import { useEffect, useMemo, useState } from "react";
import { Character, Aspect, ActionEvent } from "@/types/domain";
import { ChevronLeft, ChevronRight, FastForward, Trash2, Dice5, ScrollText } from "lucide-react";
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
    const [showCombatLogs, setShowCombatLogs] = useState(false);
    const [isChallengeAspectsOpen, setIsChallengeAspectsOpen] = useState(false);
    const [pinnedHeroCardIds, setPinnedHeroCardIds] = useState<string[]>([]);
    const [pinnedThreatCardIds, setPinnedThreatCardIds] = useState<string[]>([]);
    const [hoverHeroCardId, setHoverHeroCardId] = useState<string | null>(null);
    const [hoverThreatCardId, setHoverThreatCardId] = useState<string | null>(null);
    const [challengeDiffDraft, setChallengeDiffDraft] = useState<string>("0");

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
    const challengeAspects = useMemo(
        () => [0, 1, 2].map((idx) => (state.challenge?.aspects || [])[idx] || ""),
        [state.challenge?.aspects]
    );
    const hasChallengeAspects = challengeAspects.some((aspect: string) => aspect.trim() !== "");
    const challengeColors = useMemo(() => {
        const diff = state.challenge?.difficulty || 0;
        let colors = { primary: '#4ade80', glow: 'rgba(74, 222, 128, 0.3)' };

        if (diff >= 8) colors = { primary: '#8000ff', glow: 'rgba(128, 0, 255, 0.3)' };
        else if (diff === 7) colors = { primary: '#b30059', glow: 'rgba(179, 0, 89, 0.3)' };
        else if (diff === 6) colors = { primary: '#ff0000', glow: 'rgba(255, 0, 0, 0.3)' };
        else if (diff === 5) colors = { primary: '#ff6600', glow: 'rgba(255, 102, 0, 0.3)' };
        else if (diff === 4) colors = { primary: '#ffaa00', glow: 'rgba(255, 170, 0, 0.3)' };
        else if (diff === 3) colors = { primary: '#ffff00', glow: 'rgba(255, 255, 0, 0.3)' };
        else if (diff === 2) colors = { primary: '#ccff00', glow: 'rgba(204, 255, 0, 0.3)' };

        return colors;
    }, [state.challenge?.difficulty]);

    const hasExpandedHeroes = isHeroDrawerOpen;
    const hasExpandedThreats = isThreatDrawerOpen || threatHazards.length > 0;
    const shouldRenderTopRollBar = showDiceRoller || userRole === "GM";

    useEffect(() => {
        if (heroCombatants.length === 0) setIsHeroDrawerOpen(false);
        setPinnedHeroCardIds((prev) => prev.filter((id) => heroCombatants.some((c) => c.id === id)));
        if (hoverHeroCardId && !heroCombatants.some(c => c.id === hoverHeroCardId)) {
            setHoverHeroCardId(null);
        }
    }, [heroCombatants, hoverHeroCardId]);

    useEffect(() => {
        if (threatCombatants.length === 0) setIsThreatDrawerOpen(false);
        setPinnedThreatCardIds((prev) => prev.filter((id) => threatCombatants.some((c) => c.id === id)));
        if (hoverThreatCardId && !threatCombatants.some(c => c.id === hoverThreatCardId)) {
            setHoverThreatCardId(null);
        }
    }, [threatCombatants, hoverThreatCardId]);

    useEffect(() => {
        if (!showDiceRoller) setShowCombatLogs(false);
    }, [showDiceRoller]);

    useEffect(() => {
        if (!showChallengePanel) {
            setIsChallengeAspectsOpen(false);
            return;
        }
        if (hasChallengeAspects) {
            setIsChallengeAspectsOpen(true);
        }
    }, [showChallengePanel, hasChallengeAspects]);

    useEffect(() => {
        setChallengeDiffDraft(String(state.challenge?.difficulty ?? 0));
    }, [state.challenge?.difficulty]);

    useEffect(() => {
        if (!isHeroDrawerOpen) {
            setPinnedHeroCardIds([]);
            setHoverHeroCardId(null);
        }
    }, [isHeroDrawerOpen]);

    useEffect(() => {
        if (!isThreatDrawerOpen) {
            setPinnedThreatCardIds([]);
            setHoverThreatCardId(null);
        }
    }, [isThreatDrawerOpen]);

    useEffect(() => {
        if (!isHeroDrawerOpen) return;
        const firstHero = heroDrawerCards[0];
        if (!firstHero) return;
        setPinnedHeroCardIds((prev) => (prev.includes(firstHero.id) ? prev : [firstHero.id, ...prev]));
    }, [isHeroDrawerOpen, heroDrawerCards]);

    useEffect(() => {
        if (!isThreatDrawerOpen) return;
        const firstThreat = threatDrawerCards[0];
        if (!firstThreat) return;
        setPinnedThreatCardIds((prev) => (prev.includes(firstThreat.id) ? prev : [firstThreat.id, ...prev]));
    }, [isThreatDrawerOpen, threatDrawerCards]);

    return (
        <div className="combat-display animate-reveal">
            <div className="display-header">
                <div className="gm-actions-row">
                </div>
            </div>



            <div
                className={`combat-arena-layout${hasExpandedHeroes ? " has-expanded-left" : ""}${hasExpandedThreats ? " has-expanded-right" : ""}${isHeroDrawerOpen ? " hero-drawer-open" : ""}${isThreatDrawerOpen ? " threat-drawer-open" : ""}`}
            >
                {shouldRenderTopRollBar && (
                    <div className={`combat-top-strip ${showDiceRoller ? "is-open" : ""}`}>
                        {!showDiceRoller && userRole === "GM" && (
                            <button
                                onClick={() => setShowDiceRoller(true)}
                                className="combat-top-roll-open-btn"
                                title="Abrir zona de rolagem"
                                aria-label="Abrir zona de rolagem"
                            >
                                <Dice5 size={18} />
                            </button>
                        )}

                        {showDiceRoller && (
                            <div className="combat-dice-integrated animate-reveal">
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0', position: 'absolute', top: '6px', right: '6px', zIndex: 5 }}>
                                    <button
                                        onClick={() => setShowDiceRoller(false)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ff2b2b',
                                            padding: '0',
                                            cursor: 'pointer',
                                            fontSize: '1.28rem',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            lineHeight: 1,
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: 0
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.18) rotate(90deg)';
                                            e.currentTarget.style.color = '#ff0000';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                                            e.currentTarget.style.color = '#ff2b2b';
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
                                <button
                                    type="button"
                                    className={`combat-log-toggle-btn ${showCombatLogs ? "active" : ""}`}
                                    onClick={() => setShowCombatLogs(prev => !prev)}
                                    title={showCombatLogs ? "Ocultar logs" : "Mostrar logs"}
                                    aria-label={showCombatLogs ? "Ocultar logs" : "Mostrar logs"}
                                >
                                    <ScrollText size={18} />
                                </button>
                                {showChallengePanel && (
                                    <div
                                        className={`combat-inline-challenge ${hasChallengeAspects || (userRole === "GM" && isChallengeAspectsOpen) ? "has-aspects" : ""}`}
                                        style={{
                                            '--challenge-color': challengeColors.primary,
                                            '--challenge-glow': challengeColors.glow
                                        } as any}
                                    >
                                        <div className="combat-inline-challenge-main">
                                            <div className="combat-inline-diff-box">
                                                <span className="combat-inline-diff-label">DIF</span>
                                                <input
                                                    type="text"
                                                    className="combat-inline-diff-input"
                                                    inputMode="numeric"
                                                    value={challengeDiffDraft}
                                                    onChange={(e) => {
                                                        const rawValue = e.target.value;
                                                        if (!/^-?\d*$/.test(rawValue)) return;
                                                        setChallengeDiffDraft(rawValue);
                                                        if (rawValue !== "" && rawValue !== "-" && userRole === "GM") {
                                                            handleChallengeUpdate({ difficulty: parseInt(rawValue, 10) });
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (challengeDiffDraft === "" || challengeDiffDraft === "-") {
                                                            setChallengeDiffDraft("0");
                                                            if (userRole === "GM") handleChallengeUpdate({ difficulty: 0 });
                                                        }
                                                    }}
                                                    readOnly={userRole !== "GM"}
                                                />
                                            </div>

                                            <input
                                                type="text"
                                                className="combat-inline-challenge-text"
                                                placeholder="Desafio..."
                                                value={state.challenge?.text || ""}
                                                onChange={(e) => userRole === "GM" && handleChallengeUpdate({ text: e.target.value })}
                                                readOnly={userRole !== "GM"}
                                            />

                                            {userRole === "GM" && (
                                                <button
                                                    type="button"
                                                    className="combat-inline-challenge-add"
                                                    onClick={() => setIsChallengeAspectsOpen(true)}
                                                    title="Adicionar aspectos"
                                                    aria-label="Adicionar aspectos"
                                                >
                                                    +
                                                </button>
                                            )}
                                        </div>

                                        {(hasChallengeAspects || (userRole === "GM" && isChallengeAspectsOpen)) && (
                                            <div className="combat-inline-aspects-grid">
                                                {[0, 1, 2].map(idx => {
                                                    const aspectValue = challengeAspects[idx] || "";
                                                    if (userRole !== "GM" && aspectValue.trim() === "") return null;

                                                    return (
                                                        <input
                                                            key={idx}
                                                            type="text"
                                                            className={`combat-inline-aspect-marker ${idx === 2 ? "center" : ""}`}
                                                            placeholder={`Aspecto ${idx + 1}`}
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
                                )}
                            </div>
                        )}

                        {showDiceRoller && showCombatLogs && (
                            <div className="combat-log-wrapper">
                                <CombatLog
                                    events={events}
                                    characters={state.characters}
                                    sessionNumber={state.sessionNumber}
                                    eventSessionMap={eventSessionMap}
                                    isRefreshing={isRefreshing}
                                    onRefresh={onRefresh}
                                    compact={true}
                                />
                            </div>
                        )}
                    </div>
                )}

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
                                    {isHeroDrawerOpen && (
                                        <button 
                                            className="combat-avatar-drawer-handle"
                                            onClick={() => setIsHeroDrawerOpen(false)}
                                            title="Recolher fichas"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                    )}
                                    <div className={`combat-avatar-rail hero-avatar-rail ${isHeroDrawerOpen ? "is-expanded" : "is-collapsed"}`}>
                                        {(() => {
                                            let heroStripRank = 0;
                                            return heroDrawerCards.map((char, index) => {
                                            if (!isHeroDrawerOpen) {
                                                return (
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
                                                );
                                            }

                                            const isPinnedCard = pinnedHeroCardIds.includes(char.id);
                                            const isExpandedCard = isPinnedCard || hoverHeroCardId === char.id;
                                            if (isExpandedCard) {
                                                return (
                                                    <div
                                                        key={`${char.id}-hero-open`}
                                                        className="combat-stack-slot"
                                                        onMouseEnter={() => setHoverHeroCardId(char.id)}
                                                        onMouseLeave={() => setHoverHeroCardId(prev => prev === char.id ? null : prev)}
                                                    >
                                                        <CombatCard
                                                            character={char}
                                                            sessionId={sessionId as string}
                                                            actorUserId={actorUserId}
                                                            isGM={userRole === "GM"}
                                                            onRemove={char.isNPC ? () => handleRemoveCharacter(char.id) : undefined}
                                                            isCurrentTurn={currentTurnActorId === char.id}
                                                            isLinkedCharacter={fixedCharacterId === char.id}
                                                            onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)}
                                                            onToggleExpanded={() => setPinnedHeroCardIds((prev) => (
                                                                prev.includes(char.id)
                                                                    ? prev.filter((id) => id !== char.id)
                                                                    : [...prev, char.id]
                                                            ))}
                                                            isPinned={isPinnedCard}
                                                            avatarSide="left"
                                                        />
                                                    </div>
                                                );
                                            }

                                            const stripWidthPercent = Math.max(16, 85 - (heroStripRank * 15));
                                            const stripRank = heroStripRank;
                                            heroStripRank += 1;

                                            return (
                                                <div
                                                    key={`${char.id}-hero-strip`}
                                                    className="combat-stack-slot"
                                                    onMouseEnter={() => setHoverHeroCardId(char.id)}
                                                    onMouseLeave={() => setHoverHeroCardId(prev => prev === char.id ? null : prev)}
                                                >
                                                    <CombatCard
                                                        character={char}
                                                        sessionId={sessionId as string}
                                                        actorUserId={actorUserId}
                                                        isGM={userRole === "GM"}
                                                        isCurrentTurn={currentTurnActorId === char.id}
                                                        isLinkedCharacter={fixedCharacterId === char.id}
                                                        displayMode="strip"
                                                        avatarSide="left"
                                                        stripRank={stripRank}
                                                        stripWidthPercent={stripWidthPercent}
                                                        onToggleExpanded={() => setPinnedHeroCardIds((prev) => (
                                                            prev.includes(char.id)
                                                                ? prev.filter((id) => id !== char.id)
                                                                : [...prev, char.id]
                                                        ))}
                                                    />
                                                </div>
                                            );
                                        });
                                        })()}
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

                    {/* Turn Timer Area foi movido para o TurnOrderTracker no page.tsx */}

                    {/* Combat Control Bar - Moved Here */}


                    {(!state.turnOrder || state.turnOrder.length === 0) ? null : (
                        <div className="combat-control-bar animate-reveal">
                            <div className="combat-actions" style={{ justifyContent: 'center', width: '100%' }}>
                                {userRole === "GM" ? (
                                    <div className="gm-turn-controls">
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
                                    <div className="player-turn-status" style={{ justifyContent: 'center' }}>
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
                                )}
                            </div>
                        </div>
                    )}


                {/* Coluna 3: Ameaças (Direita) */}
                {/* Coluna 3: Ameaças (Direita) OU Desafio */}
                </div>
                <div className="combat-threats-column combat-side-column">
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
                                        {isThreatDrawerOpen && (
                                            <button 
                                                className="combat-avatar-drawer-handle"
                                                onClick={() => setIsThreatDrawerOpen(false)}
                                                title="Recolher fichas"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        )}
                                        <div className={`combat-avatar-rail threat-avatar-rail ${isThreatDrawerOpen ? "is-expanded" : "is-collapsed"}`}>
                                            {(() => {
                                                let threatStripRank = 0;
                                                return threatDrawerCards.map((char, index) => {
                                                if (!isThreatDrawerOpen) {
                                                    return (
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
                                                    );
                                                }

                                                const isPinnedCard = pinnedThreatCardIds.includes(char.id);
                                                const isExpandedCard = isPinnedCard || hoverThreatCardId === char.id;
                                                if (isExpandedCard) {
                                                    return (
                                                        <div
                                                            key={`${char.id}-threat-open`}
                                                            className="combat-stack-slot"
                                                            onMouseEnter={() => setHoverThreatCardId(char.id)}
                                                            onMouseLeave={() => setHoverThreatCardId(prev => prev === char.id ? null : prev)}
                                                        >
                                                            <CombatCard
                                                                character={char}
                                                                sessionId={sessionId as string}
                                                                actorUserId={actorUserId}
                                                                isGM={userRole === "GM"}
                                                                onRemove={() => handleRemoveCharacter(char.id)}
                                                                isCurrentTurn={currentTurnActorId === char.id}
                                                                onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)}
                                                                onToggleExpanded={() => setPinnedThreatCardIds((prev) => (
                                                                    prev.includes(char.id)
                                                                        ? prev.filter((id) => id !== char.id)
                                                                        : [...prev, char.id]
                                                                ))}
                                                                isPinned={isPinnedCard}
                                                                avatarSide="right"
                                                            />
                                                        </div>
                                                    );
                                                }

                                                const stripWidthPercent = Math.max(16, 85 - (threatStripRank * 15));
                                                const stripRank = threatStripRank;
                                                threatStripRank += 1;

                                                return (
                                                    <div
                                                        key={`${char.id}-threat-strip`}
                                                        className="combat-stack-slot threat-strip-slot"
                                                        onMouseEnter={() => setHoverThreatCardId(char.id)}
                                                        onMouseLeave={() => setHoverThreatCardId(prev => prev === char.id ? null : prev)}
                                                    >
                                                        <CombatCard
                                                            character={char}
                                                            sessionId={sessionId as string}
                                                            actorUserId={actorUserId}
                                                            isGM={userRole === "GM"}
                                                            isCurrentTurn={currentTurnActorId === char.id}
                                                            displayMode="strip"
                                                            avatarSide="right"
                                                            stripRank={stripRank}
                                                            stripWidthPercent={stripWidthPercent}
                                                            onToggleExpanded={() => setPinnedThreatCardIds((prev) => (
                                                                prev.includes(char.id)
                                                                    ? prev.filter((id) => id !== char.id)
                                                                    : [...prev, char.id]
                                                            ))}
                                                        />
                                                    </div>
                                                );
                                                });
                                            })()}
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
