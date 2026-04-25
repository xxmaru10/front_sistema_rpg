"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Character, Aspect, ActionEvent } from "@/types/domain";
import { ChevronLeft, ChevronRight, ScrollText, UserPlus, Skull, Zap, ListOrdered, Dices } from "lucide-react";
import { TurnTimer } from "@/components/TurnTimer";
import { DiceRoller } from "@/components/DiceRoller";
import { CombatLog } from "@/components/CombatLog";
import { VampireCombatCard } from "./CombatCard";

// Alias to match CombatTab's internal usage pattern
const CombatCard = VampireCombatCard;

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
    onSummonAlly?: () => void;
    onSummonThreat?: () => void;
    onToggleChallenge?: () => void;
    onOpenTurnOrder?: () => void;
}

function CombatTabComponent({
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
    onRefresh,
    onSummonAlly,
    onSummonThreat,
    onToggleChallenge,
    onOpenTurnOrder,
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
                const linked = heroCombatants.find(c => c.id === fixedCharacterId);
                if (linked) return linked;
            }
            const owned = heroCombatants.find(c => (c.ownerUserId || "").trim().toLowerCase() === normalizedActorUserId);
            if (owned) return owned;
        }
        return heroCombatants[0];
    }, [heroCombatants, userRole, fixedCharacterId, normalizedActorUserId]);

    const threatPreview = useMemo(() => {
        if (threatCombatants.length === 0) return null;
        return threatCombatants[0];
    }, [threatCombatants]);

    const heroDrawerCards = isHeroDrawerOpen ? heroCombatants : heroPreview ? [heroPreview] : [];
    const threatDrawerCards = isThreatDrawerOpen ? threatCombatants : threatPreview ? [threatPreview] : [];
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

    useEffect(() => {
        if (heroCombatants.length === 0) setIsHeroDrawerOpen(false);
        setPinnedHeroCardIds((prev) => prev.filter((id) => heroCombatants.some((c) => c.id === id)));
        if (hoverHeroCardId && !heroCombatants.some(c => c.id === hoverHeroCardId)) setHoverHeroCardId(null);
    }, [heroCombatants, hoverHeroCardId]);

    useEffect(() => {
        if (threatCombatants.length === 0) setIsThreatDrawerOpen(false);
        setPinnedThreatCardIds((prev) => prev.filter((id) => threatCombatants.some((c) => c.id === id)));
        if (hoverThreatCardId && !threatCombatants.some(c => c.id === hoverThreatCardId)) setHoverThreatCardId(null);
    }, [threatCombatants, hoverThreatCardId]);

    useEffect(() => { if (!showDiceRoller) setShowCombatLogs(false); }, [showDiceRoller]);

    useEffect(() => {
        if (!showChallengePanel) { setIsChallengeAspectsOpen(false); return; }
        if (hasChallengeAspects) setIsChallengeAspectsOpen(true);
    }, [showChallengePanel, hasChallengeAspects]);

    useEffect(() => { setChallengeDiffDraft(String(state.challenge?.difficulty ?? 0)); }, [state.challenge?.difficulty]);

    useEffect(() => { if (!isHeroDrawerOpen) { setPinnedHeroCardIds([]); setHoverHeroCardId(null); } }, [isHeroDrawerOpen]);
    useEffect(() => { if (!isThreatDrawerOpen) { setPinnedThreatCardIds([]); setHoverThreatCardId(null); } }, [isThreatDrawerOpen]);

    useEffect(() => {
        if (!isHeroDrawerOpen) return;
        const first = heroDrawerCards[0];
        if (!first) return;
        setPinnedHeroCardIds((prev) => prev.includes(first.id) ? prev : [first.id, ...prev]);
    }, [isHeroDrawerOpen, heroDrawerCards]);

    useEffect(() => {
        if (!isThreatDrawerOpen) return;
        const first = threatDrawerCards[0];
        if (!first) return;
        setPinnedThreatCardIds((prev) => prev.includes(first.id) ? prev : [first.id, ...prev]);
    }, [isThreatDrawerOpen, threatDrawerCards]);

    return (
        <>
        {userRole === "GM" && typeof document !== "undefined" && createPortal(
            <div className="gm-sidebar-vertical">
                <button className="gm-sidebar-btn gm-sidebar-btn--ally" onClick={onSummonAlly} title="Convocar Aliado" aria-label="Convocar Aliado"><UserPlus size={18} /></button>
                <button className="gm-sidebar-btn gm-sidebar-btn--threat" onClick={onSummonThreat} title="Convocar Inimigo" aria-label="Convocar Inimigo"><Skull size={18} /></button>
                <div className="gm-sidebar-divider" />
                <button className={`gm-sidebar-btn${challengeMode ? " gm-sidebar-btn--active" : ""}`} onClick={onToggleChallenge} title={challengeMode ? "Desativar Modo Desafio" : "Ativar Modo Desafio"} aria-label="Modo Desafio"><Zap size={18} /></button>
                <button className="gm-sidebar-btn" onClick={onOpenTurnOrder} title="Ordem de Turno" aria-label="Ordem de Turno"><ListOrdered size={18} /></button>
                <div className="gm-sidebar-divider" />
                <button className={`gm-sidebar-btn${showDiceRoller ? " gm-sidebar-btn--active" : ""}`} onClick={() => setShowDiceRoller(!showDiceRoller)} title={showDiceRoller ? "Ocultar Dados" : "Mostrar Dados"} aria-label="Dados"><Dices size={18} /></button>
            </div>,
            document.body
        )}

        <div className="combat-display animate-reveal">
            <div className={`combat-arena-layout${hasExpandedHeroes ? " has-expanded-left" : ""}${hasExpandedThreats ? " has-expanded-right" : ""}${isHeroDrawerOpen ? " hero-drawer-open" : ""}${isThreatDrawerOpen ? " threat-drawer-open" : ""}`}>
                {showDiceRoller && (
                    <div className="combat-top-strip is-open">
                        <div className="combat-dice-integrated animate-reveal">
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
                                disabled={false}
                                controlsHidden={false}
                                soundSettings={state.soundSettings}
                                currentTurnActorId={currentTurnActorId}
                                isCombat={!challengeMode}
                            />
                            <button type="button" className={`combat-log-toggle-btn ${showCombatLogs ? "active" : ""}`} onClick={() => setShowCombatLogs(prev => !prev)} title={showCombatLogs ? "Ocultar logs" : "Mostrar logs"} aria-label={showCombatLogs ? "Ocultar logs" : "Mostrar logs"}><ScrollText size={18} /></button>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', borderLeft: '1px solid rgba(255,255,255,0.1)', marginLeft: '4px' }}>
                                <button onClick={() => setShowDiceRoller(false)} style={{ background: 'transparent', border: 'none', color: '#ff2b2b', padding: '0', cursor: 'pointer', fontSize: '1.28rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, width: '24px', height: '24px', borderRadius: 0 }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.18) rotate(90deg)'; e.currentTarget.style.color = '#ff0000'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1) rotate(0deg)'; e.currentTarget.style.color = '#ff2b2b'; }} title="Fechar">✕</button>
                            </div>
                            {showChallengePanel && (
                                <div className={`combat-inline-challenge ${hasChallengeAspects || (userRole === "GM" && isChallengeAspectsOpen) ? "has-aspects" : ""}`} style={{ '--challenge-color': challengeColors.primary, '--challenge-glow': challengeColors.glow } as any}>
                                    <div className="combat-inline-challenge-main">
                                        <div className="combat-inline-diff-box">
                                            <span className="combat-inline-diff-label">DIF</span>
                                            <input type="text" className="combat-inline-diff-input" inputMode="numeric" value={challengeDiffDraft} onChange={(e) => { const v = e.target.value; if (!/^-?\d*$/.test(v)) return; setChallengeDiffDraft(v); if (v !== "" && v !== "-" && userRole === "GM") handleChallengeUpdate({ difficulty: parseInt(v, 10) }); }} onBlur={() => { if (challengeDiffDraft === "" || challengeDiffDraft === "-") { setChallengeDiffDraft("0"); if (userRole === "GM") handleChallengeUpdate({ difficulty: 0 }); } }} readOnly={userRole !== "GM"} />
                                        </div>
                                        <input type="text" className="combat-inline-challenge-text" placeholder="Desafio..." value={state.challenge?.text || ""} onChange={(e) => userRole === "GM" && handleChallengeUpdate({ text: e.target.value })} readOnly={userRole !== "GM"} />
                                        {userRole === "GM" && <button type="button" className="combat-inline-challenge-add" onClick={() => setIsChallengeAspectsOpen(true)} title="Adicionar aspectos" aria-label="Adicionar aspectos">+</button>}
                                    </div>
                                    {(hasChallengeAspects || (userRole === "GM" && isChallengeAspectsOpen)) && (
                                        <div className="combat-inline-aspects-grid">
                                            {[0, 1, 2].map(idx => {
                                                const v = challengeAspects[idx] || "";
                                                if (userRole !== "GM" && v.trim() === "") return null;
                                                return <input key={idx} type="text" className={`combat-inline-aspect-marker ${idx === 2 ? "center" : ""}`} placeholder={`Aspecto ${idx + 1}`} value={v} onChange={(e) => { if (userRole !== "GM") return; const a = [...(state.challenge?.aspects || ["", "", ""])]; a[idx] = e.target.value; handleChallengeUpdate({ aspects: a }); }} readOnly={userRole !== "GM"} />;
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {showCombatLogs && (
                            <div className="combat-log-wrapper">
                                <CombatLog events={events} characters={state.characters} sessionNumber={state.sessionNumber} eventSessionMap={eventSessionMap} isRefreshing={isRefreshing} onRefresh={onRefresh} compact={true} userRole={userRole} rollVisibilityOverrides={state.rollVisibilityOverrides} sessionId={sessionId} actorUserId={actorUserId} />
                            </div>
                        )}
                    </div>
                )}

                {/* Hero column */}
                <div className="combat-party combat-side-column">
                    {heroCombatants.length === 0 ? (
                        <div className="empty-combat-text p-4 text-center border border-dashed border-[var(--accent-color)30] rounded opacity-50 text-xs">Nenhum aliado na sessão.</div>
                    ) : (
                        <div className="combat-side-lane hero-side-lane">
                            <div className={`combat-avatar-drawer side-left hero-drawer${isHeroDrawerOpen ? " is-open" : ""}`}>
                                <div className="combat-avatar-panel">
                                    {isHeroDrawerOpen && <button className="combat-avatar-drawer-handle" onClick={() => setIsHeroDrawerOpen(false)} title="Recolher fichas"><ChevronLeft size={16} /></button>}
                                    <div className={`combat-avatar-rail hero-avatar-rail ${isHeroDrawerOpen ? "is-expanded" : "is-collapsed"}`}>
                                        {(() => {
                                            let heroStripRank = 0;
                                            return heroDrawerCards.map((char) => {
                                                if (!isHeroDrawerOpen) {
                                                    return <CombatCard key={`${char.id}-hero-preview`} character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} isCurrentTurn={currentTurnActorId === char.id} isLinkedCharacter={fixedCharacterId === char.id} displayMode="compact" avatarSide="left" onToggleExpanded={() => setIsHeroDrawerOpen(true)} />;
                                                }
                                                const isPinnedCard = pinnedHeroCardIds.includes(char.id);
                                                const isExpandedCard = isPinnedCard || hoverHeroCardId === char.id;
                                                if (isExpandedCard) {
                                                    return (
                                                        <div key={`${char.id}-hero-open`} className="combat-stack-slot" onMouseEnter={() => setHoverHeroCardId(char.id)} onMouseLeave={() => setHoverHeroCardId(prev => prev === char.id ? null : prev)}>
                                                            <CombatCard character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} onRemove={char.isNPC ? () => handleRemoveCharacter(char.id) : undefined} isCurrentTurn={currentTurnActorId === char.id} isLinkedCharacter={fixedCharacterId === char.id} onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)} onToggleExpanded={() => setPinnedHeroCardIds((prev) => prev.includes(char.id) ? prev.filter((id) => id !== char.id) : [...prev, char.id])} isPinned={isPinnedCard} avatarSide="left" />
                                                        </div>
                                                    );
                                                }
                                                const sw = Math.max(16, 85 - (heroStripRank * 15));
                                                const sr = heroStripRank++;
                                                return (
                                                    <div key={`${char.id}-hero-strip`} className="combat-stack-slot" onMouseEnter={() => setHoverHeroCardId(char.id)} onMouseLeave={() => setHoverHeroCardId(prev => prev === char.id ? null : prev)}>
                                                        <CombatCard character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} isCurrentTurn={currentTurnActorId === char.id} isLinkedCharacter={fixedCharacterId === char.id} displayMode="strip" avatarSide="left" stripRank={sr} stripWidthPercent={sw} onToggleExpanded={() => setPinnedHeroCardIds((prev) => prev.includes(char.id) ? prev.filter((id) => id !== char.id) : [...prev, char.id])} />
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

                {/* Center */}
                <div className={`combat-center ${(userRole !== "GM" && !isCurrentPlayerActive && !challengeMode) ? 'controls-locked' : ''}`}>
                    <div className="scene-aspects-strip">
                        {aspectList.filter(a => a.scope === "SCENE").map(a => (
                            <div key={a.id} className="scene-aspect-token tarot-style">
                                <div className="aspect-token-name">{a.name.toUpperCase()}</div>
                                <div className="aspect-token-invokes">{a.freeInvokes}</div>
                            </div>
                        ))}
                    </div>
                    {(!state.turnOrder || state.turnOrder.length === 0) ? null : userRole === "PLAYER" ? (
                        <div className="combat-control-bar animate-reveal">
                            <div className="combat-actions" style={{ justifyContent: 'center', width: '100%' }}>
                                <div className="player-turn-status" style={{ justifyContent: 'center' }} />
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Threat column */}
                <div className="combat-threats-column combat-side-column">
                    <div className="combat-threats">
                        <div className="combat-side-lane threat-side-lane">
                            {threatCombatants.length === 0 && threatHazards.length === 0 ? (
                                <div className="empty-combat-text p-4 text-center border border-dashed border-[rgba(255,68,68,0.35)] rounded opacity-50 text-xs">Nenhuma ameaça na arena.</div>
                            ) : null}
                            {threatHazards.length > 0 && (
                                <div className="combat-expanded-stack combat-hazard-stack combat-cards-stack scrollbar-arcane">
                                    {threatHazards.map(char => <CombatCard key={char.id} character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} onRemove={() => handleRemoveCharacter(char.id)} isCurrentTurn={currentTurnActorId === char.id} onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)} />)}
                                </div>
                            )}
                            {threatCombatants.length > 0 && (
                                <div className={`combat-avatar-drawer side-right threat-drawer${isThreatDrawerOpen ? " is-open" : ""}`}>
                                    <div className="combat-avatar-panel">
                                        {isThreatDrawerOpen && <button className="combat-avatar-drawer-handle" onClick={() => setIsThreatDrawerOpen(false)} title="Recolher fichas"><ChevronRight size={16} /></button>}
                                        <div className={`combat-avatar-rail threat-avatar-rail ${isThreatDrawerOpen ? "is-expanded" : "is-collapsed"}`}>
                                            {(() => {
                                                let threatStripRank = 0;
                                                return threatDrawerCards.map((char) => {
                                                    if (!isThreatDrawerOpen) {
                                                        return <CombatCard key={`${char.id}-threat-preview`} character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} isCurrentTurn={currentTurnActorId === char.id} displayMode="compact" avatarSide="right" onToggleExpanded={() => setIsThreatDrawerOpen(true)} />;
                                                    }
                                                    const isPinnedCard = pinnedThreatCardIds.includes(char.id);
                                                    const isExpandedCard = isPinnedCard || hoverThreatCardId === char.id;
                                                    if (isExpandedCard) {
                                                        return (
                                                            <div key={`${char.id}-threat-open`} className="combat-stack-slot" onMouseEnter={() => setHoverThreatCardId(char.id)} onMouseLeave={() => setHoverThreatCardId(prev => prev === char.id ? null : prev)}>
                                                                <CombatCard character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} onRemove={() => handleRemoveCharacter(char.id)} isCurrentTurn={currentTurnActorId === char.id} onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)} onToggleExpanded={() => setPinnedThreatCardIds((prev) => prev.includes(char.id) ? prev.filter((id) => id !== char.id) : [...prev, char.id])} isPinned={isPinnedCard} avatarSide="right" />
                                                            </div>
                                                        );
                                                    }
                                                    const sw = Math.max(16, 85 - (threatStripRank * 15));
                                                    const sr = threatStripRank++;
                                                    return (
                                                        <div key={`${char.id}-threat-strip`} className="combat-stack-slot threat-strip-slot" onMouseEnter={() => setHoverThreatCardId(char.id)} onMouseLeave={() => setHoverThreatCardId(prev => prev === char.id ? null : prev)}>
                                                            <CombatCard character={char} sessionId={sessionId as string} actorUserId={actorUserId} isGM={userRole === "GM"} isCurrentTurn={currentTurnActorId === char.id} displayMode="strip" avatarSide="right" stripRank={sr} stripWidthPercent={sw} onToggleExpanded={() => setPinnedThreatCardIds((prev) => prev.includes(char.id) ? prev.filter((id) => id !== char.id) : [...prev, char.id])} />
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
        </>
    );
}

export const CombatTab = memo(CombatTabComponent);
CombatTab.displayName = "VampireCombatTab";
