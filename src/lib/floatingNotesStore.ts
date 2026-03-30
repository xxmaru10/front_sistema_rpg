export interface StickyNote {
    id: string;
    text: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    minimized: boolean;
    zIndex: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let notes: StickyNote[] = [];
let isArenaActive = false;
let maxZ = 10000;
let initialized = false;

function notify() {
    listeners.forEach(fn => fn());
}

function saveNotes() {
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem('floating-notes-v1', JSON.stringify(notes));
        } catch {}
    }
}

function loadNotes(): StickyNote[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem('floating-notes-v1');
        if (!saved) return [];
        const parsed: StickyNote[] = JSON.parse(saved);
        const maxSaved = parsed.reduce((m, n) => Math.max(m, n.zIndex || 10000), 10000);
        maxZ = maxSaved + 1;
        return parsed;
    } catch {
        return [];
    }
}

export const floatingNotesStore = {
    init() {
        if (initialized) return;
        initialized = true;
        notes = loadNotes();
    },

    getNotes: () => notes,
    isArena: () => isArenaActive,

    setArena(active: boolean) {
        if (isArenaActive !== active) {
            isArenaActive = active;
            notify();
        }
    },

    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    createNote() {
        maxZ++;
        const offset = notes.length * 24;
        const note: StickyNote = {
            id: crypto.randomUUID(),
            text: '',
            title: 'Nota',
            x: 120 + (offset % 240),
            y: 120 + (offset % 200),
            width: 220,
            height: 190,
            color: '#fef08a',
            minimized: false,
            zIndex: maxZ,
        };
        notes = [...notes, note];
        saveNotes();
        notify();
    },

    updateNote(id: string, updates: Partial<StickyNote>) {
        notes = notes.map(n => n.id === id ? { ...n, ...updates } : n);
        saveNotes();
        notify();
    },

    deleteNote(id: string) {
        notes = notes.filter(n => n.id !== id);
        saveNotes();
        notify();
    },

    hideAll() {
        notes = notes.map(n => ({ ...n, minimized: true }));
        saveNotes();
        notify();
    },

    showAll() {
        notes = notes.map(n => ({ ...n, minimized: false }));
        saveNotes();
        notify();
    },

    bringToFront(id: string) {
        maxZ++;
        notes = notes.map(n => n.id === id ? { ...n, zIndex: maxZ } : n);
        notify();
    },
};
