/**
 * @file: src/app/session/[id]/page.tsx
 * @summary: Main entry point for the session page. Orchestrates the RPG session UI,
 * including combat, bestiary, logs, and game state management.
 */
"use client";

import "./session.css";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { battlemapToolStore } from "@/lib/battlemapToolStore";
import { globalEventStore } from "@/lib/eventStore";
import { floatingNotesStore } from "@/lib/floatingNotesStore";
import { computeState } from "@/lib/projections";
import { Users, ScrollText, Swords, History, PawPrint, Settings, Monitor, Tv, RefreshCw, Eye, VenetianMask } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { CharacterCreator } from "@/components/CharacterCreator";
import { AspectManager } from "@/components/AspectManager";
import { SessionHeader } from "@/components/SessionHeader";
import { SummonModal } from "@/components/SummonModal";
import { TurnOrderModal } from "@/components/TurnOrderModal";
import { TurnOrderTracker } from "@/components/TurnOrderTracker";
import { SessionNotes } from "@/features/session-notes/SessionNotes";
import { VIControlPanel } from "@/components/VIControlPanel";
import { MentionNavigationRequest } from "@/lib/mentionNavigation";
import { v4 as uuidv4 } from "uuid";
import { isCharacterEliminated } from "@/lib/gameLogic";
import { ConsequenceModal } from "@/components/ConsequenceModal";
import { DamageResolutionModal } from "@/components/DamageResolutionModal";
import { AtmosphericEffects } from "@/components/AtmosphericEffects";
import { getThemePreset, generateThemeCSS } from "@/lib/themePresets";
import { Battlemap } from "@/components/Battlemap";
import { LogTab } from "@/components/session/LogTab";
import { BestiaryTab } from "@/components/session/BestiaryTab";
import { CharactersTab } from "@/components/session/CharactersTab";
import { CombatTab } from "@/components/session/CombatTab";
import { useSessionEvents } from "./hooks/useSessionEvents";
import { useVictoryDefeat } from "./hooks/useVictoryDefeat";
import { useCombatAutomation } from "./hooks/useCombatAutomation";
import { useSessionActions } from "./hooks/useSessionActions";
import { useSessionUIState } from "./hooks/useSessionUIState";
import { useSessionDerivations } from "./hooks/useSessionDerivations";
import { useSessionScreenControl } from "./hooks/useSessionScreenControl";
import { diceSimulationStore } from "@/lib/diceSimulationStore";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

const FateDice3D = dynamic(() => import("@/components/FateDice3D"), { ssr: false });

