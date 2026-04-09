/**
 * @file: src/lib/eventStore.ts
 * @summary: Central hub for Event Sourcing in the client. Handles event dispatching, 
 * real-time synchronization via Supabase, and snapshot persistence.
 * @note: This is a synthesis guide for architectural understanding.
 */
import { ActionEvent, SessionState } from "@/types/domain";
import { computeState } from "./projections";
import * as apiClient from "./apiClient";
import { v4 as uuidv4 } from 'uuid';
import { uploadImage } from "./apiClient";
import { getSocket } from "./socketClient";

export type ConnectionStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING';

export class EventStore {
    private static readonly EVENT_CACHE_PREFIX = "cronos_event_cache_v1";
    private static readonly EVENT_CACHE_MAX_EVENTS = 12000;
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

    private _getCacheKey(sessionId: string): string {
        return `${EventStore.EVENT_CACHE_PREFIX}:${sessionId}`;
    }

    private _compareEvents(a: ActionEvent, b: ActionEvent): number {
        const seqA = a.seq || 0;
        const seqB = b.seq || 0;

        if (seqA !== seqB) {
            if (seqA === 0) return 1;
            if (seqB === 0) return -1;
            return seqA - seqB;
        }

        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
    }

    private _sanitizeCachedEvent(raw: any, sessionId: string): ActionEvent | null {
        if (!raw || typeof raw !== "object") return null;
        if (typeof raw.id !== "string" || !raw.id) return null;
        if (typeof raw.type !== "string" || !raw.type) return null;
        if (typeof raw.actorUserId !== "string") return null;
        if (typeof raw.createdAt !== "string") return null;

        const eventSessionId = typeof raw.sessionId === "string" && raw.sessionId ? raw.sessionId : sessionId;
        if (eventSessionId !== sessionId) return null;

        return {
            id: raw.id,
            sessionId: eventSessionId,
            seq: typeof raw.seq === "number" ? raw.seq : 0,
            type: raw.type,
            actorUserId: raw.actorUserId,
            visibility: raw.visibility ?? "PUBLIC",
            createdAt: raw.createdAt,
            payload: raw.payload ?? {},
        } as ActionEvent;
    }

