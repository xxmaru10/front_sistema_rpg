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

    private recompute = (events: ActionEvent[]) => {
        const sorted = sortEvents(events);
        const snapshot = globalEventStore.getSnapshotState();
        const snapshotUpToSeq = globalEventStore.getSnapshotUpToSeq();
        const projectionEvents =
            snapshot && snapshotUpToSeq >= 0
                ? sorted.filter((e) => (e.seq || 0) === 0 || (e.seq || 0) > snapshotUpToSeq)
                : sorted;
        this.currentState = computeState(projectionEvents, snapshot ?? undefined);
        this.listeners.forEach((l) => l());
    };

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

    getState = (): SessionState => {
        this.ensureSubscribed();
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
