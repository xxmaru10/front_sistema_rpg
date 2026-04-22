import { useState, useMemo, useRef, useEffect } from "react";
import { Item, NoteFolder, SessionState } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UseSessionNotesDiaryProps {
    sessionId: string;
    userId: string;
    state: SessionState;
    notesSubTab: string;
    worldFilters: Record<string, string[]>;
    selectedPrivateFolderId: string;
    targetInventoryCharacterId?: string;
    handleAddEntityNote: (
        type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM',
        entityId: string,
        content: string,
        isPrivate?: boolean
    ) => void;
}

const MAX_PRIVATE_FOLDERS = 10;

function normalizeComparable(value?: string): string {
    return (value || "").trim().toLowerCase();
}

export function useSessionNotesDiary({
    sessionId,
    userId: rawUserId,
    state,
    notesSubTab,
    worldFilters,
    selectedPrivateFolderId,
    targetInventoryCharacterId,
    handleAddEntityNote,
}: UseSessionNotesDiaryProps) {
    const userId = rawUserId.trim().toLowerCase();
    const isAuthor = (authorId?: string) => (authorId || "").trim().toLowerCase() === userId;
    const notes = state.notes || [];

    const [editorContent, setEditorContent] = useState("");
    const [filterAuthor, setFilterAuthor] = useState("all");
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [locallyHiddenNoteIds, setLocallyHiddenNoteIds] = useState<Set<string>>(new Set());
    const [connectionStatus, setConnectionStatus] = useState(globalEventStore.getConnectionStatus());
    const [failedEventIds, setFailedEventIds] = useState<Set<string>>(new Set());

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribeStatus = globalEventStore.subscribeStatus(setConnectionStatus);
        const unsubscribeEvents = globalEventStore.subscribe(
            () => setFailedEventIds(globalEventStore.getFailedIds()),
            () => setFailedEventIds(globalEventStore.getFailedIds())
        );
        return () => {
            unsubscribeStatus();
            unsubscribeEvents();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    });

    const privateNoteFolders = useMemo(() => {
        return (state.noteFolders || [])
            .filter(folder => isAuthor(folder.ownerId))
            .slice()
            .sort((a, b) => {
                if (a.order !== b.order) return a.order - b.order;
                return a.createdAt.localeCompare(b.createdAt);
            });
    }, [state.noteFolders, userId]);

    // --- Derived ---
    const authors = useMemo(() => {
        const visibleNotes = notes.filter(n => !n.isPrivate || isAuthor(n.authorId));
        return Array.from(new Set(visibleNotes.map(n => n.authorId)))
            .map(id => {
                const note = visibleNotes.find(n => n.authorId === id);
                return { id, name: note?.authorName || id };
            })
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));
    }, [notes, userId]);

    const filteredNotesByTab = useMemo(() => {
        if (notesSubTab === "Geral") {
            return notes.filter(n => !n.isPrivate && !locallyHiddenNoteIds.has(n.id));
        }
        if (notesSubTab === "Sessão") {
            return notes.filter(n => (!n.isPrivate || isAuthor(n.authorId)) && !locallyHiddenNoteIds.has(n.id));
        }
        return notes.filter(n => n.isPrivate && isAuthor(n.authorId) && !locallyHiddenNoteIds.has(n.id));
    }, [notes, notesSubTab, userId, locallyHiddenNoteIds]);

    const filteredNotes = useMemo(() => {
        let list = filteredNotesByTab;
        if (filterAuthor !== "all") list = list.filter(n => n.authorId === filterAuthor);
        if (worldFilters.authorId && worldFilters.authorId.length > 0) {
            list = list.filter(n => worldFilters.authorId.includes(n.authorId));
        }
        return list;
    }, [filteredNotesByTab, filterAuthor, worldFilters.authorId]);

    const resolveInventoryCharacterId = () => {
        if (targetInventoryCharacterId && state.characters?.[targetInventoryCharacterId]) {
            return targetInventoryCharacterId;
        }

        const seat = state.seats.find((entry) => normalizeComparable(entry.userId) === userId);
        if (seat?.characterId && state.characters?.[seat.characterId]) {
            return seat.characterId;
        }

        return null;
    };

    const findMatchingInventoryItem = (inventory: Item[], globalItem: any) => {
        const globalName = normalizeComparable(globalItem.name);
        const globalDescription = normalizeComparable(globalItem.description);
        const globalBonus = globalItem.bonus || 0;
        const globalImageUrl = globalItem.imageUrl || "";
        const globalSize = globalItem.size || "";

        return inventory.find((item) =>
            normalizeComparable(item.name) === globalName &&
            normalizeComparable(item.description) === globalDescription &&
            (item.bonus || 0) === globalBonus &&
            (item.url || "") === globalImageUrl &&
            (item.size || "") === globalSize
        );
    };

    const syncMentionedItemsToInventory = (targets: Map<string, { id: string; type: string }>, sourceNoteId: string) => {
        const characterId = resolveInventoryCharacterId();
        if (!characterId) return;

        const character = state.characters?.[characterId];
        if (!character) return;

        const inventory = character.inventory || [];

        targets.forEach(({ id }) => {
            const globalItem = (state.items || []).find((item: any) => item.id === id);
            if (!globalItem) return;

            const quantity = Math.max(1, globalItem.quantity || 1);
            const existingItem = findMatchingInventoryItem(inventory, globalItem);

            const inventoryItem: Item = existingItem
                ? {
                    ...existingItem,
                    name: globalItem.name,
                    description: globalItem.description,
                    bonus: globalItem.bonus || 0,
                    size: globalItem.size,
                    quantityCurrent: (existingItem.quantityCurrent ?? existingItem.quantityTotal ?? 0) + quantity,
                    quantityTotal: (existingItem.quantityTotal ?? existingItem.quantityCurrent ?? 0) + quantity,
                    url: globalItem.imageUrl || existingItem.url
                }
                : {
                    id: `mentioned-item:${sourceNoteId}:${globalItem.id}`,
                    name: globalItem.name,
                    description: globalItem.description,
                    bonus: globalItem.bonus || 0,
                    size: globalItem.size,
                    quantityCurrent: quantity,
                    quantityTotal: quantity,
                    url: globalItem.imageUrl
                };

            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "CHARACTER_INVENTORY_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { characterId, item: inventoryItem }
            } as any);
        });
    };

    // --- Handlers ---
    const getAuthorColor = (id: string, role?: string) => {
        if (role === "GM" || id.toLowerCase().includes("mestre") || id.toLowerCase().includes("gm")) {
            return "#C5A059";
        }
        const colors = ["#4a90e2", "#50e3c2", "#b8e986", "#f8e71c", "#f5a623", "#d0021b", "#bd10e0", "#9013fe"];
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const handleClearNotesLocally = (tab: 'Geral' | 'Privado') => {
        const toHide = tab === 'Geral'
            ? notes.filter(n => !n.isPrivate).map(n => n.id)
            : notes
                .filter(n => {
                    if (!n.isPrivate || !isAuthor(n.authorId)) return false;
                    if (selectedPrivateFolderId === "all") return true;
                    return (n.folderId || "") === selectedPrivateFolderId;
                })
                .map(n => n.id);
        setLocallyHiddenNoteIds(prev => new Set([...prev, ...toHide]));
    };

    const handleFormat = (command: string) => {
        document.execCommand(command, false, undefined);
        if (editorRef.current) {
            setEditorContent(editorRef.current.innerHTML);
            editorRef.current.focus();
        }
    };

    const crossPostMentionsToEntities = (htmlContent: string, sourceNoteId: string, isPrivate: boolean = false) => {
        if (!htmlContent) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlContent}</div>`, "text/html");
        const mentionSpans = doc.querySelectorAll("[data-mention-id]");
        const plainContentEl = doc.querySelector("div");
        const cleanText = plainContentEl?.textContent || "";
        const noteHtml = plainContentEl?.innerHTML || htmlContent;

        const targets = new Map<string, { id: string; type: string }>();

        mentionSpans.forEach(span => {
            const id = span.getAttribute("data-mention-id");
            const type = span.getAttribute("data-mention-type");
            if (id && type) targets.set(id, { id, type });
        });

        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedContent = normalize(cleanText);

        Object.values(state.characters || {}).forEach(char => {
            const normalizedName = normalize(char.name);
            if (normalizedName.length > 2 && (normalizedContent.includes(normalizedName) || normalizedContent.includes(`@${normalizedName}`))) {
                if (!targets.has(char.id)) targets.set(char.id, { id: char.id, type: "CHARACTER" });
            }
        });

        const seat = state.seats.find((entry) => normalizeComparable(entry.userId) === userId);
        const authorChar = seat?.characterId ? state.characters[seat.characterId] : null;
        const authorName = authorChar?.name || userId;
        const characterTypes = ["CHARACTER", "AMEAÇA", "AMEACA", "NPC", "INIMIGO"];
        syncMentionedItemsToInventory(targets, sourceNoteId);

        targets.forEach(({ id, type }) => {
            const upperType = type.toUpperCase();
            let noteType: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM' | null = null;

            if (state.worldEntities?.[id]) noteType = "WORLD";
            else if (state.characters?.[id]) noteType = "CHARACTER";
            else if ((state.missions || []).some((mission: any) => mission.id === id)) noteType = "MISSION";
            else if ((state.timeline || []).some((event: any) => event.id === id)) noteType = "TIMELINE";
            else if ((state.skills || []).some((skill: any) => skill.id === id)) noteType = "SKILL";
            else if ((state.items || []).some((item: any) => item.id === id)) noteType = "ITEM";
            else if (characterTypes.includes(upperType)) noteType = "CHARACTER";
            else if (upperType === "MISSÃO" || upperType === "MISSAO") noteType = "MISSION";
            else if (upperType === "HISTÓRIA" || upperType === "TIMELINE" || upperType === "EVENTO") noteType = "TIMELINE";
            else if (upperType === "HABILIDADE" || upperType === "SKILL") noteType = "SKILL";
            else if (upperType === "ITEM") noteType = "ITEM";
            else noteType = "WORLD";

            if (noteType) {
                const crossPostContent = `<div class="crosspost-note">📝 [Nota de ${authorName.toUpperCase()}]: ${noteHtml}</div>`;
                handleAddEntityNote(noteType, id, crossPostContent, isPrivate);
            }
        });
    };

    const handleSend = () => {
        const latestContent = editorRef.current?.innerHTML || editorContent;
        const content = latestContent.trim();
        if (!content) return;

        if (editingNoteId) {
            const existingNote = notes.find(n => n.id === editingNoteId);
            if (!existingNote) return;
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "NOTE_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: existingNote.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
                payload: { noteId: editingNoteId, patch: { content: latestContent } }
            } as any);
            setEditingNoteId(null);
        } else {
            const isPrivate = notesSubTab.toLowerCase() === "privado";
            const hasSelectedFolder = selectedPrivateFolderId !== "all" && privateNoteFolders.some(folder => folder.id === selectedPrivateFolderId);
            const noteId = uuidv4();
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "NOTE_ADDED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
                payload: {
                    id: noteId,
                    authorId: userId,
                    authorName: userId,
                    content: latestContent,
                    createdAt: new Date().toISOString(),
                    isPrivate,
                    sessionNumber: state.sessionNumber || 1,
                    folderId: isPrivate && hasSelectedFolder ? selectedPrivateFolderId : undefined
                }
            } as any);
            crossPostMentionsToEntities(latestContent, noteId, isPrivate);
        }

        setEditorContent("");
        if (editorRef.current) {
            editorRef.current.innerHTML = "";
            editorRef.current.focus();
        }
    };

    const handleStartEdit = (noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        setEditingNoteId(noteId);
        setEditorContent(note.content);
        if (editorRef.current) {
            editorRef.current.innerHTML = note.content;
            editorRef.current.focus();
        }
    };

    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setEditorContent("");
        if (editorRef.current) editorRef.current.innerHTML = "";
    };

    const handleDelete = (noteId: string) => {
        const existingNote = notes.find(n => n.id === noteId);
        if (!existingNote) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "NOTE_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: existingNote.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
            payload: { noteId }
        } as any);
    };

    const handleDeleteAll = () => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "ALL_NOTES_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {}
        } as any);
    };

    const handleCreatePrivateFolder = (name: string, color: string): boolean => {
        const trimmedName = name.trim();
        if (!trimmedName || privateNoteFolders.length >= MAX_PRIVATE_FOLDERS) {
            return false;
        }

        const nextOrder = privateNoteFolders.reduce((max, folder) => Math.max(max, folder.order), 0) + 1;
        const folder: NoteFolder = {
            id: uuidv4(),
            ownerId: userId,
            name: trimmedName,
            color,
            order: nextOrder,
            createdAt: new Date().toISOString()
        };

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "NOTE_FOLDER_CREATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId },
            payload: folder
        } as any);

        return true;
    };

    const handleUpdatePrivateFolder = (folderId: string, patch: Partial<NoteFolder>) => {
        const folder = privateNoteFolders.find(item => item.id === folderId);
        if (!folder) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "NOTE_FOLDER_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId },
            payload: { folderId, patch }
        } as any);
    };

    const handleDeletePrivateFolder = (folderId: string) => {
        const folder = privateNoteFolders.find(item => item.id === folderId);
        if (!folder) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "NOTE_FOLDER_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId },
            payload: { folderId }
        } as any);
    };

    const handleMovePrivateNoteToFolder = (noteId: string, folderId: string | null) => {
        const note = notes.find(item => item.id === noteId);
        if (!note || !note.isPrivate || !isAuthor(note.authorId)) return;

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "NOTE_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: { kind: "PLAYER_ONLY", userId },
            payload: { noteId, patch: { folderId: folderId || undefined } }
        } as any);
    };

    const handleReorderPrivateFolders = (orderedFolderIds: string[]) => {
        orderedFolderIds.forEach((folderId, index) => {
            const folder = privateNoteFolders.find(item => item.id === folderId);
            if (!folder || folder.order === index + 1) return;
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "NOTE_FOLDER_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: { kind: "PLAYER_ONLY", userId },
                payload: { folderId, patch: { order: index + 1 } }
            } as any);
        });
    };

    const handleRetry = (noteId: string) => {
        const events = globalEventStore.getEvents();
        const event = events.find(e => e.id === noteId || (e.type === "NOTE_ADDED" && e.payload.id === noteId));
        if (event) globalEventStore.retryEvent(event.id);
    };

    return {
        // State
        editorContent, setEditorContent,
        filterAuthor, setFilterAuthor,
        editingNoteId, setEditingNoteId,
        locallyHiddenNoteIds,
        connectionStatus,
        failedEventIds,
        // Refs
        editorRef,
        scrollRef,
        // Derived
        notes,
        authors,
        filteredNotes,
        privateNoteFolders,
        // Handlers
        getAuthorColor,
        handleClearNotesLocally,
        handleFormat,
        handleSend,
        handleStartEdit,
        handleCancelEdit,
        handleDelete,
        handleDeleteAll,
        handleCreatePrivateFolder,
        handleUpdatePrivateFolder,
        handleDeletePrivateFolder,
        handleMovePrivateNoteToFolder,
        handleReorderPrivateFolders,
        handleRetry,
    };
}
