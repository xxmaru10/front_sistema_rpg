import { StickyNote } from "@/types/domain";
import { globalEventStore } from "./eventStore";
import { v4 as uuidv4 } from "uuid";

type Listener = () => void;

const listeners = new Set<Listener>();
let currentNotes: StickyNote[] = [];
let currentSessionId = "";
let currentUserId = "";
let maxZ = 10000;
let initialized = false;

function notify() {
    listeners.forEach(fn => fn());
}

export const floatingNotesStore = {
    init(sessionId: string, userId: string) {
        currentSessionId = sessionId;
        currentUserId = userId;
        initialized = true;
    },

    setNotes(notes: StickyNote[]) {
        currentNotes = notes;
        const maxSaved = notes.reduce((m, n) => Math.max(m, n.zIndex || 10000), 10000);
        maxZ = Math.max(maxZ, maxSaved + 1);
        notify();
    },

    getNotes: () => currentNotes,

    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    createNote() {
        if (!initialized) return;
        maxZ++;
        const offset = currentNotes.length * 24;
        const newNote: StickyNote = {
            id: uuidv4(),
            text: '',
            title: 'Nova Nota',
            x: 120 + (offset % 240),
            y: 120 + (offset % 200),
            width: 220,
            height: 190,
            color: '#fef08a',
            minimized: false,
            zIndex: maxZ,
            ownerId: currentUserId,
        };

        globalEventStore.append({
            id: uuidv4(),
            sessionId: currentSessionId,
            seq: 0,
            type: "STICKY_NOTE_CREATED",
            actorUserId: currentUserId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId: currentUserId },
            payload: newNote
        } as any);
    },

    updateNote(id: string, patch: Partial<StickyNote>) {
        if (!initialized) return;
        
        // Optimistic update for fluid UI (specifically for drag/resize)
        if (patch.x !== undefined || patch.y !== undefined || patch.width !== undefined || patch.height !== undefined || patch.zIndex !== undefined) {
             currentNotes = currentNotes.map(n => n.id === id ? { ...n, ...patch } : n);
             notify();
        }

        globalEventStore.append({
            id: uuidv4(),
            sessionId: currentSessionId,
            seq: 0,
            type: "STICKY_NOTE_UPDATED",
            actorUserId: currentUserId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId: currentUserId },
            payload: { id, patch }
        } as any);
    },

    deleteNote(id: string) {
        if (!initialized) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId: currentSessionId,
            seq: 0,
            type: "STICKY_NOTE_DELETED",
            actorUserId: currentUserId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId: currentUserId },
            payload: { id }
        } as any);
    },

    bringToFront(id: string) {
        maxZ++;
        this.updateNote(id, { zIndex: maxZ });
    },
};
