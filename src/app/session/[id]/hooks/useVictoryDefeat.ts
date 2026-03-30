import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { globalEventStore } from "@/lib/eventStore";
import { isCharacterEliminated } from "@/lib/gameLogic";
import { Character } from "@/types/domain";

interface VictoryDefeatParams {
    sessionId: string;
    actorUserId: string;
    userRole: "GM" | "PLAYER";
    state: any;
    challengeMode: boolean;
    setChallengeMode: (v: boolean) => void;
    activePlayers: Character[];
    allPlayersEliminated: boolean;
    activeEnemyCount: number;
}

export function useVictoryDefeat({
    sessionId,
    actorUserId,
    userRole,
    state,
    challengeMode,
    setChallengeMode,
    activePlayers,
    allPlayersEliminated,
    activeEnemyCount,
}: VictoryDefeatParams) {
    const [showVictory, setShowVictory] = useState(false);
    const [showDefeat, setShowDefeat] = useState(false);
    const [showCombat, setShowCombat] = useState(false);
    const [combatHasStarted, setCombatHasStarted] = useState(false);
    const [hadEnemies, setHadEnemies] = useState(false);
    const [hadLivingPlayers, setHadLivingPlayers] = useState(false);
    const [victoryPending, setVictoryPending] = useState(false);
    const [deathFocusCharId, setDeathFocusCharId] = useState<string | null>(null);

    const prevEliminatedRef = useRef<Record<string, boolean>>({});
    const prevChallengeModeRef = useRef<boolean>(challengeMode);
    const lastToggleTimeRef = useRef(0);
    const combatStartTimeRef = useRef<number | null>(null);

    // Initialize challengeMode from state on first mount
    useEffect(() => {
        setChallengeMode(state.challenge?.isActive ?? true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-sync challengeMode when server state updates (avoids overwriting a local toggle)
    useEffect(() => {
        const timeSinceLastToggle = Date.now() - lastToggleTimeRef.current;
        if (timeSinceLastToggle > 2000) {
            const hasActiveTurns = state.turnOrder && state.turnOrder.length > 0;
            const isActive = hasActiveTurns ? false : (state.challenge?.isActive ?? true);
            if (challengeMode !== isActive) {
                setChallengeMode(isActive);
                if (isActive) {
                    setHadEnemies(false);
                    setCombatHasStarted(false);
                }
            }
        }
    }, [state.challenge?.isActive, state.turnOrder?.length, challengeMode]);

    // Detect entering combat and track that enemies existed
    useEffect(() => {
        const isInCombat = !challengeMode;
        const hasEnemiesInCombat = state.turnOrder?.some((id: string) => {
            const c = state.characters[id];
            return c && c.isNPC && c.arenaSide !== "HERO" && !isCharacterEliminated(c);
        }) || false;

        if (isInCombat && hasEnemiesInCombat && !hadEnemies) {
            setHadEnemies(true);
        }
    }, [challengeMode, state.characters, state.turnOrder, hadEnemies, state.challenge?.isActive]);

    // BATTLE START SOUND: plays when transitioning from challenge → combat
    useEffect(() => {
        const combatStarted = prevChallengeModeRef.current === true && challengeMode === false;
        if (combatStarted) {
            setShowCombat(true);
            setCombatHasStarted(true);
            const battleStartSound = state.soundSettings?.battleStart || "/audio/Effects/battle_start.mp3";
            const audio = new Audio(battleStartSound);
            audio.volume = 0.6;
            audio.play().catch(e => console.warn("Failed to play battle start sound:", e));
        }
        prevChallengeModeRef.current = challengeMode;
    }, [challengeMode, state.soundSettings?.battleStart]);

    // DEATH FOCUS DETECTOR + DEATH SOUND
    useEffect(() => {
        const currentEliminated: Record<string, boolean> = {};
        let justDiedId: string | null = null;

        Object.values(state.characters).forEach((char: any) => {
            const isEliminated = isCharacterEliminated(char);
            currentEliminated[char.id] = isEliminated;
            if (isEliminated && prevEliminatedRef.current[char.id] === false) {
                justDiedId = char.id;
            }
        });

        if (justDiedId) {
            console.log("Death detected for:", justDiedId);
            setDeathFocusCharId(justDiedId);
            const deathSound = state.soundSettings?.death || "/audio/Effects/morte.mp3";
            const audio = new Audio(deathSound);
            audio.play().catch(e => console.warn("Failed to play death sound:", e));
        }

        prevEliminatedRef.current = currentEliminated;
    }, [state.characters]);

    // Auto-clear overlay timers
    useEffect(() => {
        if (!deathFocusCharId) return;
        const timer = setTimeout(() => setDeathFocusCharId(null), 5000);
        return () => clearTimeout(timer);
    }, [deathFocusCharId]);

    useEffect(() => {
        if (!showVictory) return;
        const timer = setTimeout(() => setShowVictory(false), 5000);
        return () => clearTimeout(timer);
    }, [showVictory]);

    useEffect(() => {
        if (!showDefeat) return;
        const timer = setTimeout(() => setShowDefeat(false), 5000);
        return () => clearTimeout(timer);
    }, [showDefeat]);

    useEffect(() => {
        if (!showCombat) return;
        const timer = setTimeout(() => setShowCombat(false), 5000);
        return () => clearTimeout(timer);
    }, [showCombat]);

    // 1. Detect Victory Condition
    useEffect(() => {
        const isVictory =
            hadEnemies &&
            (!state.challenge?.isActive || !challengeMode) &&
            activeEnemyCount === 0 &&
            !allPlayersEliminated;

        if (isVictory) {
            if (!victoryPending) setVictoryPending(true);
        } else {
            if (activeEnemyCount > 0 && victoryPending) setVictoryPending(false);
        }
    }, [hadEnemies, state.challenge?.isActive, activeEnemyCount, allPlayersEliminated, victoryPending]);

    // 2. Execute Victory (waits for death animation to finish)
    useEffect(() => {
        if (!victoryPending || deathFocusCharId) return;

        const timer = setTimeout(() => {
            if (!showVictory) setShowVictory(true);
            setCombatHasStarted(false);

            if (userRole === "GM") {
                const victoryUrl = state.soundSettings?.victory || "/audio/Effects/vitoria.mp3";

                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "MUSIC_PLAYBACK_CHANGED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: {
                        url: victoryUrl, playing: true, loop: false, isTemporary: true,
                        restoreUrl: state.currentMusic?.url, restoreLoop: state.currentMusic?.loop
                    }
                } as any);

                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: { characterIds: [] }
                } as any);

                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "COMBAT_REACTION_ENDED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: {}
                } as any);

                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "CHALLENGE_UPDATED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: {
                        isActive: true,
                        text: state.challenge?.text || "",
                        difficulty: state.challenge?.difficulty || 0,
                        aspects: state.challenge?.aspects || ["", "", ""]
                    }
                } as any);
            }

            setHadEnemies(false);
            setChallengeMode(true);
            setVictoryPending(false);
            lastToggleTimeRef.current = Date.now();
        }, 2000);

        return () => clearTimeout(timer);
    }, [victoryPending, deathFocusCharId, showVictory, userRole, sessionId, actorUserId,
        state.soundSettings?.victory, state.currentMusic, state.challenge]);

    // DEFEAT LOGIC
    useEffect(() => {
        const currentlyHasLivingPlayers = activePlayers.some(c => !isCharacterEliminated(c));
        const defeatCondition = hadLivingPlayers && !currentlyHasLivingPlayers && activePlayers.length > 0;

        if (defeatCondition) {
            if (deathFocusCharId) {
                console.log("Defeat pending: waiting for death focus to clear");
                return;
            }
            console.log("Defeat conditions met, triggering now");
            setShowDefeat(true);

            if (userRole === "GM") {
                const defeatUrl = state.soundSettings?.defeat || "/audio/Effects/derrota.mp3";
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "MUSIC_PLAYBACK_CHANGED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: {
                        url: defeatUrl, playing: true, loop: false, isTemporary: true,
                        restoreUrl: state.currentMusic?.url, restoreLoop: state.currentMusic?.loop
                    }
                } as any);
            }
            setHadLivingPlayers(false);
        } else if (currentlyHasLivingPlayers) {
            setHadLivingPlayers(true);
        }
    }, [activePlayers, hadLivingPlayers, state.soundSettings?.defeat, userRole,
        sessionId, actorUserId, state.currentMusic, deathFocusCharId]);

    return {
        showVictory,
        showDefeat,
        showCombat,
        combatHasStarted,
        setCombatHasStarted,
        hadEnemies,
        setHadEnemies,
        deathFocusCharId,
        victoryPending,
        setVictoryPending,
        lastToggleTimeRef,
        combatStartTimeRef,
    };
}
