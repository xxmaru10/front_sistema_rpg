/**
 * @file: src/app/session/[id]/hooks/useSessionDerivations.ts
 * @summary: All useMemo derivations from game state and events.
 * Receives external dependencies as parameters to remain self-contained
 * and portable to a separate Frontend repository.
 *
 * Dependency contract (Option 1 – explicit parameter passing):
 *   - state/events: from useSessionEvents + computeState
 *   - currentTurnActorId, deathFocusCharId, combatStartTimeRef: from useVictoryDefeat / useCombatAutomation
 *   - identity params: actorUserId, fixedCharacterId, userRole
 *   - ui params: logFilter, summonMode, challengeMode
 *   - globalBestiaryChars: from useSessionEvents
 */
"use client";

import { useMemo } from "react";
import { useProjectedState } from "@/lib/projectedStateStore";
import { isCharacterEliminated } from "@/lib/gameLogic";
import { Character, ActionEvent } from "@/types/domain";

interface UseSessionDerivationsParams {
    events: ActionEvent[];
    globalBestiaryChars: Character[];
    actorUserId: string;
    fixedCharacterId: string | undefined;
    userRole: "GM" | "PLAYER";
    activeTab: string;
    logFilter: string;
    summonMode: "HERO" | "THREAT";
    challengeMode: boolean;
    currentTurnActorId: string | null;
    deathFocusCharId: string | null;
    combatStartTimeRef: { current: number | null };
}

