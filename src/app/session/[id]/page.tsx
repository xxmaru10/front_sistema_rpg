/**
 * @file: src/app/session/[id]/page.tsx
 * @summary: Main entry point for the session page. Orchestrates the RPG session UI,
 * including combat, bestiary, logs, and game state management.
 */
"use client";

import "./session.css";
import { useParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { battlemapToolStore } from "@/lib/battlemapToolStore";
import { globalEventStore } from "@/lib/eventStore";
import { floatingNotesStore } from "@/lib/floatingNotesStore";
import { useProjectedState, projectedStateStore } from "@/lib/projectedStateStore";
import * as apiClient from "@/lib/apiClient";
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
import { loadSystem } from "@/systems/registry";
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
type SessionTab = "characters" | "log" | "combat" | "bestiary" | "notes" | "vi";

export default function SessionPage() {
    const { id: sessionId } = useParams();

    const searchParams = useSearchParams();
    const actorUserId = searchParams.get("u") || "Visitante";
    const userRole = (searchParams.get("r") as "GM" | "PLAYER") || "PLAYER";
    const fixedCharacterId = searchParams.get("c") || undefined;

    // ─── SYSTEM HINT (legacy sessions) ─────────────────────────────────────────
    // For sessions created before the system was stored in the SESSION_CREATED
    // event payload, seed the projectedStateStore with the system from the API so
    // that useSystemPlugin() picks up the correct plugin even on old events.
    useEffect(() => {
        if (!sessionId) return;
        apiClient.fetchSessionJoinInfo(sessionId as string)
            .then((info) => {
                if (info?.system) projectedStateStore.setSystemHint(info.system);
            })
            .catch(() => { /* silently ignore — fallback to "fate" */ });
    }, [sessionId]);

    // â"€â"€â"€ UI STATE â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
    const [gmPreviewFaded, setGmPreviewFaded] = useState(false);

    const handleMentionNavigate = useCallback((request: MentionNavigationRequest) => {
        setPendingMentionNavigation(request);
        setViewingBestiaryCharId(null);
        startTransition(() => {
            setActiveTab("notes");
        });
    }, [setActiveTab, setViewingBestiaryCharId]);

    useEffect(() => {
        const unsub = diceSimulationStore.subscribe(() => {
            setDiceVisible(diceSimulationStore.getIsVisible());
            setDiceParams(diceSimulationStore.getParams());
        });
        return () => { unsub(); };
    }, []);

    useEffect(() => {
        // Story 45: reset do toggle de rolagem oculta ao trocar de sessÃ£o.
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

    useEffect(() => {
        const body = document.body;
        const coarsePointerMedia = window.matchMedia("(hover: none), (pointer: coarse)");
        const mobileViewportMedia = window.matchMedia("(max-width: 1024px)");

        const syncThemeAnimationKillSwitch = () => {
            const isTouchOrMobile = coarsePointerMedia.matches || mobileViewportMedia.matches;
            const isOutsideArena = activeTab !== "combat";
            const shouldDisableThemeAnimation = isTouchOrMobile || isOutsideArena;

            if (shouldDisableThemeAnimation) {
                body.dataset.disableThemeAnimation = "true";
                return;
            }

            delete body.dataset.disableThemeAnimation;
        };

        syncThemeAnimationKillSwitch();
        coarsePointerMedia.addEventListener("change", syncThemeAnimationKillSwitch);
        mobileViewportMedia.addEventListener("change", syncThemeAnimationKillSwitch);

        return () => {
            coarsePointerMedia.removeEventListener("change", syncThemeAnimationKillSwitch);
            mobileViewportMedia.removeEventListener("change", syncThemeAnimationKillSwitch);
            delete body.dataset.disableThemeAnimation;
        };
    }, [activeTab]);

    const [isTheaterMode, setIsTheaterMode] = useState(battlemapToolStore.isTheaterMode);

    const closeNavDrawer = useCallback(() => {
        setIsNavExpanded(false);
        setSuppressHoverOpen(true);
    }, []);

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

    const switchTabFromNav = useCallback((tab: SessionTab) => {
        if (tab === "characters" || tab === "combat" || tab === "bestiary" || tab === "log") {
            setViewingBestiaryCharId(null);
        }
        startTransition(() => {
            setActiveTab(tab);
        });
        closeNavDrawer();
    }, [closeNavDrawer, setActiveTab, setViewingBestiaryCharId]);

    useEffect(() => {
        const unsub = battlemapToolStore.subscribe(() => {
            setIsTheaterMode(battlemapToolStore.isTheaterMode);
        });
        return unsub;
    }, []);

    // â"€â"€â"€ EVENTS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    const { events, isLoading, isRefreshing, globalBestiaryChars, setGlobalBestiaryChars, connectionStatus, failedEventIds, refresh } =
        useSessionEvents(sessionId as string, actorUserId);

    // â"€â"€â"€ EARLY PROJECTION (feeds useVictoryDefeat before full derivations) â"€â"€â"€â"€
    // Story 46 Prioridade 3: lÃª do projectedStateStore em vez de recomputar localmente.
    const _earlyState = useProjectedState();

    // ─── PLUGIN PRÉ-LOAD ─────────────────────────────────────────────────────
    const [systemReady, setSystemReady] = useState(false);
    useEffect(() => {
        const system = _earlyState.system ?? "fate";
        loadSystem(system).then(() => setSystemReady(true)).catch(() => setSystemReady(true));
    }, [_earlyState.system]);

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

    // â"€â"€â"€ VICTORY / DEFEAT â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

    // â"€â"€â"€ FULL DERIVATIONS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

    // â"€â"€â"€ SCREEN SHARE / AUDIO LIFECYCLE â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

    // GM preview pause: after 4s of broadcasting, pause the local <video> element to stop
    // frame decoding â€" real CPU/GPU savings. Players are unaffected (they receive via WebRTC).
    // Clicking the hint or video resumes the element.
    useEffect(() => {
        const isBroadcasting = userRole === "GM" && !!videoStream && (screenShareManagerRef.current?.broadcasting ?? false);
        if (!isBroadcasting) {
            setGmPreviewFaded(false);
            return;
        }
        setGmPreviewFaded(false);
        const timer = setTimeout(() => {
            setGmPreviewFaded(true);
            screenVideoRef.current?.pause();
        }, 4000);
        return () => clearTimeout(timer);
    }, [videoStream, userRole]);

    // â"€â"€â"€ COMBAT AUTOMATION â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

    // â"€â"€â"€ SESSION ACTIONS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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

    // â"€â"€â"€ SHARED GM CALLBACKS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
    const handleOpenActiveCharacterCreator = useCallback(() => {
        setCreatorSource("active");
        setShowCreator(true);
    }, [setCreatorSource, setShowCreator]);
    const handleOpenBestiaryCharacterCreator = useCallback(() => {
        setCreatorSource("bestiary");
        setShowCreator(true);
    }, [setCreatorSource, setShowCreator]);
    const handleOpenSummonAlly = useCallback(() => {
        setSummonMode("HERO");
        setShowSummonModal(true);
    }, [setShowSummonModal, setSummonMode]);
    const handleOpenSummonThreat = useCallback(() => {
        setSummonMode("THREAT");
        setShowSummonModal(true);
    }, [setShowSummonModal, setSummonMode]);
    const handleOpenTurnOrder = useCallback(() => {
        setShowTurnOrderModal(true);
    }, [setShowTurnOrderModal]);
    const handleToggleDiceRollerVisibility = useCallback(() => {
        setShowDiceRoller(prev => !prev);
    }, [setShowDiceRoller]);
    const handleMentionNavigationConsumed = useCallback(() => {
        setPendingMentionNavigation(null);
    }, []);

    useEffect(() => {
        if (!state.battlemap?.isActive && isTheaterMode) {
            battlemapToolStore.setTheaterMode(false);
        }
    }, [state.battlemap?.isActive, isTheaterMode]);

    // â"€â"€â"€ REMAINING EFFECTS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€


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
            document.body.style.backgroundSize = "cover, cover";
            document.body.style.backgroundPosition = "center center, center center";
            // background-attachment: fixed causa repaint contÃ­nuo no Chromium mobile â€" usar scroll em mobile
            document.body.style.backgroundAttachment = isMobileNav ? "scroll" : "fixed";
            document.body.style.backgroundRepeat = "no-repeat, no-repeat";
            document.body.style.backgroundColor = "#000";
            // Alguns temas animam o `body` (ex.: starry-drift); na Arena isso faz o banner andar sem parar.
            document.body.style.animation = "none";
        } else {
            document.body.style.backgroundImage = "";
            document.body.style.backgroundSize = "";
            document.body.style.backgroundPosition = "";
            document.body.style.backgroundAttachment = "";
            document.body.style.backgroundRepeat = "";
            document.body.style.backgroundColor = "";
            document.body.style.animation = "";
        }
    }, [activeTab, headerImageUrl, deathFocusCharId, videoStream, state.battlemap?.isActive, isMobileNav]);

    // â"€â"€â"€ Gerencia Google Fonts + theme-preset-css via efeito â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    // Antes era um IIFE no JSX: executava a cada render â†’ re-fazia download do .woff2
    // Agora sÃ³ executa quando state.themePreset muda de fato.
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

    // â"€â"€â"€ Gerencia o override de cor personalizada via efeito â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
    // Antes era um IIFE no JSX com dangerouslySetInnerHTML: re-montava a cada render
    // Agora sÃ³ executa quando state.themeColor muda.
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

    // â"€â"€â"€ LOADING SCREEN â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

    if (isLoading || !systemReady) {
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
                    {!systemReady ? "Carregando sistema..." : "Carregando dados..."}
                </span>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // â"€â"€â"€ RENDER â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
            {/* Screen share video â€" mantido montado enquanto stream ativa; oculto via CSS
                em outras abas para preservar o MediaStream sem re-handshake ao voltar. */}
            {videoStream && (
                <video
                    autoPlay playsInline muted
                    className={`screenshare-video${gmPreviewFaded ? " screenshare-video--gm-faded" : ""}`}
                    ref={(el) => {
                        screenVideoRef.current = el;
                        if (el && videoStream && el.srcObject !== videoStream) {
                            el.srcObject = videoStream;
                            // play() Ã© gerenciado exclusivamente pelo hook (com muted fallback)
                        }
                    }}
                    style={{
                        top: spectatorMode ? 0 : "70px",
                        height: spectatorMode ? "100vh" : "calc(100vh - 70px)",
                        zIndex: spectatorMode ? 1 : 0,
                        background: spectatorMode ? "#000" : "transparent",
                        display: activeTab === "combat" ? undefined : "none",
                    }}
                    onClick={() => {
                        if (gmPreviewFaded) {
                            setGmPreviewFaded(false);
                            screenVideoRef.current?.play().catch(() => {});
                        }
                    }}
                    title={gmPreviewFaded ? "Clique para ver a transmissÃ£o" : undefined}
                />
            )}

            {/* GM preview paused hint */}
            {videoStream && activeTab === "combat" && gmPreviewFaded && (
                <div className="screenshare-gm-faded-hint" onClick={() => {
                    setGmPreviewFaded(false);
                    screenVideoRef.current?.play().catch(() => {});
                }}>
                    Transmitindo Â· clique para ver
                </div>
            )}

            {/* Badge "Sem sinal" â€" exibido quando stream estÃ¡ ativa mas vÃ­deo nÃ£o avanÃ§a. */}
            {videoStream && activeTab === "combat" && videoNoSignal && (
                <div className="screenshare-nosignal">
                    <span className="screenshare-nosignal-icon">ðŸ"¡</span>
                    <span>Sem sinal â€" tente reconectar no botÃ£o <RefreshCw size={12} style={{ verticalAlign: "middle" }} /> no topo.</span>
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



            {activeTab === "combat" && !isMobileNav && (
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
                title={state.name || `SessÃ£o: ${state.sessionNumber}`}
                imageUrl={headerImageUrl}
                onUpdate={handleHeaderUpdate}
                isGM={userRole === "GM"}
                tabName={
                    activeTab === "characters" ? "PERSONAGEM" :
                    activeTab === "combat" ? "ARENA" :
                    activeTab === "log" ? "LOGS" :
                    activeTab === "notes" ? "NOTAS" :
                    activeTab === "vi" ? "VI" : "BESTIÃRIO"
                }
                onSummonAlly={handleOpenSummonAlly}
                onSummonThreat={handleOpenSummonThreat}
                onToggleChallenge={handleToggleChallengeMode}
                onOpenTurnOrder={handleOpenTurnOrder}
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
                onToggleDiceRoller={handleToggleDiceRollerVisibility}
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
                {showVictory && <div className="victory-announcement">VITÃ"RIA</div>}
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
                                            onRegisterThreat={handleOpenBestiaryCharacterCreator}
                                            onRefresh={refresh}
                                            pendingMentionNavigation={pendingMentionNavigation}
                                            onMentionNavigationConsumed={handleMentionNavigationConsumed}
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
                                        onNewCharacter={handleOpenActiveCharacterCreator}
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
                                        onSummonAlly={handleOpenSummonAlly}
                                        onSummonThreat={handleOpenSummonThreat}
                                        onToggleChallenge={handleToggleChallengeMode}
                                        onOpenTurnOrder={handleOpenTurnOrder}
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
                                        onRegisterThreat={handleOpenBestiaryCharacterCreator}
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





