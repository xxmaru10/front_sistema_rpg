import { useState, useRef, useEffect, useMemo } from "react";
import { Note, SessionState, Character, WorldEntity, WorldEntityType, Mission, TimelineEvent, MissionSubTask, GlobalSkill, GlobalItem } from "@/types/domain";

import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";


interface UseSessionNotesProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    globalBestiaryChars?: Character[];
}

export function useSessionNotes({ sessionId, userId, userRole, state, globalBestiaryChars = [] }: UseSessionNotesProps) {
    const notes = state.notes || [];
    const [editorContent, setEditorContent] = useState("");
    const [filterAuthor, setFilterAuthor] = useState("all");
    const [activeTab, setActiveTab] = useState<"Notas" | "Mundo" | "Tempo" | "Jogo">("Notas");

    // Sub-tabs states
    const [subTabMundo, setSubTabMundo] = useState<"Personagens" | "Localizações" | "Mapas" | "Facções" | "Religiões" | "Famílias" | "Criaturas" | "Raças" | "Outros">("Personagens");
    const [subTabTempo, setSubTabTempo] = useState<"Missões" | "Linha do Tempo">("Missões");
    const [subTabJogo, setSubTabJogo] = useState<"Habilidades" | "Itens" | "Jogadores">("Habilidades");
    const [notesSubTab, setNotesSubTab] = useState<"Geral" | "Privado" | "Jogadores" | "Sessão">("Geral");
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [worldSearch, setWorldSearch] = useState("");

    // Bestiary internal states
    const [bestiarySearch, setBestiarySearch] = useState("");
    const [bestiarySessionOnly, setBestiarySessionOnly] = useState(false);
    const [viewingBestiaryCharId, setViewingBestiaryCharId] = useState<string | null>(null);

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // World Entity Creation Modal State
    const [showAddWorldEntity, setShowAddWorldEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState("");
    const [newEntityType, setNewEntityType] = useState<WorldEntityType>("PERSONAGEM");
    const [newEntityColor, setNewEntityColor] = useState("#C5A059");
    const [newEntityTags, setNewEntityTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [newEntityDescription, setNewEntityDescription] = useState("");

    // New relationship fields for Personagem
    const [newEntityFamily, setNewEntityFamily] = useState("");
    const [newEntityRace, setNewEntityRace] = useState("");
    const [newEntityOrigin, setNewEntityOrigin] = useState("");
    const [newEntityCurrentLoc, setNewEntityCurrentLoc] = useState("");
    const [newEntityReligion, setNewEntityReligion] = useState("");

    // New location fields for Localização
    const [newEntityLocationType, setNewEntityLocationType] = useState("");
    const [newEntityLinkedLocation, setNewEntityLinkedLocation] = useState("");
    const [locSearch, setLocSearch] = useState("");
    const [newEntityImageUrl, setNewEntityImageUrl] = useState("");
    const [newEntityProfession, setNewEntityProfession] = useState("");

    // Filtering State
    const [worldFilters, setWorldFilters] = useState<Record<string, string[]>>({});

    // Reset filters on tab change
    useEffect(() => {
        setWorldFilters({});
    }, [subTabMundo]);

    const toggleWorldFilter = (field: string, value: string) => {
        setWorldFilters(prev => {
            const current = prev[field] || [];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [field]: [...current, value] };
            }
        });
    };

    // View expanded entity
    const [viewingEntityId, setViewingEntityId] = useState<string | null>(null);
    const viewingEntity = viewingEntityId ? state.worldEntities?.[viewingEntityId] : null;
    const [importBestiaryId, setImportBestiaryId] = useState("");

    // Mission Creation/Edit State
    const [showAddMission, setShowAddMission] = useState(false);
    const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
    const [newMissionName, setNewMissionName] = useState("");
    const [newMissionDescription, setNewMissionDescription] = useState("");
    const [newMissionSubTasks, setNewMissionSubTasks] = useState<MissionSubTask[]>([]);
    const [newSubTaskInput, setNewSubTaskInput] = useState("");
    const [newMissionDay, setNewMissionDay] = useState<number | undefined>(undefined);
    const [newMissionMonth, setNewMissionMonth] = useState<number | undefined>(undefined);
    const [newMissionYear, setNewMissionYear] = useState<number>(new Date().getFullYear());


    // Timeline Creation/Edit State
    const [showAddTimelineEvent, setShowAddTimelineEvent] = useState(false);
    const [editingTimelineEventId, setEditingTimelineEventId] = useState<string | null>(null);
    const [newTimelineName, setNewTimelineName] = useState("");
    const [newTimelineDescription, setNewTimelineDescription] = useState("");
    const [newTimelineDay, setNewTimelineDay] = useState<number | undefined>(undefined);
    const [newTimelineMonth, setNewTimelineMonth] = useState<number | undefined>(undefined);
    const [newTimelineYear, setNewTimelineYear] = useState<number>(new Date().getFullYear());

    const [timelineSortAsc, setTimelineSortAsc] = useState(false); // false = most recent to oldest

    // Global Skill State
    const [showAddSkill, setShowAddSkill] = useState(false);
    const [newSkillName, setNewSkillName] = useState("");
    const [newSkillDescription, setNewSkillDescription] = useState("");
    const [newSkillRequirement, setNewSkillRequirement] = useState("");
    const [newSkillColor, setNewSkillColor] = useState("#C5A059");

    // Global Item State
    const [showAddItem, setShowAddItem] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [newItemDescription, setNewItemDescription] = useState("");
    const [newItemPrice, setNewItemPrice] = useState(0);
    const [newItemQuantity, setNewItemQuantity] = useState(1);
    const [newItemRequirement, setNewItemRequirement] = useState("");
    const [newItemImageUrl, setNewItemImageUrl] = useState("");

    // Edit states
    const [editingWorldEntityId, setEditingWorldEntityId] = useState<string | null>(null);
    const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);




    const COLOR_PRESETS = [
        "#C5A059", // Dourado
        "#D0021B", // Vermelho
        "#4A90E2", // Azul
        "#7ED321", // Verde
        "#9013FE", // Roxo
        "#F5A623", // Laranja
        "#50E3C2", // Ciano
        "#4A4A4A", // Cinza
        "#8B572A", // Marrom
        "#B00000"  // Sangue
    ];

    const TYPE_LABELS: Record<WorldEntityType, string> = {
        "PERSONAGEM": "PERSONAGEM",
        "LOCALIZACAO": "LOCALIZAÇÃO",
        "MAPA": "MAPA",
        "FACAO": "FACÇÃO",
        "RELIGIAO": "RELIGIÃO",
        "FAMILIA": "FAMÍLIA",
        "BESTIARIO": "CRIATURA",
        "RACA": "RAÇA",
        "OUTROS": "OUTROS"
    };

    const LOCATION_CATEGORIES: Record<string, string[]> = {
        "Geográfico": ["MUNDO", "CONTINENTE", "PAÍS", "REINO", "ESTADO", "FEUDO"],
        "Urbano": ["CIDADE", "VILA", "BAIRRO", "RUA", "FORTALEZA", "ACAMPAMENTO", "PRISÃO", "FÁBRICA", "RUÍNAS"],
        "Natureza": ["FLORESTA", "SELVA", "PANTANO", "TUNDRA", "DESERTO", "MONTANHA", "PENHASCO", "VALE", "VULCÃO", "RIO", "CLAREIRA", "CAVERNA"],
        "Especial": ["MINA", "ESCONDERIJO", "SANTUÁRIO", "EXTRA-DIMENSIONAL", "OUTRO"]
    };

    // Get unique authors for filter
    const authors = useMemo(() => {
        const visibleNotes = notes.filter(n => !n.isPrivate || n.authorId === userId);
        return Array.from(new Set(visibleNotes.map(n => n.authorId))).map(id => {
            const note = visibleNotes.find(n => n.authorId === id);
            return { id, name: note?.authorName || id };
        });
    }, [notes, userId]);

    // Bestiary list (combined from state + global)
    const bestiaryList = useMemo(() => {
        const localBestiary = Object.values(state.characters).filter(c => c.source === "bestiary");
        const localIds = new Set(localBestiary.map(c => c.id));
        const globalNotDuplicated = globalBestiaryChars.filter(c => !localIds.has(c.id));
        return [...localBestiary, ...globalNotDuplicated];
    }, [state.characters, globalBestiaryChars]);

    const worldEntitiesList = Object.values(state.worldEntities || {});
    const familiesList = worldEntitiesList.filter(e => e.type === "FAMILIA");
    const racesList = worldEntitiesList.filter(e => e.type === "RACA");
    const religionsList = worldEntitiesList.filter(e => e.type === "RELIGIAO");
    const locationsList = worldEntitiesList.filter(e => e.type === "LOCALIZACAO");

    const worldEntitiesForCurrentTab = useMemo(() => {
        const tabToType: Record<string, WorldEntityType> = {
            "Personagens": "PERSONAGEM",
            "Localizações": "LOCALIZACAO",
            "Mapas": "MAPA",
            "Facções": "FACAO",
            "Religiões": "RELIGIAO",
            "Famílias": "FAMILIA",
            "Criaturas": "BESTIARIO",
            "Raças": "RACA",
            "Outros": "OUTROS"
        };
        const targetType = tabToType[subTabMundo];

        let baseList = Object.values(state.worldEntities || {}).filter(e => {
            // Determine the "effective type" for filtering
            const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
            const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;

            if (effectiveType !== targetType) return false;

            // Apply Filters
            for (const [field, selectedValues] of Object.entries(worldFilters)) {
                if (!selectedValues || selectedValues.length === 0) continue;

                const val = (e as any)[field];
                if (field === 'tags') {
                    if (!selectedValues.some(sv => (e.tags || []).includes(sv))) return false;
                } else {
                    if (!selectedValues.includes(val)) return false;
                }
            }

            return true;
        });

        if (worldSearch) {
            const query = worldSearch.toLowerCase();
            baseList = baseList.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.tags.some(t => t.toLowerCase().includes(query))
            );
        }

        return baseList;
    }, [state.worldEntities, subTabMundo, worldSearch, userRole, worldFilters]);

    const worldFilterAvailableOptions = useMemo(() => {
        const all = Object.values(state.worldEntities || {});

        const getUsedIds = (type: WorldEntityType, field: string) => {
            const ids = Array.from(new Set(all.filter(e => e.type === type && (e as any)[field]).map((e: any) => (e as any)[field])));
            return ids.map(id => ({ id, name: state.worldEntities?.[id]?.name || id }));
        };

        const getUsedTextValues = (type: WorldEntityType, field: string) => {
            const values = Array.from(new Set(all.filter(e => e.type === type && (e as any)[field]).map((e: any) => (e as any)[field] as string))).sort();
            return values.map(v => ({ id: v, name: v }));
        };

        const getTagsForType = (type: WorldEntityType) => {
            const tags = new Set<string>();
            all.filter(e => e.type === type).forEach(e => e.tags?.forEach(t => tags.add(t)));
            return Array.from(tags).sort().map(t => ({ id: t, name: t }));
        };

        if (subTabMundo === "Personagens") {
            return [
                { field: "raceId", label: "RAÇA", options: getUsedIds("PERSONAGEM", "raceId") },
                { field: "profession", label: "PROFISSÃO", options: getUsedTextValues("PERSONAGEM", "profession") },
                { field: "familyId", label: "FAMÍLIA", options: getUsedIds("PERSONAGEM", "familyId") },
                { field: "originId", label: "ORIGEM", options: getUsedIds("PERSONAGEM", "originId") },
                { field: "religionId", label: "RELIGIÃO", options: getUsedIds("PERSONAGEM", "religionId") },
                { field: "currentLocationId", label: "LOCAL ATUAL", options: getUsedIds("PERSONAGEM", "currentLocationId") },
                { field: "tags", label: "TAGS", options: getTagsForType("PERSONAGEM") }
            ];
        } else if (subTabMundo === "Localizações") {
            const types = Array.from(new Set(all.filter(e => e.type === "LOCALIZACAO" && e.locationType).map(e => e.locationType as string))).sort();
            return [
                { field: "locationType", label: "TIPO", options: types.map(t => ({ id: t, name: t })) },
                { field: "linkedLocationId", label: "LOCAL VINCULADO", options: getUsedIds("LOCALIZACAO", "linkedLocationId") },
                { field: "tags", label: "TAGS", options: getTagsForType("LOCALIZACAO") }
            ];
        } else {
            // General filter by tags for other sub-tabs
            const tabToType: Record<string, WorldEntityType> = {
                "Mapas": "MAPA",
                "Facções": "FACAO",
                "Religiões": "RELIGIAO",
                "Famílias": "FAMILIA",
                "Raças": "RACA",
                "Outros": "OUTROS"
            };
            const type = tabToType[subTabMundo] || "OUTROS";
            return [
                { field: "tags", label: "TAGS", options: getTagsForType(type) }
            ];
        }
    }, [state.worldEntities, subTabMundo]);

    const mentionEntities = useMemo(() => {
        const results: any[] = [];

        // 1. World Entities (Mundo)
        Object.values(state.worldEntities || {}).forEach((e: any) => {
            const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
            const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;
            results.push({ ...e, category: 'Mundo', displayType: effectiveType, type: effectiveType });
        });

        // 2. Personagens da Sessão (Jogadores e NPCs)
        Object.values(state.characters || {}).forEach((c: any) => {
            const isNPC = c.isNPC || c.source === "bestiary";
            const color = isNPC ? '#ff4444' : '#2ecc71';
            const displayType = isNPC ? 'AMEAÇA' : 'PERSONAGEM';
            results.push({ id: c.id, name: c.name, category: 'Personagens', displayType, type: 'CHARACTER', color });
        });

        // 3. Missions (Tempo)
        (state.missions || []).forEach((m: any) => {
            results.push({ id: m.id, name: m.name, category: 'Tempo', displayType: 'MISSÃO', color: '#C5A059' });
        });

        // 4. Timeline Events (Tempo)
        (state.timeline || []).forEach((ev: any) => {
            results.push({ id: ev.id, name: ev.name, category: 'Tempo', displayType: 'HISTÓRIA', color: '#4a90e2' });
        });

        // 5. Skills (Jogo)
        (state.skills || []).forEach((s: any) => {
            results.push({ id: s.id, name: s.name, category: 'Jogo', displayType: 'HABILIDADE', color: s.color });
        });

        // 6. Items (Jogo)
        (state.items || []).forEach((i: any) => {
            results.push({ id: i.id, name: i.name, category: 'Jogo', displayType: 'ITEM', color: '#f8e71c' });
        });

        // Unique Tags
        const allTags = new Set<string>();
        Object.values(state.worldEntities || {}).forEach(e => (e.tags || []).forEach(t => allTags.add(t)));
        allTags.forEach(tag => {
            results.push({ id: `tag-${tag}`, name: tag, category: 'TAG', displayType: 'TAG', color: '#C5A059', isTag: true });
        });

        return results;
    }, [state.worldEntities, state.missions, state.timeline, state.skills, state.items, bestiaryList]);

    const worldSearchSuggestions = useMemo(() => {
        if (!worldSearch || worldSearch.length < 2) return [];
        const query = worldSearch.toLowerCase();
        const results: any[] = [];

        // 1. World Entities (Mundo)
        Object.values(state.worldEntities || {}).forEach((e: any) => {
            if (e.name.toLowerCase().includes(query) || (e.tags && e.tags.some((t: any) => t.toLowerCase().includes(query)))) {
                const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
                const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;
                results.push({ ...e, category: 'Mundo', displayType: effectiveType, type: effectiveType });
            }
        });

        // 2. Criaturas (WorldEntities de tipo BESTIARIO)
        Object.values(state.worldEntities || {}).filter((e: any) => e.type === 'BESTIARIO').forEach((e: any) => {
            if (e.name.toLowerCase().includes(query)) {
                results.push({ id: e.id, name: e.name, category: 'Mundo', displayType: 'CRIATURA', color: e.color || '#ff4444', type: 'BESTIARIO' });
            }
        });

        // 3. Missions (Tempo)
        (state.missions || []).forEach((m: any) => {
            if (m.name.toLowerCase().includes(query) || m.description.toLowerCase().includes(query)) {
                results.push({ id: m.id, name: m.name, category: 'Tempo', displayType: 'MISSÃO', color: '#C5A059' });
            }
        });

        // 4. Timeline Events (Tempo)
        (state.timeline || []).forEach((ev: any) => {
            if (ev.name.toLowerCase().includes(query) || ev.description.toLowerCase().includes(query)) {
                results.push({ id: ev.id, name: ev.name, category: 'Tempo', displayType: 'HISTÓRIA', color: '#4a90e2' });
            }
        });

        // 5. Skills (Jogo)
        (state.skills || []).forEach((s: any) => {
            if (s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query)) {
                results.push({ id: s.id, name: s.name, category: 'Jogo', displayType: 'HABILIDADE', color: s.color });
            }
        });

        // 6. Items (Jogo)
        (state.items || []).forEach((i: any) => {
            if (i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query)) {
                results.push({ id: i.id, name: i.name, category: 'Jogo', displayType: 'ITEM', color: '#f8e71c' });
            }
        });

        return results.slice(0, 10);
    }, [state.worldEntities, state.missions, state.timeline, state.skills, state.items, bestiaryList, worldSearch]);


    // Helper to get consistent color for an author ID
    const getAuthorColor = (id: string, role?: string) => {
        if (role === "GM" || id.toLowerCase().includes("mestre") || id.toLowerCase().includes("gm")) {
            return "#C5A059";
        }
        const colors = ["#4a90e2", "#50e3c2", "#b8e986", "#f8e71c", "#f5a623", "#d0021b", "#bd10e0", "#9013fe"];
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const [locallyHiddenNoteIds, setLocallyHiddenNoteIds] = useState<Set<string>>(new Set());

    const handleClearNotesLocally = (tab: 'Geral' | 'Privado') => {
        const toHide = tab === 'Geral'
            ? notes.filter(n => !n.isPrivate).map(n => n.id)
            : notes.filter(n => n.isPrivate && n.authorId === userId).map(n => n.id);
        setLocallyHiddenNoteIds(prev => new Set([...prev, ...toHide]));
    };

    const filteredNotesByTab = useMemo(() => {
        if (notesSubTab === "Geral") {
            return notes.filter(n => !n.isPrivate && !locallyHiddenNoteIds.has(n.id));
        } else if (notesSubTab === "Sessão") {
            return notes.filter(n => (!n.isPrivate || n.authorId === userId) && !locallyHiddenNoteIds.has(n.id));
        } else {
            return notes.filter(n => n.isPrivate && n.authorId === userId && !locallyHiddenNoteIds.has(n.id));
        }
    }, [notes, notesSubTab, userId, locallyHiddenNoteIds]);

    const filteredNotes = filterAuthor === "all" ? filteredNotesByTab : filteredNotesByTab.filter(n => n.authorId === filterAuthor);

    useEffect(() => {
        if (activeTab === "Notas" && editorRef.current) {
            editorRef.current.focus();
        }
    }, [activeTab]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [filteredNotes, activeTab]);

    const handleFormat = (command: string) => {
        document.execCommand(command, false, undefined);
        if (editorRef.current) editorRef.current.focus();
    };

    const handleSend = () => {
        const content = editorContent.trim();
        if (!content) return;

        if (editingNoteId) {
            // Update note
            const existingNote = notes.find(n => n.id === editingNoteId);
            if (!existingNote) return;

            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "NOTE_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: existingNote.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
                payload: { noteId: editingNoteId, content: editorContent }
            } as any);
            setEditingNoteId(null);
        } else {
            // Add note
            const isPrivate = notesSubTab.toLowerCase() === "privado";
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "NOTE_ADDED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
                payload: {
                    id: uuidv4(),
                    authorId: userId,
                    authorName: userId,
                    content: editorContent,
                    createdAt: new Date().toISOString(),
                    isPrivate,
                    sessionNumber: state.sessionNumber || 1
                }
            } as any);

            // Cross-post to mentioned entities (for all notes, preserving privacy)
            crossPostMentionsToEntities(editorContent, isPrivate);
        }

        // Clear editor
        setEditorContent("");
        if (editorRef.current) {
            editorRef.current.innerHTML = "";
            editorRef.current.focus();
        }
    };

    /**
     * Extracts mention IDs from the HTML content and creates a linked note
     * on each mentioned entity. This makes mentions in general campaign notes
     * automatically appear in the entity's own notes section.
     */
    const crossPostMentionsToEntities = (htmlContent: string, isPrivate: boolean = false) => {
        if (!htmlContent) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');
        const mentionSpans = doc.querySelectorAll('[data-mention-id]');
        const plainContentEl = doc.querySelector('div');
        const cleanText = plainContentEl?.textContent || "";
        const noteHtml = plainContentEl?.innerHTML || htmlContent;

        // Map to keep track of unique targets to avoid duplicates
        const targets = new Map<string, { id: string; type: string }>();

        // 1. Structured Mentions (from the @ selector)
        mentionSpans.forEach(span => {
            const id = span.getAttribute('data-mention-id');
            const type = span.getAttribute('data-mention-type');
            if (id && type) {
                targets.set(id, { id, type });
            }
        });

        // 2. Name-based fallback (Scan for character names in text for redundancy)
        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedContent = normalize(cleanText);
        
        Object.values(state.characters || {}).forEach(char => {
            const normalizedName = normalize(char.name);
            // Match exactly or with @ prefix
            if (normalizedName.length > 2 && (normalizedContent.includes(normalizedName) || normalizedContent.includes(`@${normalizedName}`))) {
                if (!targets.has(char.id)) {
                    targets.set(char.id, { id: char.id, type: 'CHARACTER' });
                }
            }
        });

        // Process all unique targets found
        const seat = state.seats.find(s => s.userId === userId);
        const authorChar = seat?.characterId ? state.characters[seat.characterId] : null;
        const authorName = authorChar?.name || userId;

        const characterTypes = ['CHARACTER', 'AMEAÇA', 'AMEACA', 'NPC', 'INIMIGO'];

        targets.forEach((target) => {
            const { id, type } = target;
            let noteType: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM' | null = null;
            const upperType = type.toUpperCase();

            // Priority: resolve by ID lookup in state to avoid type-string ambiguity
            // (e.g., world entities of type PERSONAGEM vs actual characters)
            if (state.worldEntities?.[id]) {
                noteType = 'WORLD';
            } else if (state.characters?.[id]) {
                noteType = 'CHARACTER';
            } else if ((state.missions || []).some((m: any) => m.id === id)) {
                noteType = 'MISSION';
            } else if ((state.timeline || []).some((e: any) => e.id === id)) {
                noteType = 'TIMELINE';
            } else if ((state.skills || []).some((s: any) => s.id === id)) {
                noteType = 'SKILL';
            } else if ((state.items || []).some((i: any) => i.id === id)) {
                noteType = 'ITEM';
            } else if (characterTypes.includes(upperType)) {
                // Fallback for mentions not yet in state
                noteType = 'CHARACTER';
            } else if (upperType === 'MISSÃO' || upperType === 'MISSAO') {
                noteType = 'MISSION';
            } else if (upperType === 'HISTÓRIA' || upperType === 'TIMELINE' || upperType === 'EVENTO') {
                noteType = 'TIMELINE';
            } else if (upperType === 'HABILIDADE' || upperType === 'SKILL') {
                noteType = 'SKILL';
            } else if (upperType === 'ITEM') {
                noteType = 'ITEM';
            } else {
                noteType = 'WORLD';
            }

            if (noteType) {
                // Prepend attribution if it's a cross-post
                const crossPostContent = `<div class="crosspost-note">📝 [Nota de ${authorName.toUpperCase()}]: ${noteHtml}</div>`;
                handleAddEntityNote(noteType, id, crossPostContent, isPrivate);
            }
        });
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
        if (editorRef.current) {
            editorRef.current.innerHTML = "";
        }
    };


    const handleDelete = (noteId: string) => {
        if (!confirm("Tem certeza que deseja apagar esta nota?")) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "NOTE_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { noteId }
        } as any);
    };

    const handleDeleteAll = () => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "ALL_NOTES_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {}
        } as any);
    };

    const handleCreateWorldEntity = () => {
        if (userRole !== "GM") {
            alert("Apenas o Mestre pode criar ou editar entidades do mundo.");
            return;
        }
        if (!newEntityName.trim()) {
            alert("Por favor, insira um nome.");
            return;
        }

        const newEntity: WorldEntity = {
            id: uuidv4(),
            name: newEntityName,
            type: newEntityType,
            color: newEntityColor,
            tags: newEntityTags,
            description: newEntityDescription,
            createdAt: new Date().toISOString(),
            familyId: newEntityType === "PERSONAGEM" ? (newEntityFamily || undefined) : undefined,
            raceId: newEntityType === "PERSONAGEM" ? (newEntityRace || undefined) : undefined,
            religionId: ["PERSONAGEM", "FACAO", "FAMILIA", "BESTIARIO", "LOCALIZACAO"].includes(newEntityType) ? (newEntityReligion || undefined) : undefined,
            originId: newEntityType === "PERSONAGEM" ? (newEntityOrigin || undefined) : undefined,
            profession: newEntityType === "PERSONAGEM" ? (newEntityProfession || undefined) : undefined,
            currentLocationId: ["PERSONAGEM", "FACAO", "FAMILIA", "BESTIARIO", "OUTROS"].includes(newEntityType) ? (newEntityCurrentLoc || undefined) : undefined,
            locationType: newEntityType === "LOCALIZACAO" ? (newEntityLocationType || undefined) : undefined,
            linkedLocationId: (newEntityType === "LOCALIZACAO" || newEntityType === "MAPA") ? (newEntityLinkedLocation || undefined) : undefined,
            imageUrl: ["MAPA", "FACAO", "FAMILIA", "RACA", "PERSONAGEM", "BESTIARIO", "RELIGIAO", "OUTROS"].includes(newEntityType) ? (newEntityImageUrl || undefined) : undefined,
            fieldVisibility: !editingWorldEntityId ? {
                name: true,
                type: true,
                description: true,
                tags: true,
                image: true,
                color: true,
                family: true,
                race: true,
                origin: true,
                religion: true,
                currentLocation: true,
                location: true,
                location_info: true
            } : undefined
        };

        if (editingWorldEntityId) {
            const currentEntity = state.worldEntities?.[editingWorldEntityId];
            const patch: Partial<WorldEntity> = {};
            
            if (currentEntity) {
                if (newEntityName !== currentEntity.name) patch.name = newEntityName;
                if (newEntityType !== currentEntity.type) patch.type = newEntityType;
                if (newEntityColor !== currentEntity.color) patch.color = newEntityColor;
                if (JSON.stringify(newEntityTags) !== JSON.stringify(currentEntity.tags)) patch.tags = newEntityTags;
                if (newEntityDescription !== currentEntity.description) patch.description = newEntityDescription;
                if (newEntityFamily !== currentEntity.familyId) patch.familyId = newEntityFamily || undefined;
                if (newEntityRace !== currentEntity.raceId) patch.raceId = newEntityRace || undefined;
                if (newEntityReligion !== currentEntity.religionId) patch.religionId = newEntityReligion || undefined;
                if (newEntityOrigin !== currentEntity.originId) patch.originId = newEntityOrigin || undefined;
                if (newEntityProfession !== currentEntity.profession) patch.profession = newEntityProfession || undefined;
                if (newEntityCurrentLoc !== currentEntity.currentLocationId) patch.currentLocationId = newEntityCurrentLoc || undefined;
                if (newEntityLocationType !== currentEntity.locationType) patch.locationType = newEntityLocationType || undefined;
                if (newEntityLinkedLocation !== currentEntity.linkedLocationId) patch.linkedLocationId = newEntityLinkedLocation || undefined;
                if (newEntityImageUrl !== currentEntity.imageUrl) patch.imageUrl = newEntityImageUrl || undefined;
            }

            if (Object.keys(patch).length === 0) {
                handleCancelWorldEntityEdit();
                return;
            }

            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "WORLD_ENTITY_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { entityId: editingWorldEntityId, patch }
            } as any);
        } else {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "WORLD_ENTITY_CREATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: newEntity
            } as any);
        }

        // Reset and close
        handleCancelWorldEntityEdit();
    };

    const handleStartEditWorldEntity = (entityId: string) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        setEditingWorldEntityId(entityId);
        setNewEntityName(entity.name);
        setNewEntityType(entity.type);
        setNewEntityColor(entity.color || "#C5A059");
        setNewEntityTags(entity.tags || []);
        setNewEntityDescription(entity.description || "");
        setNewEntityFamily(entity.familyId || "");
        setNewEntityRace(entity.raceId || "");
        setNewEntityOrigin(entity.originId || "");
        setNewEntityProfession(entity.profession || "");
        setNewEntityReligion(entity.religionId || "");
        setNewEntityCurrentLoc(entity.currentLocationId || "");
        setNewEntityLocationType(entity.locationType || "");
        setNewEntityLinkedLocation(entity.linkedLocationId || "");
        setNewEntityImageUrl(entity.imageUrl || "");

        setShowAddWorldEntity(true);
    };

    const handleCancelWorldEntityEdit = () => {
        setShowAddWorldEntity(false);
        setEditingWorldEntityId(null);
        setNewEntityName("");
        setNewEntityTags([]);
        setTagInput("");
        setNewEntityDescription("");
        setNewEntityFamily("");
        setNewEntityRace("");
        setNewEntityOrigin("");
        setNewEntityProfession("");
        setNewEntityCurrentLoc("");
        setNewEntityLocationType("");
        setNewEntityLinkedLocation("");
        setLocSearch("");
        setNewEntityImageUrl("");
        setNewEntityReligion("");
        setImportBestiaryId("");
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!newEntityTags.includes(tagInput.trim())) {
                setNewEntityTags([...newEntityTags, tagInput.trim()]);
            }
            setTagInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        setNewEntityTags(newEntityTags.filter(t => t !== tagToRemove));
    };

    const handleDeleteWorldEntity = (entityId: string) => {
        if (!confirm("Tem certeza que deseja apagar este elemento?")) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "WORLD_ENTITY_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId }
        } as any);
    };

    const handleUpdateFieldVisibility = (entityId: string, fieldName: string, isHidden: boolean) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        const fieldVisibility = { ...(entity.fieldVisibility || {}) };
        fieldVisibility[fieldName] = isHidden;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "WORLD_ENTITY_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId, patch: { fieldVisibility } }
        } as any);
    };

    const handleAddDescriptionBlock = (entityId: string, content: string) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        const descriptionBlocks = [...(entity.descriptionBlocks || [])];
        descriptionBlocks.push({
            id: uuidv4(),
            content,
            hidden: false
        });

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "WORLD_ENTITY_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId, patch: { descriptionBlocks } }
        } as any);
    };

    const handleUpdateDescriptionBlock = (entityId: string, blockId: string, patch: any) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        const descriptionBlocks = (entity.descriptionBlocks || []).map((b: any) =>
            b.id === blockId ? { ...b, ...patch } : b
        );

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "WORLD_ENTITY_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId, patch: { descriptionBlocks } }
        } as any);
    };

    const handleDeleteDescriptionBlock = (entityId: string, blockId: string) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        const descriptionBlocks = (entity.descriptionBlocks || []).filter((b: any) => b.id !== blockId);

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "WORLD_ENTITY_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId, patch: { descriptionBlocks } }
        } as any);
    };

    const handleToggleAllVisibility = (entityId: string, hideAll: boolean) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        const fields = ['name', 'type', 'description', 'tags', 'image', 'color', 'family', 'race', 'religion', 'origin', 'currentLocation', 'location', 'location_info'];
        const fieldVisibility: Record<string, boolean> = {};
        fields.forEach(f => fieldVisibility[f] = hideAll);

        // Also hide description blocks if hiding all
        const descriptionBlocks = (entity.descriptionBlocks || []).map((b: any) => ({ ...b, hidden: hideAll }));

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "WORLD_ENTITY_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId, patch: { fieldVisibility, descriptionBlocks } }
        } as any);
    };

    // MISSION HANDLERS
    const handleCreateMission = () => {
        if (!newMissionName.trim()) return;

        const mission: Mission = {
            id: uuidv4(),
            name: newMissionName,
            description: newMissionDescription,
            subTasks: newMissionSubTasks,
            completed: false,
            createdAt: new Date().toISOString(),
            day: newMissionDay,
            month: newMissionMonth,
            year: newMissionYear
        };


        if (editingMissionId) {
            handleUpdateMission(editingMissionId, mission);
        } else {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "MISSION_CREATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: mission
            } as any);
        }

        handleCancelMissionEdit();
    };

    const handleStartEditMission = (missionId: string) => {
        const mission = state.missions?.find(m => m.id === missionId);
        if (!mission) return;

        setEditingMissionId(missionId);
        setNewMissionName(mission.name);
        setNewMissionDescription(mission.description || "");
        setNewMissionSubTasks(mission.subTasks || []);
        setNewMissionDay(mission.day);
        setNewMissionMonth(mission.month);
        setNewMissionYear(mission.year || new Date().getFullYear());
        setShowAddMission(true);
    };

    const handleCancelMissionEdit = () => {
        setShowAddMission(false);
        setEditingMissionId(null);
        setNewMissionName("");
        setNewMissionDescription("");
        setNewMissionSubTasks([]);
        setNewMissionDay(undefined);
        setNewMissionMonth(undefined);
        setNewMissionYear(new Date().getFullYear());
    };


    const handleUpdateMission = (missionId: string, patch: Partial<Mission>) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "MISSION_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { missionId, patch }
        } as any);
    };

    const handleDeleteMission = (missionId: string) => {
        if (!confirm("Confirmar exclusão da missão?")) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "MISSION_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { missionId }
        } as any);
    };

    const handleToggleSubTask = (missionId: string, subTaskId: string) => {
        const mission = state.missions?.find(m => m.id === missionId);
        if (!mission) return;
        const newSubTasks = mission.subTasks.map(st => st.id === subTaskId ? { ...st, completed: !st.completed } : st);
        handleUpdateMission(missionId, { subTasks: newSubTasks });
    };

    const handleAddSubTask = (missionId: string, text: string) => {
        const mission = state.missions?.find(m => m.id === missionId);
        if (!mission || !text.trim()) return;
        const newSubTask = { id: uuidv4(), text, completed: false };
        const newSubTasks = [...(mission.subTasks || []), newSubTask];
        handleUpdateMission(missionId, { subTasks: newSubTasks });
    };

    // TIMELINE HANDLERS
    const handleCreateTimelineEvent = () => {
        if (userRole !== "GM") {
            alert("Apenas o Mestre pode criar eventos na linha do tempo.");
            return;
        }
        if (!newTimelineName.trim()) return;

        const event: TimelineEvent = {
            id: uuidv4(),
            name: newTimelineName,
            description: newTimelineDescription,
            day: newTimelineDay,
            month: newTimelineMonth,
            year: newTimelineYear,
            type: "MANUAL",
            createdAt: new Date().toISOString()
        };

        if (editingTimelineEventId) {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "TIMELINE_EVENT_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { eventId: editingTimelineEventId, patch: event }
            } as any);
        } else {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "TIMELINE_EVENT_CREATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: event
            } as any);
        }

        handleCancelTimelineEdit();
    };

    const handleStartEditTimelineEvent = (eventId: string) => {
        const ev = state.timeline?.find(e => e.id === eventId);
        if (!ev) return;

        setEditingTimelineEventId(eventId);
        setNewTimelineName(ev.name);
        setNewTimelineDescription(ev.description || "");
        setNewTimelineDay(ev.day);
        setNewTimelineMonth(ev.month);
        setNewTimelineYear(ev.year || new Date().getFullYear());
        setShowAddTimelineEvent(true);
    };

    const handleCancelTimelineEdit = () => {
        setShowAddTimelineEvent(false);
        setEditingTimelineEventId(null);
        setNewTimelineName("");
        setNewTimelineDescription("");
        setNewTimelineDay(undefined);
        setNewTimelineMonth(undefined);
        setNewTimelineYear(new Date().getFullYear());
    };

    const handleDeleteTimelineEvent = (eventId: string) => {
        if (!confirm("Confirmar exclusão deste evento?")) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "TIMELINE_EVENT_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { eventId }
        } as any);
    };

    // GLOBAL SKILL HANDLERS
    const handleCreateSkill = () => {
        if (userRole !== "GM") {
            alert("Apenas o Mestre pode criar habilidades globais.");
            return;
        }
        if (!newSkillName.trim()) return;
        const skill: GlobalSkill = {
            id: uuidv4(),
            name: newSkillName,
            description: newSkillDescription,
            requirement: newSkillRequirement,
            color: newSkillColor,
            createdAt: new Date().toISOString()
        };
        if (editingSkillId) {
            handleUpdateSkill(editingSkillId, skill);
        } else {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "GLOBAL_SKILL_CREATED",
                actorUserId: userId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: skill
            } as any);
        }
        handleCancelSkillEdit();
    };

    const handleStartEditSkill = (skillId: string) => {
        const skill = state.skills?.find(s => s.id === skillId);
        if (!skill) return;
        setEditingSkillId(skillId);
        setNewSkillName(skill.name);
        setNewSkillDescription(skill.description || "");
        setNewSkillRequirement(skill.requirement || "");
        setNewSkillColor(skill.color || "#C5A059");
        setShowAddSkill(true);
    };

    const handleCancelSkillEdit = () => {
        setShowAddSkill(false);
        setEditingSkillId(null);
        setNewSkillName(""); setNewSkillDescription(""); setNewSkillRequirement("");
    };

    const handleUpdateSkill = (skillId: string, patch: Partial<GlobalSkill>) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "GLOBAL_SKILL_UPDATED",
            actorUserId: userId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { skillId, patch }
        } as any);
    };

    const handleDeleteSkill = (skillId: string) => {
        if (!confirm("Apagar habilidade?")) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "GLOBAL_SKILL_DELETED",
            actorUserId: userId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { skillId }
        } as any);
    };

    // GLOBAL ITEM HANDLERS
    const handleCreateItem = () => {
        if (userRole !== "GM") {
            alert("Apenas o Mestre pode criar itens globais.");
            return;
        }
        if (!newItemName.trim()) return;
        const item: GlobalItem = {
            id: uuidv4(),
            name: newItemName,
            description: newItemDescription,
            price: newItemPrice,
            quantity: newItemQuantity,
            requirement: newItemRequirement,
            imageUrl: newItemImageUrl || undefined,
            createdAt: new Date().toISOString()
        };

        if (editingItemId) {
            handleUpdateItem(editingItemId, item);
        } else {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0, type: "GLOBAL_ITEM_CREATED",
                actorUserId: userId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
                payload: item
            } as any);
        }
        handleCancelItemEdit();
    };

    const handleStartEditItem = (itemId: string) => {
        const item = state.items?.find(i => i.id === itemId);
        if (!item) return;
        setEditingItemId(itemId);
        setNewItemName(item.name);
        setNewItemDescription(item.description || "");
        setNewItemPrice(item.price || 0);
        setNewItemQuantity(item.quantity || 1);
        setNewItemRequirement(item.requirement || "");
        setNewItemImageUrl(item.imageUrl || "");
        setShowAddItem(true);
    };

    const handleCancelItemEdit = () => {
        setShowAddItem(false);
        setEditingItemId(null);
        setNewItemName(""); setNewItemDescription(""); setNewItemPrice(0); setNewItemQuantity(1); setNewItemRequirement("");
        setNewItemImageUrl("");
    };


    const handleUpdateItem = (itemId: string, patch: Partial<GlobalItem>) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "GLOBAL_ITEM_UPDATED",
            actorUserId: userId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { itemId, patch }
        } as any);
    };

    const handleDeleteItem = (itemId: string) => {
        if (!confirm("Apagar item?")) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0, type: "GLOBAL_ITEM_DELETED",
            actorUserId: userId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
            payload: { itemId }
        } as any);
    };

    const handleAddEntityNote = (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, content: string, isPrivate: boolean = false) => {
        if (!content.trim()) return;
 
        // Try to find author name from seat or state
        const seat = state.seats.find(s => s.userId === userId);
        const char = seat?.characterId ? state.characters[seat.characterId] : null;
        const authorName = char?.name || userId;
 
        const note = {
            id: uuidv4(),
            authorId: userId,
            authorName: authorName,
            content: content,
            createdAt: new Date().toISOString(),
            isPrivate: !!isPrivate,
            is_private: !!isPrivate // Redundant for mapping compatibility
        };
 
        const typeMap: any = {
            'WORLD': 'WORLD_ENTITY_NOTE_ADDED',
            'CHARACTER': 'CHARACTER_NOTE_ADDED',
            'MISSION': 'MISSION_NOTE_ADDED',
            'TIMELINE': 'TIMELINE_EVENT_NOTE_ADDED',
            'SKILL': 'GLOBAL_SKILL_NOTE_ADDED',
            'ITEM': 'GLOBAL_ITEM_NOTE_ADDED'
        };
 
        const payloadKeyMap: any = {
            'WORLD': 'entityId',
            'CHARACTER': 'characterId',
            'MISSION': 'missionId',
            'TIMELINE': 'eventId',
            'SKILL': 'skillId',
            'ITEM': 'itemId'
        };
 
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: typeMap[type],
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
            payload: { [payloadKeyMap[type]]: entityId, note }
        } as any);
    };

    const handleDeleteEntityNote = (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, noteId: string) => {
        const typeMap: any = {
            'WORLD': 'WORLD_ENTITY_NOTE_DELETED',
            'CHARACTER': 'CHARACTER_NOTE_DELETED',
            'MISSION': 'MISSION_NOTE_DELETED',
            'TIMELINE': 'TIMELINE_EVENT_NOTE_DELETED',
            'SKILL': 'GLOBAL_SKILL_NOTE_DELETED',
            'ITEM': 'GLOBAL_ITEM_NOTE_DELETED'
        };

        const payloadKeyMap: any = {
            'WORLD': 'entityId',
            'CHARACTER': 'characterId',
            'MISSION': 'missionId',
            'TIMELINE': 'eventId',
            'SKILL': 'skillId',
            'ITEM': 'itemId'
        };

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: typeMap[type],
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { [payloadKeyMap[type]]: entityId, noteId }
        } as any);
    };



    const [connectionStatus, setConnectionStatus] = useState(globalEventStore.getConnectionStatus());
    const [failedEventIds, setFailedEventIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const unsubscribeStatus = globalEventStore.subscribeStatus(setConnectionStatus);
        const unsubscribeEvents = globalEventStore.subscribe(() => {
            setFailedEventIds(globalEventStore.getFailedIds());
        }, () => {
            setFailedEventIds(globalEventStore.getFailedIds());
        });

        return () => {
            unsubscribeStatus();
            unsubscribeEvents();
        };
    }, []);

    const handleRetry = (noteId: string) => {
        // Encontrar o ActionEvent original no store
        const events = globalEventStore.getEvents();
        const event = events.find(e => e.id === noteId || (e.type === 'NOTE_ADDED' && e.payload.id === noteId));
        if (event) {
            globalEventStore.retryEvent(event.id);
        }
    };

    return {
        // State
        connectionStatus,
        failedEventIds,
        editorContent, setEditorContent,
        filterAuthor, setFilterAuthor,
        activeTab, setActiveTab,
        subTabMundo, setSubTabMundo,
        subTabTempo, setSubTabTempo,
        subTabJogo, setSubTabJogo,
        notesSubTab, setNotesSubTab,
        editingNoteId, setEditingNoteId,
        worldSearch, setWorldSearch,
        bestiarySearch, setBestiarySearch,
        bestiarySessionOnly, setBestiarySessionOnly,
        viewingBestiaryCharId, setViewingBestiaryCharId,
        showAddWorldEntity, setShowAddWorldEntity,
        newEntityName, setNewEntityName,
        newEntityType, setNewEntityType,
        newEntityColor, setNewEntityColor,
        newEntityTags, setNewEntityTags,
        tagInput, setTagInput,
        newEntityDescription, setNewEntityDescription,
        newEntityFamily, setNewEntityFamily,
        newEntityRace, setNewEntityRace,
        newEntityOrigin, setNewEntityOrigin,
        newEntityCurrentLoc, setNewEntityCurrentLoc,
        newEntityReligion, setNewEntityReligion,
        newEntityLocationType, setNewEntityLocationType,
        newEntityLinkedLocation, setNewEntityLinkedLocation,
        locSearch, setLocSearch,
        newEntityImageUrl, setNewEntityImageUrl,
        newEntityProfession, setNewEntityProfession,
        worldFilters, toggleWorldFilter, worldFilterAvailableOptions,
        viewingEntityId, setViewingEntityId,
        importBestiaryId, setImportBestiaryId,
        editingWorldEntityId, setEditingWorldEntityId,

        // Mission State
        showAddMission, setShowAddMission,
        editingMissionId, setEditingMissionId,
        newMissionName, setNewMissionName,
        newMissionDescription, setNewMissionDescription,
        newMissionSubTasks, setNewMissionSubTasks,
        newSubTaskInput, setNewSubTaskInput,
        newMissionDay, setNewMissionDay,
        newMissionMonth, setNewMissionMonth,
        newMissionYear, setNewMissionYear,

        // Timeline State
        showAddTimelineEvent, setShowAddTimelineEvent,
        editingTimelineEventId, setEditingTimelineEventId,
        newTimelineName, setNewTimelineName,
        newTimelineDescription, setNewTimelineDescription,
        newTimelineDay, setNewTimelineDay,
        newTimelineMonth, setNewTimelineMonth,
        newTimelineYear, setNewTimelineYear,
        timelineSortAsc, setTimelineSortAsc,

        // Skill State
        showAddSkill, setShowAddSkill,
        newSkillName, setNewSkillName,
        newSkillDescription, setNewSkillDescription,
        newSkillRequirement, setNewSkillRequirement,
        newSkillColor, setNewSkillColor,
        editingSkillId, setEditingSkillId,

        // Item State
        showAddItem, setShowAddItem,
        newItemName, setNewItemName,
        newItemDescription, setNewItemDescription,
        newItemPrice, setNewItemPrice,
        newItemQuantity, setNewItemQuantity,
        newItemRequirement, setNewItemRequirement,
        newItemImageUrl, setNewItemImageUrl,
        editingItemId, setEditingItemId,

        // Derived state
        notes,
        authors,
        bestiaryList,
        familiesList,
        racesList,
        religionsList,
        locationsList,
        worldEntitiesForCurrentTab,
        worldSearchSuggestions,
        mentionEntities,
        filteredNotes,
        viewingEntity,

        // Refs
        editorRef,
        scrollRef,

        // Handlers
        handleFormat,
        handleSend,
        handleDelete,
        handleDeleteAll,
        handleClearNotesLocally,
        handleStartEdit,
        handleCancelEdit,
        handleCreateWorldEntity,
        handleAddTag,
        removeTag,
        handleDeleteWorldEntity,
        handleStartEditWorldEntity,
        handleCancelWorldEntityEdit,
        getAuthorColor,
        handleRetry,

        // Mission Handlers
        handleCreateMission,
        handleUpdateMission,
        handleDeleteMission,
        handleStartEditMission,
        handleCancelMissionEdit,
        handleToggleSubTask,
        handleAddSubTask,

        // Timeline Handlers
        handleCreateTimelineEvent,
        handleDeleteTimelineEvent,
        handleStartEditTimelineEvent,
        handleCancelTimelineEdit,

        // Skill Handlers
        handleCreateSkill, handleUpdateSkill, handleDeleteSkill,
        handleStartEditSkill, handleCancelSkillEdit,
        // Item Handlers
        handleCreateItem, handleUpdateItem, handleDeleteItem,
        handleStartEditItem, handleCancelItemEdit,
        handleAddEntityNote,
        handleDeleteEntityNote,
        handleUpdateFieldVisibility,
        handleAddDescriptionBlock,
        handleUpdateDescriptionBlock,
        handleDeleteDescriptionBlock,
        handleToggleAllVisibility,

        // Constants
        COLOR_PRESETS,
        TYPE_LABELS,
        LOCATION_CATEGORIES
    };
}
