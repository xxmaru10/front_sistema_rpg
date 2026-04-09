import { useState, useEffect, useRef } from "react";
import { globalEventStore, ConnectionStatus } from "@/lib/eventStore";
import { ActionEvent, Character } from "@/types/domain";

export function useSessionEvents(sessionId: string, actorUserId: string) {
    const [events, setEvents] = useState<ActionEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [globalBestiaryChars, setGlobalBestiaryChars] = useState<Character[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(globalEventStore.getConnectionStatus());
    const [failedEventIds, setFailedEventIds] = useState<Set<string>>(new Set());
    const initInFlightRef = useRef<{ sessionId: string; promise: Promise<void> } | null>(null);

    const runInit = (force: boolean) => {
        const current = initInFlightRef.current;
        if (current && current.sessionId === sessionId) {
            return current.promise;
        }

        const promise = globalEventStore
            .initSession(sessionId, force)
            .catch((err) => {
                console.error("[useSessionEvents] initSession failed:", err);
            })
            .finally(() => {
                if (initInFlightRef.current?.promise === promise) {
                    initInFlightRef.current = null;
                }
            });

        initInFlightRef.current = { sessionId, promise };
        return promise;
    };

    useEffect(() => {
        setIsLoading(true);
        const loadingTimeout = setTimeout(() => setIsLoading(false), 20000); // Reduced to 20s for better UX
        runInit(false);

        globalEventStore.fetchGlobalBestiary().then(fetched => {
            const chars: Character[] = fetched.map(e => e.payload as unknown as Character);
            setGlobalBestiaryChars(chars);
        });

        const unsubscribeStatus = globalEventStore.subscribeStatus(setConnectionStatus);

        const unsubscribe = globalEventStore.subscribe(
            (event) => {
                if (event.sessionId === sessionId) {
                    setEvents(prev => {
                        const idx = prev.findIndex(e => e.id === event.id);
                        if (idx !== -1) {
                            if (prev[idx].seq === 0 && (event.seq || 0) !== 0) {
                                const next = [...prev];
                                next[idx] = event;
                                return next;
                            }
                            return prev;
                        }
                        return [...prev, event];
                    });
                }
                setFailedEventIds(globalEventStore.getFailedIds());
            },
            (bulkEvents) => {
                setEvents(bulkEvents);
                setIsLoading(false);
                clearTimeout(loadingTimeout);
                setFailedEventIds(globalEventStore.getFailedIds());
            }
        );

        return () => {
            clearTimeout(loadingTimeout);
            unsubscribe();
            unsubscribeStatus();
        };
    }, [sessionId, actorUserId]);

    const refresh = () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        runInit(true).finally(() => setIsRefreshing(false));
    };

    return { 
        events, 
        setEvents, 
        isLoading, 
        isRefreshing,
        globalBestiaryChars, 
        setGlobalBestiaryChars,
        connectionStatus,
        failedEventIds,
        refresh
    };
}
