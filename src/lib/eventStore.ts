/**
 * @file: src/lib/eventStore.ts
 * @summary: Central hub for Event Sourcing in the client. Handles event dispatching, 
 * real-time synchronization via Supabase, and snapshot persistence.
 * @note: This is a synthesis guide for architectural understanding.
 */
// Teste de commit - Conta Kasaxi ✅
import { ActionEvent, SessionState } from "@/types/domain";
import { supabase } from "./supabaseClient";
import { computeState } from "./projections";
import * as apiClient from "./apiClient";

export class EventStore {
    private events: ActionEvent[] = [];
    private listeners: ((event: ActionEvent) => void)[] = [];
    private bulkListeners: ((events: ActionEvent[]) => void)[] = [];
    private currentSessionId: string | null = null;
    private channel: any = null;
    private snapshotState: SessionState | null = null;
    private snapshotUpToSeq: number = -1;

    async initSession(sessionId: string) {
        if (typeof window !== 'undefined') {
            // console.log(`%c[EventStore] Inicializando Sessão: ${sessionId}`, 'color: #bada55; font-weight: bold');
        }

        if (this.currentSessionId === sessionId) return;

        // Cleanup previous subscription
        if (this.channel) {
            supabase.removeChannel(this.channel);
        }

        this.currentSessionId = sessionId;
        this.events = [];
        this.snapshotState = null;
        this.snapshotUpToSeq = -1;

        // --- Subscribe to realtime BEFORE fetching history ---
        // Buffer events that arrive during the fetch to avoid race condition
        const bufferedRealtimeEvents: ActionEvent[] = [];
        let historicalLoadComplete = false;

        // 1. Subscribe to real-time updates FIRST (buffer until fetch completes)
        this.channel = supabase
            .channel(`session-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'events',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload) => {
                    const newEvent = payload.new as any;
                    const formattedEvent: ActionEvent = {
                        id: newEvent.id,
                        sessionId: newEvent.session_id,
                        seq: newEvent.seq,
                        type: newEvent.type,
                        actorUserId: newEvent.actor_user_id,
                        visibility: newEvent.visibility,
                        createdAt: newEvent.created_at,
                        payload: newEvent.payload
                    };

                    if (!historicalLoadComplete) {
                        // Buffer durante o fetch histórico
                        bufferedRealtimeEvents.push(formattedEvent);
                        return;
                    }

                    // Normal processing after history is loaded
                    const idx = this.events.findIndex(e => e.id === newEvent.id);
                    if (idx === -1) {
                        this.events.push(formattedEvent);
                        this.listeners.forEach(l => l(formattedEvent));
                        this.bulkListeners.forEach(l => l([...this.events]));
                    } else {
                        // Confirmation of our own optimistic event
                        const updatedEvent = {
                            ...this.events[idx],
                            seq: newEvent.seq,
                            createdAt: newEvent.created_at
                        };
                        this.events[idx] = updatedEvent;
                        this.listeners.forEach(l => l(updatedEvent));
                        this.bulkListeners.forEach(l => l([...this.events]));
                    }
                }
            )
            .subscribe((status: string) => {
                console.log(`[EventStore] Realtime channel status: ${status}`);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    // Reconexão automática do canal realtime
                    console.warn('[EventStore] Canal realtime desconectado, tentando reconectar...');
                    setTimeout(() => {
                        if (this.currentSessionId === sessionId) {
                            this.channel = null;
                            this.currentSessionId = null;
                            this.initSession(sessionId);
                        }
                    }, 3000);
                }
            });

        // 2. Load historical events + snapshot via NestJS (replaces direct Supabase fetch)
        let fetchSuccess = false;
        try {
            const result = await apiClient.loadSessionEvents(sessionId);

            if (result.snapshot) {
                this.snapshotState = result.snapshot.state as SessionState;
                this.snapshotUpToSeq = result.snapshot.upToSeq;
                console.info(`[EventStore] Snapshot encontrado: seq ${this.snapshotUpToSeq}`);
            }

            this.events = result.events;
            fetchSuccess = true;
            console.info(`[EventStore] ${result.events.length} eventos delta carregados via NestJS.`);
        } catch (err: any) {
            console.error('[EventStore] Falha crítica no fetch via NestJS:', err);
        }

        // If snapshot exists and no delta events at all, still mark success
        if (!fetchSuccess && this.snapshotState !== null) {
            fetchSuccess = true;
        }

        // 3. Merge buffered realtime events that arrived during fetch
        historicalLoadComplete = true;

        const existingIds = new Set(this.events.map(e => e.id));
        for (const buffered of bufferedRealtimeEvents) {
            if (!existingIds.has(buffered.id)) {
                this.events.push(buffered);
                existingIds.add(buffered.id);
            }
        }

        // Trigger bulk listeners with the complete merged dataset
        this.bulkListeners.forEach(l => l([...this.events]));

        // Auto-save snapshot in background so next load only fetches delta events
        this._updateSnapshot().catch(() => {});
    }

    private appendQueue: Promise<void> = Promise.resolve();

    async append(event: ActionEvent, retryCount = 0) {
        if (retryCount === 0) {
            // 0. Update in-memory state immediately for UI responsiveness
            const optimisticEvent = { ...event };
            optimisticEvent.seq = 0;
            if (!this.events.some(e => e.id === event.id)) {
                this.events.push(optimisticEvent);
                // Notify both single-event and bulk listeners for immediate UI update
                this.listeners.forEach(l => l(optimisticEvent));
                this.bulkListeners.forEach(l => l([...this.events]));
            }
        }

        // 1. Queue the database persistence via NestJS
        this.appendQueue = this.appendQueue.then(async () => {
            try {
                const result = await apiClient.appendEvent(event.sessionId, event);
                // Update the optimistic event with the confirmed seq
                const idx = this.events.findIndex(e => e.id === event.id);
                if (idx !== -1 && result.seq) {
                    this.events[idx].seq = result.seq;
                }
            } catch (err) {
                console.error("[EventStore] Erro crítico no append via NestJS:", err);
                if (typeof window !== 'undefined') {
                    alert(`ERRO AO SALVAR: ${err}`);
                }
            }
        });

        return this.appendQueue;
    }

    getEvents() {
        return [...this.events];
    }

    subscribe(listener: (event: ActionEvent) => void, onBulk?: (events: ActionEvent[]) => void) {
        this.listeners.push(listener);
        if (onBulk) this.bulkListeners.push(onBulk);

        // Return existing events immediately to the new bulk listener if provided
        if (onBulk && this.events.length > 0) {
            onBulk([...this.events]);
        }

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
            if (onBulk) this.bulkListeners = this.bulkListeners.filter(l => l !== onBulk);
        };
    }

    getSnapshotState(): SessionState | null {
        return this.snapshotState;
    }

    private async _updateSnapshot(): Promise<void> {
        if (!this.currentSessionId) return;
        const maxSeq = this.events.reduce((max, e) => Math.max(max, e.seq || 0), 0);
        if (maxSeq <= this.snapshotUpToSeq) return; // Nothing new since last snapshot

        const fullState = computeState(this.events, this.snapshotState ?? undefined);
        try {
            const snapshotStr = JSON.stringify(fullState);
            // Safety check: skip if snapshot is > 1MB to avoid 413 errors
            if (snapshotStr.length > 1024 * 1024) {
                console.warn('[EventStore] Snapshot muito grande (>1MB), pulando salvamento para evitar 413.');
                return;
            }

            await apiClient.updateSnapshot(this.currentSessionId, maxSeq, fullState);
            this.snapshotState = fullState;
            this.snapshotUpToSeq = maxSeq;
            console.info(`[EventStore] Snapshot salvo: seq ${maxSeq}`);
        } catch (err) {
            console.warn('[EventStore] Falha ao salvar snapshot:', err);
        }
    }

    async fetchGlobalBestiary(): Promise<ActionEvent[]> {
        // Cache em sessionStorage para evitar re-fetch no F5
        const CACHE_KEY = 'bestiary_cache_v1';
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
        if (typeof window !== 'undefined') {
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) {
                        return data;
                    }
                }
            } catch { /* ignore parse errors */ }
        }

        const events = await apiClient.fetchGlobalBestiary();

        // Salvar no cache para próximo carregamento
        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: events,
                    timestamp: Date.now()
                }));
            } catch { /* ignore quota errors */ }
        }

        return events;
    }

    async clear() {
        if (!this.currentSessionId) return;

        try {
            await apiClient.clearSessionEvents(this.currentSessionId);
            this.events = [];
            window.location.reload();
        } catch (err) {
            console.error('[EventStore] Erro ao limpar sessão:', err);
        }
    }
}

export const globalEventStore = new EventStore();
