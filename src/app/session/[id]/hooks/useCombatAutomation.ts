import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { globalEventStore } from "@/lib/eventStore";
import { computeState } from "@/lib/projections";
import { isCharacterEliminated, calculateAbsorption } from "@/lib/gameLogic";
import type { ActionEvent, Character } from "@/types/domain";

function getCharactersFromProjectedStore(): Record<string, Character> {
    const events = globalEventStore.getEvents();
    const sorted = [...events].sort((a: ActionEvent, b: ActionEvent) => {
        const seqA = a.seq || 0;
        const seqB = b.seq || 0;
        if (seqA > 0 && seqB > 0 && seqA !== seqB) return seqA - seqB;
        if (seqA > 0 && seqB === 0) return -1;
        if (seqA === 0 && seqB > 0) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const snapshot = globalEventStore.getSnapshotState();
    const snapshotUpToSeq = globalEventStore.getSnapshotUpToSeq();
    const projectionEvents =
        snapshot && snapshotUpToSeq >= 0
            ? sorted.filter((e) => (e.seq || 0) === 0 || (e.seq || 0) > snapshotUpToSeq)
            : sorted;
    return computeState(projectionEvents, snapshot ?? undefined).characters as Record<string, Character>;
}

interface CombatAutomationParams {
    sessionId: string;
    actorUserId: string;
    userRole: "GM" | "PLAYER";
    state: any;
    currentTurnActorId: string | null;
    isCurrentPlayerActive: boolean;
    challengeMode: boolean;
    events: ActionEvent[];
    /** Quando false, a timeline inicial já foi carregada (evita modal em desfechos antigos). */
    isSessionEventsLoading: boolean;
}

export function useCombatAutomation({
    sessionId,
    actorUserId,
    userRole,
    state,
    currentTurnActorId,
    isCurrentPlayerActive,
    challengeMode,
    events,
    isSessionEventsLoading,
}: CombatAutomationParams) {
    const [consequenceQueue, setConsequenceQueue] = useState<
        { characterId: string; slot: string; damage: number; track: "PHYSICAL" | "MENTAL" }[]
    >([]);
    const [deathTurnPassed, setDeathTurnPassed] = useState<Set<string>>(new Set());
    const [pendingDamage, setPendingDamage] = useState<
        { defender: Character; damage: number; track: "PHYSICAL" | "MENTAL" } | null
    >(null);

    const processedOutcomeIds = useRef<Set<string>>(new Set());
    const scheduledDeletionIds = useRef<Set<string>>(new Set());
    const processedTurnOrderIds = useRef<Set<string>>(new Set());
    const prevActorIdRef = useRef<string | null>(null);
    const stateRef = useRef(state);
    const combatOutcomeHandlerRef = useRef<(event: ActionEvent) => void>(() => {});
    const seededHistoricalCombatOutcomesRef = useRef(false);

    // Keep stateRef in sync for use inside subscriptions
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        processedOutcomeIds.current.clear();
        seededHistoricalCombatOutcomesRef.current = false;
    }, [sessionId]);

    useEffect(() => {
        if (userRole !== "GM" || isSessionEventsLoading || seededHistoricalCombatOutcomesRef.current) return;
        if (events.length === 0) return;
        for (const e of events) {
            if (e.type === "COMBAT_OUTCOME" && (e.seq || 0) > 0) {
                processedOutcomeIds.current.add(e.id);
            }
        }
        seededHistoricalCombatOutcomesRef.current = true;
    }, [isSessionEventsLoading, events, userRole]);

    combatOutcomeHandlerRef.current = (event: ActionEvent) => {
        if (event.type !== "COMBAT_OUTCOME") return;
        console.log("🔥 [useCombatAutomation] COMBAT_OUTCOME RECEIVED:", event);
        const raw = Number((event.payload as any)?.result);
        console.log("🔥 [useCombatAutomation] Parsed raw result:", raw);
        if (!Number.isFinite(raw) || raw <= 0) {
            console.log("🔥 [useCombatAutomation] Aborting because raw <= 0 or not finite.");
            return;
        }
        if (processedOutcomeIds.current.has(event.id)) return;

        const defenderId = String((event.payload as any).defenderId || "");
        if (!defenderId) return;

        const currentState = stateRef.current;
        const projectedChars = getCharactersFromProjectedStore();
        const defender =
            projectedChars[defenderId] ||
            (currentState.characters[defenderId] as Character | undefined);

        if (!defender) {
            console.warn("[useCombatAutomation] Damage resolution failed: Defender not found in state", defenderId);
            return;
        }

        if (isCharacterEliminated(defender)) {
            console.log("🔥 [useCombatAutomation] Aborting because defender is already eliminated.");
            processedOutcomeIds.current.add(event.id);
            return;
        }

        console.log("🔥 [useCombatAutomation] SETTING PENDING DAMAGE FOR:", defender.name, "| Damage:", raw);
        processedOutcomeIds.current.add(event.id);
        const track =
            (event.payload as { track?: "PHYSICAL" | "MENTAL" }).track ||
            currentState.damageType ||
            "PHYSICAL";
        setPendingDamage({ defender: { ...defender }, damage: raw, track });
    };

    // ─── TURN ACTIONS ────────────────────────────────────────────────────────

    const handleNextTurn = (forceNewRound = false) => {
        if (userRole !== "GM" && !isCurrentPlayerActive) return;
        if (!state.turnOrder || state.turnOrder.length === 0) return;

        const nextIndex = forceNewRound
            ? 0
            : ((state.currentTurnIndex || 0) + 1) % state.turnOrder.length;

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "TURN_STEPPED",
            actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { index: nextIndex }
        } as any);
    };

    const handlePreviousTurn = () => {
        if (userRole !== "GM" || !state.turnOrder || state.turnOrder.length === 0) return;
        const current = state.currentTurnIndex || 0;
        const prevIndex = (current - 1 + state.turnOrder.length) % state.turnOrder.length;

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "TURN_STEPPED",
            actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { index: prevIndex }
        } as any);
    };

    const handleTogglePause = () => {
        const isPaused = stateRef.current.timerPaused;
        if (!isPaused) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "TIMER_PAUSED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { pausedAt: new Date().toISOString() }
            } as any);
        } else {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "TIMER_RESUMED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { resumedAt: new Date().toISOString() }
            } as any);
        }
    };

    const handleForcePass = () => {
        if (!currentTurnActorId) return;

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "TURN_FORCED_PASS",
            actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId: currentTurnActorId, isReaction: !!state.isReaction }
        } as any);

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "COMBAT_REACTION_ENDED",
            actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: {}
        } as any);

        if (!state.isReaction) {
            handleNextTurn(false);
        }
    };

    // ─── CONSEQUENCE HANDLERS ────────────────────────────────────────────────

    const activeConsequence = consequenceQueue[0] || null;

    const handleConsequenceSave = (text: string, debuffSkill: string, debuffValue: number) => {
        if (!activeConsequence) return;
        const { characterId, slot } = activeConsequence;
        const debuff = debuffSkill ? { skill: debuffSkill, value: debuffValue } : undefined;

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_UPDATED",
            actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { characterId, slot, value: text, debuff }
        } as any);

        setConsequenceQueue(prev => prev.slice(1));
        if (state.timerPaused) handleTogglePause();
    };

    const handleConsequenceCancel = () => {
        setConsequenceQueue(prev => prev.slice(1));
        if (state.timerPaused) handleTogglePause();
    };

    // Pause timer while GM is filling out the consequence modal
    useEffect(() => {
        if (activeConsequence && userRole === "GM" && !state.timerPaused) {
            handleTogglePause();
        }
    }, [activeConsequence, userRole, state.timerPaused]);

    // ─── AUTO-CLEAR STUCK REACTION ───────────────────────────────────────────

    useEffect(() => {
        if (!state.isReaction || !state.targetId) return;
        const target = state.characters[state.targetId];
        if (!target || !isCharacterEliminated(target)) return;

        const isOwner = target.ownerUserId === actorUserId;
        if (userRole === "GM" || isOwner) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "COMBAT_REACTION_ENDED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: {}
            } as any);
        }
    }, [state.isReaction, state.targetId, state.characters, userRole, actorUserId, sessionId]);

    // ─── DAMAGE RESOLUTION: OPEN MODAL ON COMBAT_OUTCOME (GM ONLY) ──────────
    //
    // The modal (DamageResolutionModal) lets the GM decide how the damage is
    // absorbed manually, or fall back to the legacy automatic flow via the
    // "Cálculo automático" button. Players do not see the modal.

    useEffect(() => {
        if (userRole !== "GM") return;
        const unsubscribe = globalEventStore.subscribe((event) => {
            combatOutcomeHandlerRef.current(event);
        });
        return unsubscribe;
    }, [sessionId, actorUserId, userRole]);

    // Reforço: quando `events` do React atualiza (ex.: merge WebSocket), reprocessa
    // o último COMBAT_OUTCOME válido — o subscribe sozinho pode perder corrida com o estado.
    useEffect(() => {
        if (userRole !== "GM" || !events?.length) return;
        for (let i = events.length - 1; i >= 0; i--) {
            const e = events[i];
            if (e.type !== "COMBAT_OUTCOME") continue;
            const raw = Number((e.payload as any)?.result);
            if (!Number.isFinite(raw) || raw <= 0) continue;
            if (processedOutcomeIds.current.has(e.id)) continue;
            combatOutcomeHandlerRef.current(e);
            break;
        }
    }, [events, userRole]);

    // Pause the timer while the GM is resolving damage
    useEffect(() => {
        if (pendingDamage && userRole === "GM" && !state.timerPaused) {
            handleTogglePause();
        }
    }, [pendingDamage, userRole, state.timerPaused]);

    const handleDamageConfirm = (applied: {
        stressPhysical: number[];
        stressMental: number[];
        consequences: { slot: string; text: string }[];
    }) => {
        if (!pendingDamage) return;
        const defenderId = pendingDamage.defender.id;

        applied.stressPhysical.forEach(idx => {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "STRESS_MARKED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: defenderId, track: "PHYSICAL", boxIndex: idx }
            } as any);
        });

        applied.stressMental.forEach(idx => {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "STRESS_MARKED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: defenderId, track: "MENTAL", boxIndex: idx }
            } as any);
        });

        applied.consequences.forEach(c => {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_CONSEQUENCE_UPDATED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: defenderId, slot: c.slot, value: c.text }
            } as any);
        });

        setPendingDamage(null);
        if (stateRef.current.timerPaused) handleTogglePause();
    };

    const handleDamageAutoCalculate = () => {
        if (!pendingDamage) return;
        const { defender, damage, track } = pendingDamage;
        const currentState = stateRef.current;
        const liveDefender = currentState.characters[defender.id] || defender;
        if (!liveDefender) { setPendingDamage(null); return; }

        const absorption = calculateAbsorption(liveDefender, damage, track);
        const defenderId = defender.id;

        absorption.stressToMarkIndices.forEach((idx: number) => {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "STRESS_MARKED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterId: defenderId, track, boxIndex: idx }
            } as any);
        });

        if (absorption.consequenceSlot) {
            setConsequenceQueue(prev => {
                const alreadyQueued = prev.some(
                    q => q.characterId === defenderId && q.slot === absorption.consequenceSlot
                );
                if (alreadyQueued) return prev;
                return [...prev, {
                    characterId: defenderId,
                    slot: absorption.consequenceSlot!,
                    damage: damage - absorption.stressToMarkIndices.length,
                    track
                }];
            });
        }

        setPendingDamage(null);
        // Timer stays paused — ConsequenceModal (text prompt) will resume it on close.
        if (!absorption.consequenceSlot && stateRef.current.timerPaused) {
            handleTogglePause();
        }
    };

    const handleDamageSkip = () => {
        setPendingDamage(null);
        if (stateRef.current.timerPaused) handleTogglePause();
    };

    // ─── AUTOMATIC TURN ORDER INTEGRATION (Garbage Collector) ───────────────

    useEffect(() => {
        if (userRole !== "GM" || !state.turnOrder || state.turnOrder.length === 0) return;

        const currentIds = new Set(state.turnOrder);
        const newIds: string[] = [];

        Object.values(state.characters).forEach((char: any) => {
            if (char.activeInArena && (char.isNPC || char.isHazard) && !currentIds.has(char.id)) {
                if (!processedTurnOrderIds.current.has(char.id)) {
                    newIds.push(char.id);
                    processedTurnOrderIds.current.add(char.id);
                }
            }
            if (!char.activeInArena && processedTurnOrderIds.current.has(char.id)) {
                processedTurnOrderIds.current.delete(char.id);
            }
        });

        if (newIds.length > 0) {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: { characterIds: [...state.turnOrder, ...newIds] }
            } as any);
        }
    }, [state.characters, state.turnOrder, userRole, sessionId, actorUserId]);

    // ─── AUTOMATIC NPC DELETION AFTER DEFEAT ────────────────────────────────

    useEffect(() => {
        if (userRole !== "GM") return;
        Object.values(state.characters).forEach((char: any) => {
            if (char.isNPC && isCharacterEliminated(char) && !scheduledDeletionIds.current.has(char.id)) {
                scheduledDeletionIds.current.add(char.id);
                setTimeout(() => {
                    globalEventStore.append({
                        id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_DELETED",
                        actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                        payload: { characterId: char.id }
                    } as any);
                }, 2000);
            }
        });
    }, [state.characters, userRole, sessionId, actorUserId]);

    // ─── AUTO-SKIP DEAD CHARACTERS (GM ONLY) ────────────────────────────────

    useEffect(() => {
        if (userRole !== "GM" || !state.turnOrder || state.turnOrder.length === 0) return;
        const idx = state.currentTurnIndex || 0;
        const actorId = state.turnOrder[idx < state.turnOrder.length ? idx : 0];
        const actor = state.characters[actorId];

        if (actor && isCharacterEliminated(actor)) {
            const timer = setTimeout(() => {
                const nextIndex = (idx + 1) % (state.turnOrder?.length || 1);
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "TURN_STEPPED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: { index: nextIndex }
                } as any);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [state.turnOrder, state.currentTurnIndex, state.characters, userRole, sessionId, actorUserId]);

    // ─── ELIMINATION LOGIC (Death Turn Management) ──────────────────────────
    // - Players / Allied NPCs: skip turn, stay in order
    // - Enemy NPCs: 1st turn after death → skip; 2nd → remove from arena + order

    useEffect(() => {
        if (!currentTurnActorId || !state.turnOrder || state.turnOrder.length === 0) return;
        const currentActor = state.characters[currentTurnActorId];
        if (!currentActor || !isCharacterEliminated(currentActor)) return;

        const isEnemy = currentActor.isNPC && currentActor.arenaSide !== "HERO";

        if (isEnemy) {
            if (deathTurnPassed.has(currentActor.id)) {
                // Second death turn → remove from arena and order
                if (userRole === "GM") {
                    globalEventStore.append({
                        id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_UPDATED",
                        actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                        payload: { characterId: currentActor.id, changes: { activeInArena: false } }
                    } as any);

                    const newOrder = state.turnOrder.filter((id: string) => id !== currentActor.id);
                    globalEventStore.append({
                        id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                        actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                        payload: { characterIds: newOrder }
                    } as any);

                    setDeathTurnPassed(prev => {
                        const next = new Set(prev);
                        next.delete(currentActor.id);
                        return next;
                    });
                }
            } else {
                // First death turn → mark and skip after delay
                if (userRole === "GM") {
                    setDeathTurnPassed(prev => new Set(prev).add(currentActor.id));
                    const timer = setTimeout(() => handleNextTurn(), 2000);
                    return () => clearTimeout(timer);
                }
            }
        } else {
            // Player or allied NPC → just skip
            if (userRole === "GM" || isCurrentPlayerActive) {
                const timer = setTimeout(() => handleNextTurn(), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [currentTurnActorId, state.turnOrder, state.characters, userRole,
        isCurrentPlayerActive, sessionId, actorUserId, deathTurnPassed]);

    // ─── AUTO-END COMBAT ─────────────────────────────────────────────────────

    useEffect(() => {
        if (userRole !== "GM" || !state.turnOrder || state.turnOrder.length === 0) return;

        const hasEnemiesInTurnOrder = state.turnOrder.some((id: string) => {
            const char = state.characters[id];
            return char && char.isNPC && char.arenaSide !== "HERO";
        });

        const hasActiveThreatsInArena = Object.values(state.characters).some((char: any) =>
            (char.isNPC || char.arenaSide === "THREAT") &&
            char.arenaSide !== "HERO" &&
            char.activeInArena === true
        );

        if (!hasEnemiesInTurnOrder || !hasActiveThreatsInArena) {
            if (state.turnOrder.length > 0) {
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "TURN_ORDER_UPDATED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: { characterIds: [] }
                } as any);
            }

            if (!state.challenge?.isActive) {
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0, type: "CHALLENGE_UPDATED",
                    actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                    payload: {
                        isActive: true,
                        text: state.challenge?.text || "Exploração",
                        difficulty: state.challenge?.difficulty || 0,
                        aspects: state.challenge?.aspects || []
                    }
                } as any);
            }
        }
    }, [state.turnOrder, state.characters, userRole, sessionId, actorUserId, state.challenge]);

    // ─── TURN TRANSITION SOUND ───────────────────────────────────────────────

    useEffect(() => {
        if (!state.turnOrder || state.turnOrder.length === 0) {
            prevActorIdRef.current = currentTurnActorId;
            return;
        }
        const actorChanged = prevActorIdRef.current !== currentTurnActorId;
        if (actorChanged && currentTurnActorId && !challengeMode) {
            const transitionSound = state.soundSettings?.portrait || "/audio/Effects/transicao_retrato.MP3";
            const audio = new Audio(transitionSound);
            audio.volume = 0.5;
            audio.play().catch(e => console.warn("Failed to play transition sound:", e));
        }
        prevActorIdRef.current = currentTurnActorId;
    }, [currentTurnActorId, state.turnOrder, state.soundSettings, challengeMode]);

    return {
        consequenceQueue,
        activeConsequence,
        deathTurnPassed,
        setDeathTurnPassed,
        stateRef,
        handleNextTurn,
        handlePreviousTurn,
        handleTogglePause,
        handleForcePass,
        handleConsequenceSave,
        handleConsequenceCancel,
        pendingDamage,
        handleDamageConfirm,
        handleDamageAutoCalculate,
        handleDamageSkip,
    };
}
