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

export type ConnectionStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING';

export class EventStore {
    private events: ActionEvent[] = [];
    private listeners: ((event: ActionEvent) => void)[] = [];
    private bulkListeners: ((events: ActionEvent[]) => void)[] = [];
    private statusListeners: ((status: ConnectionStatus) => void)[] = [];
    private currentSessionId: string | null = null;
    private channel: any = null;
    private snapshotState: SessionState | null = null;
    private snapshotUpToSeq: number = -1;
    private connectionStatus: ConnectionStatus = 'CLOSED';
    private failedEventIds: Set<string> = new Set();
    private reconnectTimeout: any = null;

    private _sort() {
        this.events.sort((a, b) => {
            // seq 0 represents "optimistic/not yet confirmed"
            const seqA = a.seq || 0;
            const seqB = b.seq || 0;

            if (seqA !== seqB) {
                if (seqA === 0) return 1;
                if (seqB === 0) return -1;
                return seqA - seqB;
            }

            // If both have same seq or both are 0, sort by createdAt
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeA - timeB;
        });
    }

    async initSession(sessionId: string, force = false) {
        if (typeof window !== 'undefined') {
            // console.log(`%c[EventStore] Inicializando Sessão: ${sessionId}`, 'color: #bada55; font-weight: bold');
        }

        if (this.currentSessionId === sessionId && !force) return;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Cleanup previous subscription
        if (this.channel) {
            await supabase.removeChannel(this.channel);
        }

        this.currentSessionId = sessionId;
        this.events = [];
        this.snapshotState = null;
        this.snapshotUpToSeq = -1;
        this.failedEventIds.clear();
        this._setStatus('CONNECTING');
        console.info(`[EventStore] Inicializando sessão: ${sessionId} (forçado: ${force})`);

        // --- Subscribe to realtime BEFORE fetching history ---
        const bufferedRealtimeEvents: ActionEvent[] = [];
        let historicalLoadComplete = false;

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
                (payload: any) => {
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
                        bufferedRealtimeEvents.push(formattedEvent);
                        return;
                    }

                    const idx = this.events.findIndex(e => e.id === newEvent.id);
                    if (idx === -1) {
                        this.events.push(formattedEvent);
                        this._sort();
                        this.listeners.forEach(l => l(formattedEvent));
                        this.bulkListeners.forEach(l => l([...this.events]));
                    } else {
                        // Confirmação do evento (limpa falha se houver)
                        this.failedEventIds.delete(newEvent.id);
                        const updatedEvent = {
                            ...this.events[idx],
                            seq: newEvent.seq,
                            createdAt: newEvent.created_at
                        };
                        this.events[idx] = updatedEvent;
                        this._sort();
                        this.listeners.forEach(l => l(updatedEvent));
                        this.bulkListeners.forEach(l => l([...this.events]));
                    }
                }
            )
            .subscribe((status: string) => {
                console.log(`[EventStore] Realtime channel status: ${status}`);
                this._setStatus(status as ConnectionStatus);

                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[EventStore] Canal realtime desconectado, tentando reconectar...');
                    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

                    this.reconnectTimeout = setTimeout(() => {
                        if (this.currentSessionId === sessionId) {
                            this.channel = null;
                            this.currentSessionId = null;
                            this.initSession(sessionId);
                        }
                    }, 3000);
                }
            });

        // 2. Load historical events
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

        if (!fetchSuccess && this.snapshotState !== null) {
            fetchSuccess = true;
        }

        // 3. Merge buffered updates
        historicalLoadComplete = true;
        const existingIds = new Set(this.events.map(e => e.id));
        for (const buffered of bufferedRealtimeEvents) {
            if (!existingIds.has(buffered.id)) {
                this.events.push(buffered);
                existingIds.add(buffered.id);
            }
        }

        this._sort();
        this.bulkListeners.forEach(l => l([...this.events]));
        this._updateSnapshot().catch(() => { });
    }

    private _setStatus(status: ConnectionStatus) {
        this.connectionStatus = status;
        this.statusListeners.forEach(l => l(status));
    }

    private appendQueue: Promise<void> = Promise.resolve();

    async append(event: ActionEvent, retryCount = 0) {
        if (retryCount === 0) {
            const optimisticEvent = { ...event };
            optimisticEvent.seq = 0;
            if (!this.events.some(e => e.id === event.id)) {
                this.events.push(optimisticEvent);
                this._sort();
                this.listeners.forEach(l => l(optimisticEvent));
                this.bulkListeners.forEach(l => l([...this.events]));
            }
        }

        this.appendQueue = this.appendQueue.then(async () => {
            try {
                this.failedEventIds.delete(event.id);
                const result = await apiClient.appendEvent(event.sessionId, event);
                const idx = this.events.findIndex(e => e.id === event.id);
                if (idx !== -1 && result.seq) {
                    this.events[idx].seq = result.seq;
                    this._sort();
                    this.bulkListeners.forEach(l => l([...this.events]));
                }
            } catch (err) {
                console.error("[EventStore] Erro no append via NestJS:", err);
                this.failedEventIds.add(event.id);
                this.bulkListeners.forEach(l => l([...this.events]));

                // Exponential backoff retry para notas (limitado a 3 tentativas)
                const isNoteEvent = ['NOTE_ADDED', 'STICKY_NOTE_CREATED', 'STICKY_NOTE_UPDATED', 'STICKY_NOTE_DELETED'].includes(event.type);
                if (isNoteEvent && retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => this.append(event, retryCount + 1), delay);
                }
            }
        });

        return this.appendQueue;
    }

    async retryEvent(eventId: string) {
        const event = this.events.find(e => e.id === eventId);
        if (event && this.failedEventIds.has(eventId)) {
            this.failedEventIds.delete(eventId);
            return this.append(event, 0);
        }
    }

    getEvents() {
        return [...this.events];
    }

    getFailedIds() {
        return new Set(this.failedEventIds);
    }

    getConnectionStatus() {
        return this.connectionStatus;
    }

    subscribe(listener: (event: ActionEvent) => void, onBulk?: (events: ActionEvent[]) => void) {
        this.listeners.push(listener);
        if (onBulk) this.bulkListeners.push(onBulk);

        if (onBulk && this.events.length > 0) {
            onBulk([...this.events]);
        }

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
            if (onBulk) this.bulkListeners = this.bulkListeners.filter(l => l !== onBulk);
        };
    }

    subscribeStatus(listener: (status: ConnectionStatus) => void) {
        this.statusListeners.push(listener);
        listener(this.connectionStatus);
        return () => {
            this.statusListeners = this.statusListeners.filter(l => l !== listener);
        };
    }

    getSnapshotState(): SessionState | null {
        return this.snapshotState;
    }

    private async _updateSnapshot(): Promise<void> {
        if (!this.currentSessionId) return;

        const maxSeq = this.events.reduce((max, e) => Math.max(max, e.seq || 0), 0);
        if (maxSeq <= this.snapshotUpToSeq) return;

        const fullState = computeState(this.events, this.snapshotState ?? undefined);

        // Breakdown log
        const breakdown: Record<string, number> = {};
        for (const [k, v] of Object.entries(fullState)) {
            breakdown[k] = Math.round(JSON.stringify(v).length / 1024);
        }
        const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
        console.table(sorted.map(([k, v]) => ({ key: k, sizeKB: v })));

        // Character breakdown
        if (fullState.characters) {
            for (const [id, char] of Object.entries(fullState.characters as any)) {
                const charSize = Math.round(JSON.stringify(char).length / 1024);
                if (charSize > 10) {
                    console.log(`Character ${(char as any).name || id}: ${charSize}KB`);
                    const charFields: Record<string, number> = {};
                    for (const [k, v] of Object.entries(char as any)) {
                        charFields[k] = Math.round(JSON.stringify(v).length / 1024);
                    }
                    console.table(Object.entries(charFields).sort((a, b) => b[1] - a[1]).slice(0, 10));
                }
            }
        }

        const snapshotStr = JSON.stringify(fullState);
        const sizeKB = Math.round(snapshotStr.length / 1024);
        console.info(`[EventStore] Total snapshot: ${sizeKB}KB, seq ${maxSeq}`);

        try {
            await apiClient.updateSnapshot(this.currentSessionId, maxSeq, fullState);
            this.snapshotState = fullState;
            this.snapshotUpToSeq = maxSeq;
            console.info(`[EventStore] Snapshot salvo: seq ${maxSeq} (${sizeKB}KB)`);
        } catch (err) {
            console.error('[EventStore] Falha ao salvar snapshot:', err);
        }
    }

    async fetchGlobalBestiary(): Promise<ActionEvent[]> {
        const CACHE_KEY = 'bestiary_cache_v1';
        const CACHE_TTL = 5 * 60 * 1000;
        if (typeof window !== 'undefined') {
            try {
                const cached = sessionStorage.getItem(CACHE_KEY);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) return data;
                }
            } catch { }
        }

        const events = await apiClient.fetchGlobalBestiary();

        if (typeof window !== 'undefined') {
            try {
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: events, timestamp: Date.now() }));
            } catch { }
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
