import { useState, useEffect } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { ActionEvent, Character } from "@/types/domain";

export function useSessionEvents(sessionId: string, actorUserId: string) {
    const [events, setEvents] = useState<ActionEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [globalBestiaryChars, setGlobalBestiaryChars] = useState<Character[]>([]);

    useEffect(() => {
        setIsLoading(true);
        const loadingTimeout = setTimeout(() => setIsLoading(false), 60000);
        globalEventStore.initSession(sessionId);

        globalEventStore.fetchGlobalBestiary().then(fetched => {
            const chars: Character[] = fetched.map(e => e.payload as unknown as Character);
            setGlobalBestiaryChars(chars);
        });

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
            },
            (bulkEvents) => {
                setEvents(bulkEvents);
                setIsLoading(false);
                clearTimeout(loadingTimeout);
            }
        );

        return () => {
            clearTimeout(loadingTimeout);
            unsubscribe();
        };
    }, [sessionId, actorUserId]);

    return { events, setEvents, isLoading, globalBestiaryChars, setGlobalBestiaryChars };
}
