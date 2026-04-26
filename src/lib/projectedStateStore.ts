/**
 * @file: src/lib/projectedStateStore.ts
 * @summary: Singleton que mantém UMA projeção do SessionState compartilhada por todos
 * os componentes. Substitui as múltiplas chamadas de computeState() espalhadas pelo
 * código (useSessionDerivations, VoiceChatPanel, TextChatPanel, FloatingNotes, page._earlyState).
 *
 * Fluxo:
 *   globalEventStore (bulk) -> recompute() -> currentState -> listeners (React via useSyncExternalStore)
 *
 * Ganho: 5 computeState() por evento -> 1 computeState() por evento.
 */
"use client";

import { useSyncExternalStore } from "react";
import { ActionEvent, SessionState } from "@/types/domain";
import { computeState, initialState } from "./projections";
import { globalEventStore } from "./eventStore";

type Listener = () => void;

function sortEvents(events: ActionEvent[]): ActionEvent[] {
    return [...events].sort((a, b) => {
        const seqA = a.seq || 0;
        const seqB = b.seq || 0;
        if (seqA !== 0 && seqB !== 0 && seqA !== seqB) return seqA - seqB;
        if (seqA === 0 && seqB !== 0) return 1;
        if (seqA !== 0 && seqB === 0) return -1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
}

class ProjectedStateStore {
    private currentState: SessionState = initialState;
    private listeners = new Set<Listener>();
    private bootstrapped = false;
    /** Fallback system id for legacy sessions whose SESSION_CREATED event lacks a system field. */
    private systemHint: string | null = null;

    private recompute = (events: ActionEvent[]) => {
        const sorted = sortEvents(events);
        const snapshot = globalEventStore.getSnapshotState();
        const snapshotUpToSeq = globalEventStore.getSnapshotUpToSeq();
        const projectionEvents =
            snapshot && snapshotUpToSeq >= 0
                ? sorted.filter((e) => (e.seq || 0) === 0 || (e.seq || 0) > snapshotUpToSeq)
                : sorted;
        // Inject the system hint into the base state so the entire replay
        // uses the correct plugin reducer (critical for legacy sessions whose
        // SESSION_CREATED event lacks a system field).
        let baseState = snapshot ?? undefined;
        if (this.systemHint) {
            const seed = baseState ?? initialState;
            if (!seed.system) {
                baseState = { ...seed, system: this.systemHint };
            }
        }
        this.currentState = computeState(projectionEvents, baseState);
        this.listeners.forEach((l) => l());
    };

    /**
     * Seeds the system id from the backend API for sessions that pre-date the
     * `system` field being stored in the SESSION_CREATED event payload.
     * Triggers a full recompute so the entire event replay uses the correct
     * plugin reducer.
     */
    setSystemHint(system: string): void {
        if (!system || this.systemHint === system) return;
        this.systemHint = system;
        // Recompute from scratch with the hint applied to the base state.
        this.recompute(globalEventStore.getEvents());
    }

    /**
     * Clears the system hint when switching between sessions. This prevents a
     * stale hint (e.g. "fate") from being applied to a new session (e.g. "vampire")
     * before that session's events are loaded and produce their own system value.
     */
    clearSystemHint(): void {
        if (!this.systemHint) return;
        this.systemHint = null;
        this.recompute(globalEventStore.getEvents());
    }

    private ensureSubscribed = () => {
        if (this.bootstrapped) return;
        this.bootstrapped = true;
        const initial = globalEventStore.getEvents();
        if (initial.length > 0) {
            this.recompute(initial);
        }
        // Assina APENAS o bulk para evitar recompute duplo:
        // eventStore fires single + bulk por evento; bulk cobre todos os mutations.
        globalEventStore.subscribe(
            () => {},
            (bulkEvents) => this.recompute(bulkEvents),
        );
    };

    subscribe = (listener: Listener): (() => void) => {
        this.ensureSubscribed();
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * Forces a full recompute of the projected state. Useful after a system
     * plugin finishes loading asynchronously, so its reducer can finally run
     * across the existing event log.
     */
    forceRecompute = (): void => {
        this.recompute(globalEventStore.getEvents());
    };

    getState = (): SessionState => {
        this.ensureSubscribed();
        // Apply system hint for legacy sessions that lack system in their events.
        if (!this.currentState.system && this.systemHint) {
            return { ...this.currentState, system: this.systemHint };
        }
        return this.currentState;
    };
}

export const projectedStateStore = new ProjectedStateStore();

/**
 * Hook React: retorna o SessionState projetado globalmente.
 * A referência só muda quando um novo evento chega no globalEventStore.
 */
export function useProjectedState(): SessionState {
    return useSyncExternalStore(
        projectedStateStore.subscribe,
        projectedStateStore.getState,
        projectedStateStore.getState,
    );
}

/**
 * Hook React: retorna apenas `characters` da projeção.
 * Evita re-render em componentes que só dependem de personagens.
 */
export function useProjectedCharacters(): SessionState["characters"] {
    return useSyncExternalStore(
        projectedStateStore.subscribe,
        () => projectedStateStore.getState().characters,
        () => projectedStateStore.getState().characters,
    );
}