export function useSessionDerivations({
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
}: UseSessionDerivationsParams) {

    // Estado projetado compartilhado — substitui computeState local (Prioridade 3 da Story 46).
    const state = useProjectedState();

    // ─── DERIVED CHARACTER LISTS ──────────────────────────────────────────────

    const characterList = useMemo(() => {
        const all = Object.values(state.characters);
        return all.filter(c => c.source !== "bestiary" || c.activeInArena);
    }, [state.characters]);

    const displayedCharacters = useMemo(() => {
        if (userRole === "GM") return characterList;
        if (fixedCharacterId) return characterList.filter(c => c.id === fixedCharacterId);
        return characterList.filter(c => c.ownerUserId === actorUserId);
    }, [characterList, userRole, actorUserId, fixedCharacterId]);

    const bestiaryList = useMemo(() => {
        const localBestiary = Object.values(state.characters).filter(c => c.source === "bestiary");
        const localIds = new Set(localBestiary.map(c => c.id));
        const sessionSystem = state.system ?? "fate";
        const globalNotDuplicated = globalBestiaryChars.filter(c => {
            if (localIds.has(c.id)) return false;
            // Filter by system: treat chars with no system tag as "fate"
            const charSystem = (c as any).system ?? "fate";
            return charSystem === sessionSystem;
        });
        return [...localBestiary, ...globalNotDuplicated];
    }, [state.characters, globalBestiaryChars, state.system]);

    const findBestiaryChar = (id: string | null): Character | null => {
        if (!id) return null;
        if (state.characters[id]) return state.characters[id];
        return globalBestiaryChars.find(c => c.id === id) || null;
    };

    const aspectList = useMemo(() => Object.values(state.aspects), [state.aspects]);

    const mentionEntities = useMemo(() => {
        const results: any[] = [];
        Object.values(state.worldEntities || {}).forEach((e: any) => {
            const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
            const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;
            results.push({ ...e, category: "Mundo", displayType: effectiveType, type: effectiveType });
        });
        Object.values(state.characters || {}).forEach((c: any) => {
            const isNPC = c.isNPC || c.source === "bestiary";
            results.push({
                id: c.id, name: c.name, category: "Personagens",
                displayType: isNPC ? "AMEAÇA" : "PERSONAGEM",
                type: "CHARACTER", color: isNPC ? "#ff4444" : "#2ecc71"
            });
        });
        (state.missions || []).forEach((m: any) =>
            results.push({ id: m.id, name: m.name, category: "Tempo", displayType: "MISSÀO", type: "MISSION", color: "#C5A059" })
        );
        (state.timeline || []).forEach((ev: any) =>
            results.push({ id: ev.id, name: ev.name, category: "Tempo", displayType: "HISTÓRIA", type: "TIMELINE", color: "#4a90e2" })
        );
        (state.skills || []).forEach((s: any) =>
            results.push({ id: s.id, name: s.name, category: "Jogo", displayType: "HABILIDADE", type: "SKILL", color: s.color })
        );
        (state.items || []).forEach((i: any) =>
            results.push({ id: i.id, name: i.name, category: "Jogo", displayType: "ITEM", type: "ITEM", color: "#f8e71c" })
        );
        const allTags = new Set<string>();
        Object.values(state.worldEntities || {}).forEach(e => (e.tags || []).forEach((t: string) => allTags.add(t)));
        allTags.forEach(tag =>
            results.push({ id: `tag-${tag}`, name: tag, category: "TAG", displayType: "TAG", color: "#C5A059", isTag: true })
        );
        return results;
    }, [state.worldEntities, state.missions, state.timeline, state.skills, state.items, bestiaryList, userRole]);

    // ─── COMBAT DERIVED STATE ─────────────────────────────────────────────────

    const activePlayers = useMemo(() =>
        Object.values(state.characters).filter(c => !c.isNPC),
        [state.characters]
    );

    const allPlayersEliminated = useMemo(() => {
        if (activePlayers.length === 0) return false;
        return activePlayers.every(c => isCharacterEliminated(c));
    }, [activePlayers]);

    const activeEnemyCount = useMemo(() =>
        Object.values(state.characters).filter((c: any) =>
            c.isNPC && c.arenaSide !== "HERO" && c.activeInArena && !isCharacterEliminated(c)
        ).length,
        [state.characters]
    );

    const isCurrentPlayerActive = useMemo(() => {
        if (!currentTurnActorId) return false;
        const currentActor = actorUserId?.toLowerCase().trim();
        
        let result = false;
        if (fixedCharacterId && currentTurnActorId === fixedCharacterId) {
            result = true;
        } else if (state.isReaction && state.targetId) {
            const targetChar = state.characters[state.targetId];
            if (targetChar) {
                const targetOwner = targetChar.ownerUserId?.toLowerCase().trim();
                result = (targetOwner === currentActor || (userRole === "GM" && !!targetChar.isNPC));
            }
        } else {
            const turnActor = state.characters[currentTurnActorId];
            if (turnActor) {
                if (userRole === "GM" && turnActor.isNPC) {
                    result = true;
                } else {
                    const owner = turnActor.ownerUserId?.toLowerCase().trim();
                    result = (owner === currentActor);
                }
            }
        }

        return result;
    }, [currentTurnActorId, state.characters, actorUserId, fixedCharacterId, state.isReaction, state.targetId, userRole]);

    // ─── COMBAT LIST MEMOS ────────────────────────────────────────────────────

    const combatantList = useMemo(() => {
        const all = characterList.filter(c => c.activeInArena === true || !c.isNPC);
        let sortedList: Character[] = [];

        if (state.turnOrder && state.turnOrder.length > 0) {
            const sorted: Character[] = [];
            state.turnOrder.forEach((id: string) => {
                const char = all.find(c => c.id === id);
                if (char) sorted.push(char);
            });
            const remaining = all.filter(c => !state.turnOrder!.includes(c.id));
            sortedList = [...sorted, ...remaining];
        } else {
            sortedList = [...all].sort((a, b) => {
                if (a.id === currentTurnActorId) return -1;
                if (b.id === currentTurnActorId) return 1;
                return a.name.localeCompare(b.name);
            });
        }

        return sortedList.sort((a, b) => {
            const aIsMine = a.ownerUserId === actorUserId || fixedCharacterId === a.id;
            const bIsMine = b.ownerUserId === actorUserId || fixedCharacterId === b.id;
            if (aIsMine && !bIsMine) return -1;
            if (!aIsMine && bIsMine) return 1;
            return 0;
        });
    }, [characterList, state.turnOrder, currentTurnActorId, actorUserId, fixedCharacterId]);

    const turnOrderCharacters = useMemo(() => {
        const turnOrder = state.turnOrder || [];
        const allCharsMap = new Map(characterList.map(c => [c.id, c]));
        const sorted: Character[] = [];
        const addedIds = new Set<string>();

        turnOrder.forEach((id: string) => {
            const char = allCharsMap.get(id);
            if (char) { sorted.push(char); addedIds.add(id); }
        });

        characterList.filter(c => c.activeInArena && !addedIds.has(c.id)).forEach(c => {
            sorted.push(c); addedIds.add(c.id);
        });

        if (deathFocusCharId && !addedIds.has(deathFocusCharId)) {
            const char = allCharsMap.get(deathFocusCharId);
            if (char) sorted.push(char);
        }

        if (!challengeMode && sorted.length === 0) {
            return characterList.filter(c => !c.isNPC);
        }
        return sorted;
    }, [state.turnOrder, deathFocusCharId, characterList, challengeMode]);

    const lastReactionAttack = useMemo(() => {
        if (!state.isReaction || !state.targetId) return null;
        for (let i = events.length - 1; i >= 0; i--) {
            const e = events[i];
            if (
                e.type === "ROLL_RESOLVED" &&
                (e.payload.actionType === "ATTACK" || e.payload.actionType === "CREATE_ADVANTAGE") &&
                (e.payload.targetCharacterId === state.targetId ||
                    e.payload.targetCharacterIds?.includes(state.targetId))
            ) return e.payload;
        }
        return null;
    }, [state.isReaction, state.targetId, events]);

    const roleVisibleEvents = useMemo(() => {
        if (userRole === "GM") return events;
        return events.filter((e) => {
            if (e.type !== "ROLL_RESOLVED") return true;
            const payload = e.payload as any;
            const hiddenByOverride = state.rollVisibilityOverrides?.[e.id]?.hiddenForPlayers;
            const hiddenByPayload = !!payload.hiddenForPlayers;
            const hiddenFinal = hiddenByOverride ?? hiddenByPayload;
            return !hiddenFinal;
        });
    }, [events, userRole, state.rollVisibilityOverrides]);

    const filteredEvents = useMemo(() => {
        if (logFilter === "ALL") return roleVisibleEvents;
        return roleVisibleEvents.filter(e => {
            if (logFilter === "ROLLS") return e.type === "ROLL_RESOLVED";
            if (logFilter === "ASPECTS") return e.type.includes("INVOKE");
            if (logFilter === "CHARS") return e.type.includes("CHARACTER") || e.type.includes("FP") || e.type.includes("STRESS");
            return true;
        });
    }, [roleVisibleEvents, logFilter]);

    const eventSessionMap = useMemo(() => {
        const sorted = [...events].sort((a, b) => {
            const sa = a.seq || 0, sb = b.seq || 0;
            if (sa > 0 && sb > 0 && sa !== sb) return sa - sb;
            if (sa > 0 && sb === 0) return -1;
            if (sa === 0 && sb > 0) return 1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        const map: Record<string, number> = {};
        const hasSessionMarkers = sorted.some((event) => event.type === "SESSION_NUMBER_UPDATED");
        // Full history should start from session 1. Delta-only payloads fallback to projected current session.
        let currentSession = hasSessionMarkers ? 1 : (state.sessionNumber ?? 1);
        for (const e of sorted) {
            if (e.type === "SESSION_NUMBER_UPDATED") {
                const next = Number((e.payload as any).number);
                if (Number.isFinite(next) && next >= 1) {
                    currentSession = next;
                }
            }
            map[e.id] = currentSession;
        }
        return map;
    }, [events, state.sessionNumber]);

    const logSessionNumbers = useMemo(() => {
        const nums = new Set(filteredEvents.map(e => eventSessionMap[e.id] ?? 1));
        return Array.from(nums).sort((a, b) => a - b);
    }, [filteredEvents, eventSessionMap]);

    const lastActionTimestamp = useMemo(() => {
        if (combatStartTimeRef.current) {
            const localStart = new Date(combatStartTimeRef.current).getTime();
            const mostRecentEvent = events[events.length - 1];
            if (mostRecentEvent) {
                const eventTime = new Date(mostRecentEvent.createdAt).getTime();
                if (eventTime > localStart) return mostRecentEvent.createdAt;
            }
            return new Date(combatStartTimeRef.current).toISOString();
        }
        if (state.lastTurnChangeTimestamp) return state.lastTurnChangeTimestamp;
        if (events.length === 0) return new Date().toISOString();
        for (let i = events.length - 1; i >= 0; i--) {
            const e = events[i];
            if (["TURN_GRANTED", "TURN_STEPPED", "COMBAT_TARGET_SET", "ROLL_RESOLVED",
                "TIMER_RESUMED", "TURN_ORDER_UPDATED", "CHALLENGE_UPDATED"].includes(e.type)) {
                if (e.type === "CHALLENGE_UPDATED") {
                    if (e.payload.isActive === false) return e.createdAt;
                    continue;
                }
                return e.createdAt;
            }
        }
        return events[0].createdAt;
    }, [events, state.lastTurnChangeTimestamp, combatStartTimeRef.current]);

    const headerImageUrl = useMemo(() => {
        type HeaderImageKey = "characters" | "combat" | "log" | "bestiary" | "notes" | "vi";
        const tabKey = activeTab as HeaderImageKey;
        if (activeTab === "combat" && challengeMode) return state.headerImages?.[tabKey] || "";
        if (deathFocusCharId && state.characters[deathFocusCharId]) {
            return state.characters[deathFocusCharId].imageUrl;
        }
        const tabImage = state.headerImages?.[tabKey];
        if (tabImage) return tabImage;
        if (activeTab === "combat" && currentTurnActorId && state.characters[currentTurnActorId] && !challengeMode) {
            return state.characters[currentTurnActorId].imageUrl;
        }
        return "";
    }, [deathFocusCharId, state.characters, activeTab, state.headerImages, currentTurnActorId, challengeMode]);

    const summonableCharacters = useMemo(() => {
        if (summonMode === "HERO") return characterList.filter(c => c.source !== "bestiary");
        return characterList.filter(c => c.isNPC && c.source !== "bestiary");
    }, [characterList, summonMode]);

    return {
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
    };
}