    private _loadCachedEvents(sessionId: string): ActionEvent[] {
        if (typeof window === "undefined") return [];

        try {
            const raw = localStorage.getItem(this._getCacheKey(sessionId));
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];

            const merged = new Map<string, ActionEvent>();
            for (const item of parsed) {
                const event = this._sanitizeCachedEvent(item, sessionId);
                if (event) merged.set(event.id, event);
            }

            const cached = Array.from(merged.values());
            cached.sort((a, b) => this._compareEvents(a, b));
            return cached;
        } catch (err) {
            console.warn("[EventStore] Falha ao ler cache local de eventos:", err);
            return [];
        }
    }

    private _saveCachedEvents(sessionId: string, events: ActionEvent[]) {
        if (typeof window === "undefined") return;

        const timeline = events
            .filter((event) => event.sessionId === sessionId)
            .slice()
            .sort((a, b) => this._compareEvents(a, b))
            .slice(-EventStore.EVENT_CACHE_MAX_EVENTS);

        const key = this._getCacheKey(sessionId);
        const serialized = JSON.stringify(timeline);

        try {
            localStorage.setItem(key, serialized);
        } catch (err) {
            try {
                const fallback = timeline.slice(-Math.floor(EventStore.EVENT_CACHE_MAX_EVENTS / 2));
                localStorage.setItem(key, JSON.stringify(fallback));
            } catch (finalErr) {
                console.warn("[EventStore] Falha ao persistir cache local de eventos:", finalErr ?? err);
            }
        }
    }

    private _clearCachedEvents(sessionId: string) {
        if (typeof window === "undefined") return;
        try {
            localStorage.removeItem(this._getCacheKey(sessionId));
        } catch (err) {
            console.warn("[EventStore] Falha ao limpar cache local de eventos:", err);
        }
    }

    private _persistCurrentSessionCache() {
        if (!this.currentSessionId) return;
        this._saveCachedEvents(this.currentSessionId, this.events);
    }

    private _eventsAfterSnapshot(events: ActionEvent[]): ActionEvent[] {
        if (!this.snapshotState || this.snapshotUpToSeq < 0) return events;
        return events.filter((event) => {
            const seq = event.seq || 0;
            return seq === 0 || seq > this.snapshotUpToSeq;
        });
    }

    private _isNoteEventType(type: ActionEvent["type"]): boolean {
        return type.includes("NOTE") || type === "ALL_NOTES_DELETED";
    }

    private _getFailureKeys(event: ActionEvent): string[] {
        const keys = new Set<string>();
        keys.add(event.id);

        if (!this._isNoteEventType(event.type)) {
            return Array.from(keys);
        }

        const payload = (event as any).payload || {};
        if (typeof payload.id === "string") keys.add(payload.id);
        if (typeof payload.noteId === "string") keys.add(payload.noteId);
        if (payload.note && typeof payload.note.id === "string") keys.add(payload.note.id);

        return Array.from(keys);
    }

    private _markEventFailed(event: ActionEvent) {
        this._getFailureKeys(event).forEach((key) => this.failedEventIds.add(key));
    }

    private _clearEventFailed(event: ActionEvent) {
        this._getFailureKeys(event).forEach((key) => this.failedEventIds.delete(key));
    }

    private _sort() {
        this.events.sort((a, b) => this._compareEvents(a, b));
    }

    async initSession(sessionId: string, force = false) {
        if (this.currentSessionId === sessionId && !force) return;
        const isSameSessionRefresh = this.currentSessionId === sessionId;
        const cachedEvents = this._loadCachedEvents(sessionId);
        const previousEvents = isSameSessionRefresh ? [...this.events] : [];
        const previousSnapshotState = isSameSessionRefresh ? this.snapshotState : null;
        const previousSnapshotUpToSeq = isSameSessionRefresh ? this.snapshotUpToSeq : -1;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        // Cleanup previous WebSocket listeners
        const socket = getSocket();
        socket.off('new-event');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');

        this.currentSessionId = sessionId;
        if (!isSameSessionRefresh) {
            this.events = cachedEvents;
            this.snapshotState = null;
            this.snapshotUpToSeq = -1;
        }
        this.failedEventIds.clear();
        this._setStatus('CONNECTING');
        console.info(`[EventStore] Inicializando sessão: ${sessionId} (forçado: ${force})`);

        const bufferedRealtimeEvents: ActionEvent[] = [];
        let historicalLoadComplete = false;

        // Connect WebSocket and join session room
        if (!socket.connected) {
            socket.connect();
        }

        socket.on('connect', () => {
            console.log('[EventStore] WebSocket connected, joining session:', sessionId);
            socket.emit('join-session', { sessionId, userId: 'client' });
            this._setStatus('SUBSCRIBED');
        });

        socket.on('disconnect', (reason) => {
            console.warn('[EventStore] WebSocket disconnected:', reason);
            this._setStatus('CLOSED');

            if (reason === 'io server disconnect') {
                // Server disconnected us — reconnect
                socket.connect();
            }
            // All other reasons reconnect automatically via socket.io reconnection
        });

        socket.on('connect_error', (err) => {
            console.error('[EventStore] WebSocket connection error:', err.message);
            this._setStatus('CHANNEL_ERROR');

            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
                if (this.currentSessionId === sessionId) {
                    console.log('[EventStore] Retrying WebSocket connection...');
                    socket.connect();
                }
            }, 3000);
        });

        // If already connected, join immediately
        if (socket.connected) {
            socket.emit('join-session', { sessionId, userId: 'client' });
            this._setStatus('SUBSCRIBED');
        }

        socket.on('new-event', (newEvent: any) => {
            const formattedEvent: ActionEvent = {
                id: newEvent.id,
                sessionId: newEvent.sessionId,
                seq: newEvent.seq,
                type: newEvent.type,
                actorUserId: newEvent.actorUserId,
                visibility: newEvent.visibility,
                createdAt: newEvent.createdAt,
                payload: newEvent.payload,
            };

            if (!historicalLoadComplete) {
                bufferedRealtimeEvents.push(formattedEvent);
                return;
            }

            const idx = this.events.findIndex(e => e.id === newEvent.id);
            if (idx === -1) {
                this.events.push(formattedEvent);
                this._sort();
                this._persistCurrentSessionCache();
                this.listeners.forEach(l => l(formattedEvent));
                this.bulkListeners.forEach(l => l([...this.events]));
            } else {
                const updatedEvent = {
                    ...this.events[idx],
                    seq: newEvent.seq,
                    createdAt: newEvent.createdAt,
                };
                this._clearEventFailed(updatedEvent);
                this.events[idx] = updatedEvent;
                this._sort();
                this._persistCurrentSessionCache();
                this.listeners.forEach(l => l(updatedEvent));
                this.bulkListeners.forEach(l => l([...this.events]));
            }
        });

        // Load historical events via REST
        let fetchSuccess = false;
        try {
            const result = await apiClient.loadSessionEvents(sessionId);
            if (result.snapshot) {
                this.snapshotState = result.snapshot.state as SessionState;
                this.snapshotUpToSeq = result.snapshot.upToSeq;
                console.info(`[EventStore] Snapshot encontrado: seq ${this.snapshotUpToSeq}`);
            } else if (result.events.length > 0) {
                // Full-history mode should not reuse stale snapshot, otherwise replay can duplicate state.
                this.snapshotState = null;
                this.snapshotUpToSeq = -1;
            } else if (isSameSessionRefresh) {
                // Keep previous snapshot when refresh returned empty delta.
                this.snapshotState = previousSnapshotState;
                this.snapshotUpToSeq = previousSnapshotUpToSeq;
            }
            const baseEvents = isSameSessionRefresh ? previousEvents : cachedEvents;
            if (baseEvents.length > 0) {
                // Preserve local timeline and merge fetched events by id.
                const merged = new Map<string, ActionEvent>();
                for (const prev of baseEvents) {
                    merged.set(prev.id, prev);
                }
                for (const incoming of result.events) {
                    merged.set(incoming.id, incoming);
                }
                this.events = Array.from(merged.values());
            } else {
                this.events = result.events;
            }
            fetchSuccess = true;
            console.info(`[EventStore] ${result.events.length} eventos carregados via NestJS.`);
        } catch (err: any) {
            console.error('[EventStore] Falha crítica no fetch via NestJS:', err);
            if (isSameSessionRefresh && previousEvents.length > 0) {
                this.events = previousEvents;
                this.snapshotState = previousSnapshotState;
                this.snapshotUpToSeq = previousSnapshotUpToSeq;
                fetchSuccess = true;
                console.warn('[EventStore] Refresh vazio/erro: mantendo histórico local para evitar sumiço visual.');
            } else if (cachedEvents.length > 0) {
                this.events = cachedEvents;
                fetchSuccess = true;
                console.warn('[EventStore] Fetch falhou: restaurando histórico local persistido.');
            }
        }

        if (!fetchSuccess && this.snapshotState !== null) fetchSuccess = true;

        // Merge buffered WebSocket events
        historicalLoadComplete = true;
        const existingIds = new Set(this.events.map(e => e.id));
        for (const buffered of bufferedRealtimeEvents) {
            if (!existingIds.has(buffered.id)) {
                this.events.push(buffered);
                existingIds.add(buffered.id);
            }
        }

        this._sort();
        this._persistCurrentSessionCache();
        this.bulkListeners.forEach(l => l([...this.events]));
        if (!force) {
            this._updateSnapshot().catch(() => {});
        }
        this._migrateBase64Images().catch((err) => {
            console.error('[EventStore] _migrateBase64Images falhou:', err);
        });
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
                this._persistCurrentSessionCache();
                this.listeners.forEach(l => l(optimisticEvent));
                this.bulkListeners.forEach(l => l([...this.events]));
            }
        }

        this.appendQueue = this.appendQueue.then(async () => {
            try {
                this._clearEventFailed(event);
                const result = await apiClient.appendEvent(event.sessionId, event);
                const idx = this.events.findIndex(e => e.id === event.id);
                if (idx !== -1 && result.seq) {
                    this.events[idx].seq = result.seq;
                    this._clearEventFailed(this.events[idx]);
                    this._sort();
                    this._persistCurrentSessionCache();
                    this.bulkListeners.forEach(l => l([...this.events]));
                }
            } catch (err) {
                console.error("[EventStore] Erro no append via NestJS:", err);
                this._markEventFailed(event);
                this._persistCurrentSessionCache();
                this.bulkListeners.forEach(l => l([...this.events]));

                // Exponential backoff retry para notas (limitado a 3 tentativas)
                const isNoteEvent = this._isNoteEventType(event.type);
                if (isNoteEvent && retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => this.append(event, retryCount + 1), delay);
                }
            }
        });

        return this.appendQueue;
    }

    async retryEvent(eventId: string) {
        const event = this.events.find(e => {
            if (e.id === eventId) return true;
            return this._getFailureKeys(e).includes(eventId);
        });
        if (event && this._getFailureKeys(event).some((key) => this.failedEventIds.has(key))) {
            this._clearEventFailed(event);
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

    getSnapshotUpToSeq(): number {
        return this.snapshotUpToSeq;
    }
    private async _migrateBase64Images(): Promise<void> {
        if (!this.currentSessionId) return;

        const eventsForProjection = this._eventsAfterSnapshot(this.events);
        const state = computeState(eventsForProjection, this.snapshotState ?? undefined);

        // Migrate character images
        const characters = state.characters || {};
        for (const [charId, char] of Object.entries(characters)) {
            const imageUrl = (char as any).imageUrl;
            if (!imageUrl?.startsWith('data:')) continue;

            console.info(`[EventStore] Migrando imagem de personagem: ${(char as any).name || charId}`);
            try {
                const res = await fetch(imageUrl);
                const blob = await res.blob();
                const publicUrl = await uploadImage(blob, 'image/jpeg');

                await this.append({
                    id: uuidv4(),
                    sessionId: this.currentSessionId!,
                    seq: 0,
                    type: 'CHARACTER_IMAGE_UPDATED',
                    actorUserId: 'SYSTEM',
                    createdAt: new Date().toISOString(),
                    visibility: 'PUBLIC',
                    payload: { characterId: charId, imageUrl: publicUrl },
                } as any);

                console.info(`[EventStore] Personagem migrado: ${publicUrl}`);
            } catch (err) {
                console.error(`[EventStore] Falha ao migrar personagem ${charId}:`, err);
            }
        }

        // Migrate header images
        const headerImages = state.headerImages || {};
        for (const [tab, imageUrl] of Object.entries(headerImages)) {
            if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:')) continue;

            console.info(`[EventStore] Migrando header image: tab ${tab}`);
            try {
                const res = await fetch(imageUrl);
                const blob = await res.blob();
                const publicUrl = await uploadImage(blob, 'image/jpeg');

                await this.append({
                    id: uuidv4(),
                    sessionId: this.currentSessionId!,
                    seq: 0,
                    type: 'SESSION_HEADER_UPDATED',
                    actorUserId: 'SYSTEM',
                    createdAt: new Date().toISOString(),
                    visibility: 'PUBLIC',
                    payload: { tab, imageUrl: publicUrl },
                } as any);

                console.info(`[EventStore] Header migrado: ${publicUrl}`);
            } catch (err) {
                console.error(`[EventStore] Falha ao migrar header ${tab}:`, err);
            }
        }
    }

    private async _updateSnapshot(): Promise<void> {
        if (!this.currentSessionId) return;

        const maxSeq = this.events.reduce((max, e) => Math.max(max, e.seq || 0), 0);
        if (maxSeq <= this.snapshotUpToSeq) return;

        const eventsForProjection = this._eventsAfterSnapshot(this.events);
        const fullState = computeState(eventsForProjection, this.snapshotState ?? undefined);
        const snapshotStr = JSON.stringify(fullState);
        const sizeKB = Math.round(snapshotStr.length / 1024);

        console.info(`[EventStore] Salvando snapshot: seq ${maxSeq}, tamanho: ${sizeKB}KB`);

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
            this._clearCachedEvents(this.currentSessionId);
            window.location.reload();
        } catch (err) {
            console.error('[EventStore] Erro ao limpar sessão:', err);
        }
    }
}

export const globalEventStore = new EventStore();
