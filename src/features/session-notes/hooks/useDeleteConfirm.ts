import { useState, useRef, useCallback } from "react";

/**
 * Non-blocking delete confirmation hook.
 * First click marks the item pending (shows ✓ icon for `timeoutMs`).
 * Second click within the timeout fires onConfirm.
 */
export function useDeleteConfirm(timeoutMs = 3000) {
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const pendingRef = useRef<Set<string>>(new Set());
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    const requestDelete = useCallback((id: string, onConfirm: () => void) => {
        if (pendingRef.current.has(id)) {
            clearTimeout(timers.current.get(id));
            timers.current.delete(id);
            pendingRef.current.delete(id);
            setPendingIds(new Set(pendingRef.current));
            onConfirm();
        } else {
            pendingRef.current.add(id);
            setPendingIds(new Set(pendingRef.current));
            const timer = setTimeout(() => {
                pendingRef.current.delete(id);
                setPendingIds(new Set(pendingRef.current));
                timers.current.delete(id);
            }, timeoutMs);
            timers.current.set(id, timer);
        }
    }, [timeoutMs]);

    const isPending = useCallback((id: string) => pendingIds.has(id), [pendingIds]);

    return { requestDelete, isPending };
}