export default function SessionPage() {
    const { id: sessionId } = useParams();

    const searchParams = useSearchParams();
    const actorUserId = searchParams.get("u") || "Visitante";
    const userRole = (searchParams.get("r") as "GM" | "PLAYER") || "PLAYER";
    const fixedCharacterId = searchParams.get("c") || undefined;

    // ─── UI STATE ─────────────────────────────────────────────────────────────
    const {
        challengeMode, setChallengeMode,
        activeTab, setActiveTab,
        showCreator, setShowCreator,
        showSummonModal, setShowSummonModal,
        summonMode, setSummonMode,
        creatorSource, setCreatorSource,
        showAspectManager, setShowAspectManager,
        logFilter, setLogFilter,
        logSessionFilter, setLogSessionFilter,
        combatActivePcId, setCombatActivePcId,
        combatActiveNpcId, setCombatActiveNpcId,
        combatLastSelectedId, setCombatLastSelectedId,
        viewingBestiaryCharId, setViewingBestiaryCharId,
        bestiarySearch, setBestiarySearch,
        bestiarySessionOnly, setBestiarySessionOnly,
        showTurnOrderModal, setShowTurnOrderModal,
        videoStream, setVideoStream,
        spectatorMode, setSpectatorMode,
        showDiceRoller, setShowDiceRoller,
        transmissionVolume, setTransmissionVolume,
    } = useSessionUIState();

    const [diceVisible, setDiceVisible] = useState(false);
    const [diceParams, setDiceParams] = useState(diceSimulationStore.getParams());
    const [pendingMentionNavigation, setPendingMentionNavigation] = useState<MentionNavigationRequest | null>(null);
    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const [isMobileNav, setIsMobileNav] = useState(false);
    const [suppressHoverOpen, setSuppressHoverOpen] = useState(false);
    const [isNavPortalReady, setIsNavPortalReady] = useState(false);

    const handleMentionNavigate = (request: MentionNavigationRequest) => {
        setPendingMentionNavigation(request);
        setViewingBestiaryCharId(null);
        setActiveTab("notes");
    };

    useEffect(() => {
        const unsub = diceSimulationStore.subscribe(() => {
            setDiceVisible(diceSimulationStore.getIsVisible());
            setDiceParams(diceSimulationStore.getParams());
        });
        return () => { unsub(); };
    }, []);

    useEffect(() => {
        // Story 45: reset do toggle de rolagem oculta ao trocar de sessão.
        diceSimulationStore.setHiddenForPlayers(false);
    }, [sessionId]);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 768px)");
        const syncMedia = () => setIsMobileNav(media.matches);
        syncMedia();
        media.addEventListener("change", syncMedia);
        return () => media.removeEventListener("change", syncMedia);
    }, []);

    useEffect(() => {
        setIsNavPortalReady(true);
    }, []);

    useEffect(() => {
        if (isMobileNav) setIsNavExpanded(false);
    }, [activeTab, isMobileNav]);

    const [isTheaterMode, setIsTheaterMode] = useState(battlemapToolStore.isTheaterMode);

    const closeNavDrawer = () => {
        setIsNavExpanded(false);
        setSuppressHoverOpen(true);
    };

    const openNavOnHover = () => {
        if (!isMobileNav && !suppressHoverOpen) {
            setIsNavExpanded(true);
        }
    };

    const handleNavMouseLeave = () => {
        if (!isMobileNav) {
            setIsNavExpanded(false);
        }
        setSuppressHoverOpen(false);
    };

    const toggleNavHandle = () => {
        setIsNavExpanded(prev => !prev);
        setSuppressHoverOpen(false);
    };

    const switchTabFromNav = (tab: "characters" | "combat" | "notes" | "bestiary" | "log" | "vi") => {
        if (tab === "characters" || tab === "combat" || tab === "bestiary" || tab === "log") {
            setViewingBestiaryCharId(null);
        }
        setActiveTab(tab);
        setIsNavExpanded(false);
    };

    useEffect(() => {
        const unsub = battlemapToolStore.subscribe(() => {
            setIsTheaterMode(battlemapToolStore.isTheaterMode);
        });
        return unsub;
    }, []);

    // ─── EVENTS ───────────────────────────────────────────────────────────────

    const { events, isLoading, isRefreshing, globalBestiaryChars, setGlobalBestiaryChars, connectionStatus, failedEventIds, refresh } =
        useSessionEvents(sessionId as string, actorUserId);

    // ─── EARLY PROJECTION (feeds useVictoryDefeat before full derivations) ────
    // Keeps the event-sourcing contract intact: state is always projected from sorted events.

    const _earlyState = useMemo(() => {
        const sorted = [...events].sort((a, b) => {
            const seqA = a.seq || 0;
            const seqB = b.seq || 0;
            if (seqA !== 0 && seqB !== 0 && seqA !== seqB) return seqA - seqB;
            if (seqA === 0 && seqB !== 0) return 1;
            if (seqA !== 0 && seqB === 0) return -1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        const snapshot = globalEventStore.getSnapshotState();
        const snapshotUpToSeq = globalEventStore.getSnapshotUpToSeq();
        const projectionEvents =
            snapshot && snapshotUpToSeq >= 0
                ? sorted.filter((event) => (event.seq || 0) === 0 || (event.seq || 0) > snapshotUpToSeq)
                : sorted;

        return computeState(projectionEvents, snapshot ?? undefined);
    }, [events]);

    const _activePlayers = useMemo(() =>
        Object.values(_earlyState.characters).filter((c: any) => !c.isNPC),
        [_earlyState.characters]
    );

    const _allPlayersEliminated = useMemo(() => {
        if (_activePlayers.length === 0) return false;
        return _activePlayers.every(c => isCharacterEliminated(c));
    }, [_activePlayers]);

    const _activeEnemyCount = useMemo(() =>
        Object.values(_earlyState.characters).filter((c: any) =>
            c.isNPC && c.arenaSide !== "HERO" && c.activeInArena && !isCharacterEliminated(c)
        ).length,
        [_earlyState.characters]
    );

    // ─── VICTORY / DEFEAT ─────────────────────────────────────────────────────

    const {
        showVictory, showDefeat, showCombat,
        deathFocusCharId,
        lastToggleTimeRef, combatStartTimeRef,
    } = useVictoryDefeat({
        sessionId: sessionId as string,
        actorUserId, userRole,
        state: _earlyState,
        challengeMode, setChallengeMode,
        activePlayers: _activePlayers,
        allPlayersEliminated: _allPlayersEliminated,
        activeEnemyCount: _activeEnemyCount,
    });

    // currentTurnActorId: derived from projected state, needed by derivations + automation
    const currentTurnActorId = useMemo(() => {
        if (!_earlyState.turnOrder || _earlyState.turnOrder.length === 0) return null;
        if (_earlyState.isReaction && _earlyState.targetId) return _earlyState.targetId;
        const index = _earlyState.currentTurnIndex || 0;
        return _earlyState.turnOrder[index < _earlyState.turnOrder.length ? index : 0];
    }, [_earlyState.turnOrder, _earlyState.currentTurnIndex, _earlyState.isReaction, _earlyState.targetId]);

    // ─── FULL DERIVATIONS ─────────────────────────────────────────────────────

    const {
        state,
        characterList,
        displayedCharacters,
        bestiaryList,
        findBestiaryChar,
        aspectList,
        mentionEntities,
        activePlayers,
        allPlayersEliminated,
        activeEnemyCount,
        isCurrentPlayerActive,
        combatantList,
        turnOrderCharacters,
        lastReactionAttack,
        filteredEvents,
        eventSessionMap,
        logSessionNumbers,
        lastActionTimestamp,
        headerImageUrl,
        summonableCharacters,
    } = useSessionDerivations({
        events,
        globalBestiaryChars,
        actorUserId,
        fixedCharacterId,
        userRole,
        activeTab,
        logFilter,
        summonMode,
        challengeMode,
        currentTurnActorId,
        deathFocusCharId,
        combatStartTimeRef,
    });

    useEffect(() => {
        if (userRole === "PLAYER" && isCurrentPlayerActive && !showDiceRoller) {
            setShowDiceRoller(true);
        }
    }, [isCurrentPlayerActive, userRole, showDiceRoller, setShowDiceRoller]);

    // ─── SCREEN SHARE / AUDIO LIFECYCLE ──────────────────────────────────────
    // Must come before useSessionActions so screenShareManagerRef is available.

    const { screenVideoRef, screenShareManagerRef, videoNoSignal } = useSessionScreenControl({
        sessionId: sessionId as string,
        actorUserId,
        videoStream,
        setVideoStream,
        spectatorMode,
        setSpectatorMode,
        activeTab,
        transmissionVolume,
        setTransmissionVolume,
    });

    // ─── COMBAT AUTOMATION ────────────────────────────────────────────────────

    const {
        activeConsequence,
        pendingDamage, handleDamageConfirm, handleDamageAutoCalculate, handleDamageSkip,
        handleNextTurn, handlePreviousTurn, handleTogglePause,
        handleForcePass, handleConsequenceSave, handleConsequenceCancel,
    } = useCombatAutomation({
        sessionId: sessionId as string,
        actorUserId, userRole, state, currentTurnActorId,
        isCurrentPlayerActive, challengeMode,
        events,
        isSessionEventsLoading: isLoading,
    });

    // ─── SESSION ACTIONS ──────────────────────────────────────────────────────

    const {
        handleChallengeUpdate, handleHeaderUpdate,
        handleAtmosphericEffectChange, handleSummon, handleRemoveCharacter,
        handleStartScreenShare, handleStopScreenShare,
    } = useSessionActions({
        sessionId: sessionId as string,
        actorUserId, userRole, state, activeTab, summonMode,
        characterList, setChallengeMode, setShowSummonModal,
        setSpectatorMode, screenShareManagerRef,
    });

    // ─── SHARED GM CALLBACKS ──────────────────────────────────────────────────
    const handleToggleChallengeMode = () => {
        const newState = !challengeMode;
        lastToggleTimeRef.current = Date.now();
        if (!newState) {
            combatStartTimeRef.current = Date.now();
        } else {
            combatStartTimeRef.current = null;
        }
        handleChallengeUpdate({ isActive: newState });
        if (!newState && userRole === "GM") {
            if (!state.turnOrder || state.turnOrder.length === 0) {
                const players = characterList.filter(c => !c.isNPC);
                if (players.length > 0) {
                    globalEventStore.append({
                        id: uuidv4(), sessionId: sessionId as string, seq: 0,
                        type: "TURN_ORDER_UPDATED", actorUserId,
                        createdAt: new Date().toISOString(), visibility: "PUBLIC",
                        payload: { characterIds: players.map(p => p.id) }
                    } as any);
                }
            }
            setShowTurnOrderModal(true);
            setTimeout(() => {
                globalEventStore.append({
                    id: uuidv4(), sessionId: sessionId as string, seq: 0,
                    type: "TURN_STEPPED", actorUserId,
                    createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: { index: 0 }
                } as any);
            }, 500);
        }
    };

    useEffect(() => {
        if (!state.battlemap?.isActive && isTheaterMode) {
            battlemapToolStore.setTheaterMode(false);
        }
    }, [state.battlemap?.isActive, isTheaterMode]);

    // ─── REMAINING EFFECTS ────────────────────────────────────────────────────


    // Controla o background do body no modo combate com header image.
    // Substitui o <style jsx global> que era re-injetado a cada render (causa do flash).
    useEffect(() => {
        const showBg = activeTab === "combat"
            && !!headerImageUrl
            && !deathFocusCharId
            && !videoStream
            && !state.battlemap?.isActive;

        if (showBg) {
            document.body.style.backgroundImage =
                `radial-gradient(circle, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.85) 100%), url(${headerImageUrl})`;
            document.body.style.backgroundSize = "cover";
            document.body.style.backgroundPosition = "center";
            document.body.style.backgroundAttachment = "fixed";
            document.body.style.backgroundRepeat = "no-repeat";
        } else {
            document.body.style.backgroundImage = "";
            document.body.style.backgroundSize = "";
            document.body.style.backgroundPosition = "";
            document.body.style.backgroundAttachment = "";
            document.body.style.backgroundRepeat = "";
        }
    }, [activeTab, headerImageUrl, deathFocusCharId, videoStream, state.battlemap?.isActive]);

    // ─── Gerencia Google Fonts + theme-preset-css via efeito ───────────────────
    // Antes era um IIFE no JSX: executava a cada render → re-fazia download do .woff2
    // Agora só executa quando state.themePreset muda de fato.
    useEffect(() => {
        const activeTheme = getThemePreset(state.themePreset);

        // Atualiza o <link> do Google Fonts somente se a URL mudou
        let linkEl = document.getElementById("theme-google-fonts") as HTMLLinkElement | null;
        if (!linkEl) {
            linkEl = document.createElement("link");
            linkEl.id = "theme-google-fonts";
            linkEl.rel = "stylesheet";
            document.head.appendChild(linkEl);
        }
        if (linkEl.href !== activeTheme.googleFontsUrl) {
            linkEl.href = activeTheme.googleFontsUrl;
        }

        // Atualiza o <style> do tema somente se o CSS mudou
        let styleEl = document.getElementById("theme-preset-css") as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "theme-preset-css";
            document.head.appendChild(styleEl);
        }
        const newCSS = generateThemeCSS(activeTheme);
        if (styleEl.textContent !== newCSS) {
            styleEl.textContent = newCSS;
        }
    }, [state.themePreset]);

    // ─── Gerencia o override de cor personalizada via efeito ───────────────────
    // Antes era um IIFE no JSX com dangerouslySetInnerHTML: re-montava a cada render
    // Agora só executa quando state.themeColor muda.
    useEffect(() => {
        const hex = state.themeColor;
        let styleEl = document.getElementById("theme-custom-color-override") as HTMLStyleElement | null;

        if (!hex) {
            if (styleEl) styleEl.remove();
            return;
        }

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return;

        const r = parseInt(result[1], 16);
        const g = parseInt(result[2], 16);
        const b = parseInt(result[3], 16);

        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "theme-custom-color-override";
            document.head.appendChild(styleEl);
        }

        const newCSS = `
            :root {
                --accent-color: ${hex};
                --accent-rgb: ${r}, ${g}, ${b};
                --accent-glow: ${hex}4D;
                --border-color: rgba(${r}, ${g}, ${b}, 0.2);
                --ornament-glow: 0 0 15px rgba(${r}, ${g}, ${b}, 0.15);
                --theme-modal-border: ${hex};
                --theme-scrollbar-thumb: rgba(${r}, ${g}, ${b}, 0.2);
                --theme-header-shadow: 0 0 30px rgba(${r}, ${g}, ${b}, 0.25);
                --theme-input-bg: rgba(${r}, ${g}, ${b}, 0.03);
                --gold-gradient: linear-gradient(135deg, ${hex} 0%, rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 1) 50%, ${hex} 100%);
            }
        `;
        if (styleEl.textContent !== newCSS) {
            styleEl.textContent = newCSS;
        }
    }, [state.themeColor]);

    // Initial active chars for combat duel selection
    useEffect(() => {
        if (!combatActivePcId && !combatActiveNpcId) {
            const firstPc = characterList.find(c => !c.isNPC);
            const firstNpc = characterList.find(c => c.isNPC);
            if (firstPc) {
                setCombatActivePcId(firstPc.id);
                if (!combatLastSelectedId) setCombatLastSelectedId(firstPc.id);
            }
            if (firstNpc) setCombatActiveNpcId(firstNpc.id);
        }
    }, [characterList, combatActivePcId, combatActiveNpcId, combatLastSelectedId]);

    // Auto-sync droplist to whoever is active in turn
    useEffect(() => {
        if (currentTurnActorId) {
            const char = characterList.find(c => c.id === currentTurnActorId);
            if (char) {
                if (char.isNPC) {
                    setCombatActiveNpcId(char.id);
                } else {
                    setCombatActivePcId(char.id);
                }
                setCombatLastSelectedId(char.id);
            }
        }
    }, [currentTurnActorId, characterList]);

    // ─── LOADING SCREEN ───────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div style={{
                position: "fixed", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "20px",
                background: "var(--bg-primary, #0a0a0a)", zIndex: 9999,
            }}>
                <svg width="48" height="48" viewBox="0 0 48 48"
                    style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="24" cy="24" r="20" fill="none"
                        stroke="var(--accent, #C9A84C)" strokeWidth="4"
                        strokeLinecap="round" strokeDasharray="90 30" />
                </svg>
                <span style={{
                    color: "var(--text-secondary, #aaa)", fontSize: "14px",
                    letterSpacing: "0.08em", fontFamily: "inherit",
                }}>
                    Carregando dados...
                </span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────

    const tacticalNav = (
        <nav
            className={`tactical-nav${isNavExpanded ? " is-expanded" : ""}`}
            onMouseEnter={openNavOnHover}
            onMouseLeave={handleNavMouseLeave}
        >
            <button
                type="button"
                className={`nav-d20-handle${isNavExpanded ? " is-hidden" : ""}`}
                onClick={toggleNavHandle}
                aria-label={isNavExpanded ? "Fechar menu lateral" : "Abrir menu lateral"}
                title={isNavExpanded ? "Fechar menu lateral" : "Abrir menu lateral"}
            >
                <span className="d20-glyph" aria-hidden="true">
                </span>
            </button>

            <div className={`nav-expanded-shell${isNavExpanded ? " is-open" : ""}`}>
                <button
                    type="button"
                    className="nav-close-cap nav-close-cap-top"
                    onClick={closeNavDrawer}
                    aria-label="Fechar menu lateral pelo topo"
                    title="Fechar menu lateral"
                >
                    <span className="nav-close-die" aria-hidden="true">
                        <span className="nav-close-value">20</span>
                    </span>
                </button>

                <div className="nav-options-stack">
                    <button
                        className={`nav-artifact ${activeTab === "characters" ? "active" : ""}`}
                        onClick={() => switchTabFromNav("characters")}
                        data-tooltip="PERSONAGEM"
                        title="PERSONAGEM"
                        aria-label="Abrir Personagem"
                    >
                        <div className="nav-icon"><Users size={20} /></div>
                        <div className="nav-label">PERSONAGEM</div>
                    </button>
                    <button
                        className={`nav-artifact ${activeTab === "combat" ? "active" : ""}`}
                        onClick={() => switchTabFromNav("combat")}
                        data-tooltip="ARENA"
                        title="ARENA"
                        aria-label="Abrir Arena"
                    >
                        <div className="nav-icon"><Swords size={20} /></div>
                        <div className="nav-label">ARENA</div>
                    </button>
                    {userRole === "GM" ? (
                        <>
                            <button
                                className={`nav-artifact ${activeTab === "notes" ? "active" : ""}`}
                                onClick={() => switchTabFromNav("notes")}
                                data-tooltip="NOTAS"
                                title="NOTAS"
                                aria-label="Abrir Notas"
                            >
                                <div className="nav-icon"><ScrollText size={20} /></div>
                                <div className="nav-label">NOTAS</div>
                            </button>
                            <button
                                className={`nav-artifact ${activeTab === "bestiary" ? "active" : ""}`}
                                onClick={() => switchTabFromNav("bestiary")}
                                data-tooltip="BESTIARIO"
                                title="BESTIARIO"
                                aria-label="Abrir Bestiario"
                            >
                                <div className="nav-icon"><PawPrint size={20} /></div>
                                <div className="nav-label">BESTIARIO</div>
                            </button>
                            <button
                                className={`nav-artifact ${activeTab === "log" ? "active" : ""}`}
                                onClick={() => switchTabFromNav("log")}
                                data-tooltip="LOGS"
                                title="LOGS"
                                aria-label="Abrir Logs"
                            >
                                <div className="nav-icon"><History size={20} /></div>
                                <div className="nav-label">LOGS</div>
                            </button>
                            <button
                                className={`nav-artifact ${activeTab === "vi" ? "active" : ""}`}
                                onClick={() => switchTabFromNav("vi")}
                                data-tooltip="CONFIGURACOES"
                                title="CONFIGURACOES"
                                aria-label="Abrir Configuracoes"
                            >
                                <div className="nav-icon"><Settings size={20} /></div>
                                <div className="nav-label">CONFIGURACOES</div>
                            </button>
                        </>
                    ) : (
                        <button
                            className={`nav-artifact ${activeTab === "notes" ? "active" : ""}`}
                            onClick={() => switchTabFromNav("notes")}
                            data-tooltip="NOTAS"
                            title="NOTAS"
                            aria-label="Abrir Notas"
                        >
                            <div className="nav-icon"><ScrollText size={20} /></div>
                            <div className="nav-label">NOTAS</div>
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    className="nav-close-cap nav-close-cap-bottom"
                    onClick={closeNavDrawer}
                    aria-label="Fechar menu lateral pela base"
                    title="Fechar menu lateral"
                >
                    <span className="nav-close-die" aria-hidden="true">
                        <span className="nav-close-value">1</span>
                    </span>
                </button>
            </div>
        </nav>
    );

    return (
        <div className={`session-view-wrapper${spectatorMode && videoStream ? " spectator-mode-active" : ""}`}>
            {isNavPortalReady ? createPortal(tacticalNav, document.body) : null}
            {/* Screen share video — mantido montado enquanto stream ativa; oculto via CSS
                em outras abas para preservar o MediaStream sem re-handshake ao voltar. */}
            {videoStream && (
                <video
                    autoPlay playsInline muted
                    className="screenshare-video"
                    ref={(el) => {
                        screenVideoRef.current = el;
                        if (el && videoStream && el.srcObject !== videoStream) {
                            el.srcObject = videoStream;
                            // play() é gerenciado exclusivamente pelo hook (com muted fallback)
                        }
                    }}
                    style={{
                        top: spectatorMode ? 0 : "70px",
                        height: spectatorMode ? "100vh" : "calc(100vh - 70px)",
                        zIndex: spectatorMode ? 1 : 0,
                        background: spectatorMode ? "#000" : "transparent",
                        display: activeTab === "combat" ? undefined : "none",
                    }}
                />
            )}

            {/* Badge "Sem sinal" — exibido quando stream está ativa mas vídeo não avança. */}
            {videoStream && activeTab === "combat" && videoNoSignal && (
                <div className="screenshare-nosignal">
                    <span className="screenshare-nosignal-icon">📡</span>
                    <span>Sem sinal — tente reconectar no botão <RefreshCw size={12} style={{ verticalAlign: "middle" }} /> no topo.</span>
                </div>
            )}

            {/* Spectator mode toggle button */}
            {videoStream && (
                <button
                    onClick={() => setSpectatorMode(prev => !prev)}
                    title={spectatorMode ? "Sair do Modo Espectador" : "Modo Espectador"}
                    style={{
                        position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
                        width: "52px", height: "52px", borderRadius: "50%",
                        border: spectatorMode ? "2px solid rgba(100, 220, 120, 0.8)" : "2px solid rgba(200, 160, 89, 0.6)",
                        background: spectatorMode ? "rgba(20, 80, 30, 0.85)" : "rgba(10, 10, 10, 0.75)",
                        color: spectatorMode ? "#6edc80" : "#C5A059",
                        backdropFilter: "blur(8px)", cursor: "pointer",
                        display: activeTab === "combat" ? "flex" : "none",
                        alignItems: "center", justifyContent: "center",
                        fontSize: "22px",
                        boxShadow: spectatorMode
                            ? "0 0 20px rgba(100, 220, 120, 0.4), 0 4px 16px rgba(0,0,0,0.5)"
                            : "0 0 16px rgba(197, 160, 89, 0.25), 0 4px 12px rgba(0,0,0,0.4)",
                        transition: "all 0.3s ease", outline: "none"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                    {spectatorMode ? <Eye size={24} /> : <VenetianMask size={24} />}
                </button>
            )}



            {activeTab === "combat" && (
                <AtmosphericEffects type={state.atmosphericEffect || "none"} />
            )}

            <SummonModal
                isOpen={showSummonModal}
                onClose={() => setShowSummonModal(false)}
                onSummon={handleSummon}
                availableCharacters={summonableCharacters}
                title={summonMode === "HERO" ? "CONVOCAR ALIADO" : "CONVOCAR INIMIGO"}
            />

            <TurnOrderModal
                isOpen={showTurnOrderModal}
                onClose={() => setShowTurnOrderModal(false)}
                characters={characterList.filter(c => !c.isNPC || c.activeInArena === true)}
                sessionId={sessionId as string}
                actorUserId={actorUserId}
                initialOrder={state.turnOrder}
            />

            <SessionHeader
                title={state.name || `Sessão: ${state.sessionNumber}`}
                imageUrl={headerImageUrl}
                onUpdate={handleHeaderUpdate}
                isGM={userRole === "GM"}
                tabName={
                    activeTab === "characters" ? "PERSONAGEM" :
                    activeTab === "combat" ? "ARENA" :
                    activeTab === "log" ? "LOGS" :
                    activeTab === "notes" ? "NOTAS" :
                    activeTab === "vi" ? "VI" : "BESTIÁRIO"
                }
                onSummonAlly={() => { setSummonMode("HERO"); setShowSummonModal(true); }}
                onSummonThreat={() => { setSummonMode("THREAT"); setShowSummonModal(true); }}
                onToggleChallenge={handleToggleChallengeMode}
                onOpenTurnOrder={() => setShowTurnOrderModal(true)}
                challengeActive={challengeMode}
                inCombat={!challengeMode}
                soundSettings={state.soundSettings}
                onAtmosphericEffectChange={handleAtmosphericEffectChange}
                currentAtmosphericEffect={state.atmosphericEffect || "none"}
                videoStream={videoStream}
                onStartScreenShare={handleStartScreenShare}
                onStopScreenShare={handleStopScreenShare}
                connectionStatus={connectionStatus}
                showDiceRoller={showDiceRoller}
                onToggleDiceRoller={() => setShowDiceRoller(!showDiceRoller)}
            >
                {activeTab === "combat" && !challengeMode && (
                    <TurnOrderTracker
                        characters={turnOrderCharacters}
                        currentTurnIndex={state.currentTurnIndex || 0}
                        activeCharacterId={currentTurnActorId}
                        targetId={state.targetId}
                        soundSettings={state.soundSettings}
                        lastTurnChangeTimestamp={state.lastTurnChangeTimestamp}
                        userRole={userRole}
                        currentRound={state.currentRound || 1}
                        handleNextTurn={() => handleNextTurn(false)}
                        handlePreviousTurn={handlePreviousTurn}
                        handleForcePass={handleForcePass}
                        handleTogglePause={handleTogglePause}
                        isReaction={state.isReaction || false}
                        timerPaused={state.timerPaused || false}
                        timerPausedAt={state.timerPausedAt || null}
                        isCurrentPlayerActive={isCurrentPlayerActive || false}
                        actorUserId={actorUserId}
                        sessionId={sessionId as string}
                        handleNextRound={() => handleNextTurn(true)}
                        handleEndCombat={() => {
                            if (confirm("Encerrar combate?")) {
                                globalEventStore.append({
                                    id: uuidv4(),
                                    sessionId: sessionId as string,
                                    seq: 0,
                                    type: "TURN_ORDER_UPDATED",
                                    actorUserId,
                                    createdAt: new Date().toISOString(),
                                    visibility: "PUBLIC",
                                    payload: { characterIds: [] }
                                } as any);
                                globalEventStore.append({
                                    id: uuidv4(),
                                    sessionId: sessionId as string,
                                    seq: 0,
                                    type: "COMBAT_REACTION_ENDED",
                                    actorUserId,
                                    createdAt: new Date().toISOString(),
                                    visibility: "PUBLIC",
                                    payload: {}
                                } as any);
                                handleChallengeUpdate({ isActive: true });
                            }
                        }}
                    />
                )}
                {showVictory && <div className="victory-announcement">VITÓRIA</div>}
                {showDefeat && <div className="defeat-announcement">DERROTA</div>}
                {showCombat && <div className="combat-announcement">COMBATE</div>}
            </SessionHeader>

            {state.battlemap?.isActive && activeTab === "combat" && (
                <Battlemap
                    sessionId={sessionId as string}
                    userId={actorUserId}
                    isActive={state.battlemap.isActive}
                    imageUrl={state.battlemap.imageUrl || ""}
                    gridSize={state.battlemap.gridSize || 50}
                    gridColor={state.battlemap.gridColor}
                    gridThickness={state.battlemap.gridThickness}
                    strokes={state.battlemap.strokes || []}
                    objects={state.battlemap.objects || []}
                    isGM={userRole === "GM"}
                />
            )}

            {!isTheaterMode && (
                <div className={`session-container animate-reveal${activeTab === "combat" ? " in-combat" : ""}`}>
                    <div className={`main-command-layout${isNavExpanded ? " nav-expanded" : ""}`}>
                        <div className="tactical-nav-spacer" aria-hidden="true"></div>
                        <div className={`primary-display ${activeTab === "combat" || activeTab === "vi" ? "combat-mode-narrow" : ""}`}>
                            <div className="tab-content">
                                {activeTab === "notes" && (
                                    <div className="h-[calc(100vh-140px)] animate-reveal">
                                        <SessionNotes
                                            sessionId={sessionId as string}
                                            userId={actorUserId || "Anonymous"}
                                            userRole={userRole}
                                            state={state}
                                            globalBestiaryChars={globalBestiaryChars}
                                            onRegisterThreat={() => { setCreatorSource("bestiary"); setShowCreator(true); }}
                                            onRefresh={refresh}
                                            pendingMentionNavigation={pendingMentionNavigation}
                                            onMentionNavigationConsumed={() => setPendingMentionNavigation(null)}
                                        />
                                    </div>
                                )}

                                {activeTab === "vi" && (
                                    <div className="h-full animate-reveal">
                                        <VIControlPanel
                                            sessionId={sessionId as string}
                                            isGM={userRole === "GM"}
                                            soundSettings={state.soundSettings}
                                        />
                                    </div>
                                )}

                                {activeTab === "characters" && (
                                    <CharactersTab
                                        displayedCharacters={displayedCharacters}
                                        characterList={characterList}
                                        userRole={userRole}
                                        sessionId={sessionId as string}
                                        actorUserId={actorUserId}
                                        fixedCharacterId={fixedCharacterId}
                                        mentionEntities={mentionEntities}
                                        onNewCharacter={() => { setCreatorSource("active"); setShowCreator(true); }}
                                        bestiaryList={bestiaryList}
                                        stateCharacters={state.characters}
                                        sessionState={state}
                                        onMentionNavigate={handleMentionNavigate}
                                    />
                                )}

                                {activeTab === "combat" && (
                                    <CombatTab
                                        sessionId={sessionId as string}
                                        actorUserId={actorUserId}
                                        userRole={userRole}
                                        fixedCharacterId={fixedCharacterId}
                                        state={state}
                                        events={events}
                                        eventSessionMap={eventSessionMap}
                                        isRefreshing={isRefreshing}
                                        combatantList={combatantList}
                                        aspectList={aspectList}
                                        challengeMode={challengeMode}
                                        currentTurnActorId={currentTurnActorId}
                                        isCurrentPlayerActive={isCurrentPlayerActive}
                                        lastActionTimestamp={lastActionTimestamp}
                                        lastReactionAttack={lastReactionAttack}
                                        showDiceRoller={showDiceRoller}
                                        setShowDiceRoller={setShowDiceRoller}
                                        handleRemoveCharacter={handleRemoveCharacter}
                                        handleNextTurn={handleNextTurn}
                                        handleTogglePause={handleTogglePause}
                                        handleForcePass={handleForcePass}
                                        handlePreviousTurn={handlePreviousTurn}
                                        handleChallengeUpdate={handleChallengeUpdate}
                                        characterList={characterList}
                                        onRefresh={refresh}
                                        onSummonAlly={() => { setSummonMode("HERO"); setShowSummonModal(true); }}
                                        onSummonThreat={() => { setSummonMode("THREAT"); setShowSummonModal(true); }}
                                        onToggleChallenge={handleToggleChallengeMode}
                                        onOpenTurnOrder={() => setShowTurnOrderModal(true)}
                                    />
                                )}

                                {activeTab === "log" && (
                                    <LogTab
                                        filteredEvents={filteredEvents}
                                        logFilter={logFilter}
                                        setLogFilter={setLogFilter}
                                        logSessionFilter={logSessionFilter}
                                        setLogSessionFilter={setLogSessionFilter}
                                        logSessionNumbers={logSessionNumbers}
                                        eventSessionMap={eventSessionMap}
                                        state={state}
                                        events={events}
                                        isRefreshing={isRefreshing}
                                        onRefresh={refresh}
                                    />
                                )}

                                {activeTab === "bestiary" && (
                                    <BestiaryTab
                                        bestiaryList={bestiaryList}
                                        bestiarySearch={bestiarySearch}
                                        setBestiarySearch={setBestiarySearch}
                                        bestiarySessionOnly={bestiarySessionOnly}
                                        setBestiarySessionOnly={setBestiarySessionOnly}
                                        userRole={userRole}
                                        sessionId={sessionId as string}
                                        actorUserId={actorUserId}
                                        onRegisterThreat={() => { setCreatorSource("bestiary"); setShowCreator(true); }}
                                        findBestiaryChar={findBestiaryChar}
                                        stateCharacters={state.characters}
                                        setGlobalBestiaryChars={setGlobalBestiaryChars}
                                        viewingBestiaryCharId={viewingBestiaryCharId}
                                        setViewingBestiaryCharId={setViewingBestiaryCharId}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCreator && (
                <CharacterCreator
                    sessionId={sessionId as string}
                    actorUserId={actorUserId}
                    onClose={() => setShowCreator(false)}
                    source={creatorSource}
                    religionsList={Object.values(state.worldEntities || {}).filter((e: any) => e.type === "RELIGIAO")}
                />
            )}

            {showAspectManager && (
                <AspectManager
                    sessionId={sessionId as string}
                    actorUserId={actorUserId}
                    aspects={aspectList}
                    onClose={() => setShowAspectManager(false)}
                />
            )}

            {userRole === "GM" && pendingDamage && (
                <DamageResolutionModal
                    isOpen={!!pendingDamage}
                    defender={pendingDamage.defender}
                    damage={pendingDamage?.damage || 0}
                    track={pendingDamage?.track || "PHYSICAL"}
                    onConfirm={handleDamageConfirm}
                    onAutoCalculate={handleDamageAutoCalculate}
                    onSkip={handleDamageSkip}
                />
            )}

            {userRole === "GM" && activeConsequence && (
                <ConsequenceModal
                    isOpen={true}
                    initialText=""
                    initialDebuffSkill=""
                    initialDebuffValue={0}
                    onSave={handleConsequenceSave}
                    onCancel={handleConsequenceCancel}
                />
            )}
            {state.battlemap?.isActive && activeTab === "combat" && (
                <button
                    onClick={() => battlemapToolStore.toggleTheaterMode()}
                    title={isTheaterMode ? "Sair do Modo Teatro" : "Modo Teatro"}
                    style={{
                        position: "fixed", 
                        bottom: "24px", 
                        right: videoStream ? "86px" : "24px", 
                        zIndex: 9999,
                        width: "52px", 
                        height: "52px", 
                        borderRadius: "50%",
                        border: isTheaterMode ? "2px solid var(--accent-color)" : "2px solid rgba(200, 160, 89, 0.4)",
                        background: isTheaterMode ? "rgba(197, 160, 89, 0.2)" : "rgba(10, 10, 10, 0.75)",
                        color: isTheaterMode ? "var(--accent-color)" : "#C5A059",
                        backdropFilter: "blur(8px)", 
                        cursor: "pointer",
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        boxShadow: isTheaterMode
                            ? "0 0 20px rgba(197, 160, 89, 0.4), 0 4px 16px rgba(0,0,0,0.5)"
                            : "0 0 16px rgba(197, 160, 89, 0.15), 0 4px 12px rgba(0,0,0,0.4)",
                        transition: "all 0.3s ease", 
                        outline: "none"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                    {isTheaterMode ? <Tv size={24} /> : <Monitor size={24} />}
                </button>
            )}

            {diceVisible && (
                <FateDice3D
                    isVisible={true}
                    initialPool={diceParams?.currentPool ?? diceParams?.initialPool}
                    onPoolChange={(pool) => {
                        diceSimulationStore.updateCurrentPool(pool);
                        diceParams?.onPoolChange?.(pool);
                    }}
                    accentColor={diceParams?.accentColor}
                    calculationBreakdown={diceParams?.calculationBreakdown}
                    resultOverlay={diceParams?.resultOverlay}
                    onSettled={(results, breakdown) => {
                        diceParams?.onSettled(results, breakdown);
                        diceSimulationStore.hide();
                    }}
                    onPreResult={(results) => {
                        diceParams?.onPreResult?.(results);
                    }}
                    userRole={userRole}
                    activeTab={activeTab}
                />
            )}
        </div>
    );
}




