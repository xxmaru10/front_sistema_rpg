import { useState, useMemo, useEffect } from "react";
import { SessionState, Character } from "@/types/domain";
import { v4 as uuidv4 } from "uuid";

import { useWorldEntities } from "./useWorldEntities";
import { useSessionMissions } from "./useSessionMissions";
import { useSessionSkillsItems } from "./useSessionSkillsItems";
import { useSessionNotesDiary } from "./useSessionNotesDiary";

interface UseSessionNotesProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    globalBestiaryChars?: Character[];
}

export function useSessionNotes({ sessionId, userId, userRole, state, globalBestiaryChars = [] }: UseSessionNotesProps) {
    // --- Navigation state ---
    const [activeTab, setActiveTab] = useState<"Notas" | "Mundo" | "Tempo" | "Jogo">("Notas");
    const [subTabMundo, setSubTabMundo] = useState<"Personagens" | "Localizações" | "Mapas" | "Facções" | "Religiões" | "Famílias" | "Criaturas" | "Raças" | "Outros">("Personagens");
    const [subTabTempo, setSubTabTempo] = useState<"Missões" | "Linha do Tempo">("Missões");
    const [subTabJogo, setSubTabJogo] = useState<"Habilidades" | "Itens" | "Jogadores">("Habilidades");
    const [notesSubTab, setNotesSubTab] = useState<"Geral" | "Privado" | "Jogadores" | "Sessão">("Geral");
    const [selectedPrivateFolderId, setSelectedPrivateFolderId] = useState<string>("all");
    const [selectedPlayerNotesView, setSelectedPlayerNotesView] = useState<string>("all");
    const [worldSearch, setWorldSearch] = useState("");
    const [bestiarySearch, setBestiarySearch] = useState("");
    const [bestiarySessionOnly, setBestiarySessionOnly] = useState(false);
    const [viewingBestiaryCharId, setViewingBestiaryCharId] = useState<string | null>(null);

    // --- Shared filters (cross-cutting: used by world entities, notes, skills, items) ---
    const [worldFilters, setWorldFilters] = useState<Record<string, string[]>>({});

    useEffect(() => {
        setWorldFilters({});
    }, [subTabMundo, activeTab]);

    const toggleWorldFilter = (field: string, value: string) => {
        setWorldFilters(prev => {
            const current = prev[field] || [];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter(v => v !== value) };
            }
            return { ...prev, [field]: [...current, value] };
        });
    };

    // --- Bestiary list ---
    const bestiaryList = useMemo(() => {
        const localBestiary = Object.values(state.characters).filter(c => c.source === "bestiary");
        const localIds = new Set(localBestiary.map(c => c.id));
        const globalNotDuplicated = globalBestiaryChars.filter(c => !localIds.has(c.id));
        return [...localBestiary, ...globalNotDuplicated].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })
        );
    }, [state.characters, globalBestiaryChars]);

    // --- Sub-hooks ---
    const worldEntities = useWorldEntities({
        sessionId, userId, userRole, state,
        subTabMundo, worldSearch, worldFilters,
    });

    const missions = useSessionMissions({
        sessionId, userId, userRole, state, worldFilters,
    });

    const skillsItems = useSessionSkillsItems({
        sessionId, userId, userRole, state, worldFilters,
    });

    const diary = useSessionNotesDiary({
        sessionId, userId, state,
        notesSubTab, worldFilters,
        selectedPrivateFolderId,
        handleAddEntityNote: worldEntities.handleAddEntityNote,
    });

    useEffect(() => {
        if (selectedPrivateFolderId === "all") return;
        const exists = diary.privateNoteFolders.some(folder => folder.id === selectedPrivateFolderId);
        if (!exists) {
            setSelectedPrivateFolderId("all");
        }
    }, [selectedPrivateFolderId, diary.privateNoteFolders]);

    useEffect(() => {
        if (selectedPlayerNotesView === "all") return;
        const exists = Object.values(state.characters || {}).some(char => char.id === selectedPlayerNotesView && !char.isNPC && char.source !== "bestiary");
        if (!exists) {
            setSelectedPlayerNotesView("all");
        }
    }, [selectedPlayerNotesView, state.characters]);

    // --- Cross-hook derived state ---
    const mentionEntities = useMemo(() => {
        const results: any[] = [];

        Object.values(state.worldEntities || {}).forEach((e: any) => {
            const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
            const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;
            results.push({ ...e, category: 'Mundo', displayType: effectiveType, type: effectiveType });
        });

        Object.values(state.characters || {}).forEach((c: any) => {
            const isNPC = c.isNPC || c.source === "bestiary";
            results.push({
                id: c.id, name: c.name, category: 'Personagens',
                displayType: isNPC ? 'AMEAÇA' : 'PERSONAGEM',
                type: 'CHARACTER',
                color: isNPC ? '#ff4444' : '#2ecc71'
            });
        });

        (state.missions || []).forEach((m: any) =>
            results.push({ id: m.id, name: m.name, category: 'Tempo', displayType: 'MISSÃO', type: 'MISSION', color: '#C5A059' })
        );
        (state.timeline || []).forEach((ev: any) =>
            results.push({ id: ev.id, name: ev.name, category: 'Tempo', displayType: 'HISTÓRIA', type: 'TIMELINE', color: '#4a90e2' })
        );
        (state.skills || []).forEach((s: any) =>
            results.push({ id: s.id, name: s.name, category: 'Jogo', displayType: 'HABILIDADE', type: 'SKILL', color: s.color })
        );
        (state.items || []).forEach((i: any) =>
            results.push({ id: i.id, name: i.name, category: 'Jogo', displayType: 'ITEM', type: 'ITEM', color: '#f8e71c' })
        );

        const allTags = new Set<string>();
        Object.values(state.worldEntities || {}).forEach(e => (e.tags || []).forEach(t => allTags.add(t)));
        allTags.forEach(tag =>
            results.push({ id: `tag-${tag}`, name: tag, category: 'TAG', displayType: 'TAG', color: '#C5A059', isTag: true })
        );

        return results;
    }, [state.worldEntities, state.missions, state.timeline, state.skills, state.items, bestiaryList, userRole]);

    const worldSearchSuggestions = useMemo(() => {
        if (!worldSearch || worldSearch.length < 2) return [];
        const query = worldSearch.trim().toLowerCase();
        const results: any[] = [];

        Object.values(state.worldEntities || {}).forEach((e: any) => {
            if (e.name.toLowerCase().includes(query) || (e.tags && e.tags.some((t: any) => t.toLowerCase().includes(query)))) {
                const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
                const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;
                results.push({ ...e, category: 'Mundo', displayType: effectiveType, type: effectiveType });
            }
        });
        (state.missions || []).forEach((m: any) => {
            if (m.name.toLowerCase().includes(query) || m.description.toLowerCase().includes(query))
                results.push({ id: m.id, name: m.name, category: 'Tempo', displayType: 'MISSÃO', color: '#C5A059' });
        });
        (state.timeline || []).forEach((ev: any) => {
            if (ev.name.toLowerCase().includes(query) || ev.description.toLowerCase().includes(query))
                results.push({ id: ev.id, name: ev.name, category: 'Tempo', displayType: 'HISTÓRIA', color: '#4a90e2' });
        });
        (state.skills || []).forEach((s: any) => {
            if (s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query))
                results.push({ id: s.id, name: s.name, category: 'Jogo', displayType: 'HABILIDADE', color: s.color });
        });
        (state.items || []).forEach((i: any) => {
            if (i.name.toLowerCase().includes(query) || i.description.toLowerCase().includes(query))
                results.push({ id: i.id, name: i.name, category: 'Jogo', displayType: 'ITEM', color: '#f8e71c' });
        });

        return results.slice(0, 10);
    }, [state.worldEntities, state.missions, state.timeline, state.skills, state.items, worldSearch, userRole]);

    const worldFilterAvailableOptions = useMemo(() => {
        const all = Object.values(state.worldEntities || {});

        const getUsedIds = (type: string, field: string) => {
            const ids = Array.from(new Set(all.filter(e => e.type === type && (e as any)[field]).map((e: any) => (e as any)[field])));
            return ids
                .map(id => ({ id, name: state.worldEntities?.[id]?.name || id }))
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
        };
        const getUsedTextValues = (type: string, field: string) => {
            const values = Array.from(new Set(all.filter(e => e.type === type && (e as any)[field]).map((e: any) => (e as any)[field] as string))).sort();
            return values.map(v => ({ id: v, name: v }));
        };
        const getTagsForType = (type: string) => {
            const tags = new Set<string>();
            all.filter(e => e.type === type).forEach(e => e.tags?.forEach(t => tags.add(t)));
            return Array.from(tags).sort().map(t => ({ id: t, name: t }));
        };

        if (activeTab === "Notas") {
            return [{ field: "authorId", label: "AUTOR", options: diary.authors.map(a => ({ id: a.id, name: a.name.toUpperCase() })) }];
        }
        if (activeTab === "Tempo") {
            return [{ field: "displayType", label: "TIPO", options: [{ id: "MISSÃO", name: "MISSÕES" }, { id: "HISTÓRIA", name: "LINHA DO TEMPO" }] }];
        }
        if (activeTab === "Jogo") {
            return [{ field: "displayType", label: "TIPO", options: [{ id: "HABILIDADE", name: "HABILIDADES" }, { id: "ITEM", name: "ITENS" }] }];
        }
        if (subTabMundo === "Personagens") {
            return [
                { field: "raceId", label: "RAÇA", options: getUsedIds("PERSONAGEM", "raceId") },
                { field: "profession", label: "PROFISSÃO", options: getUsedTextValues("PERSONAGEM", "profession") },
                { field: "familyId", label: "FAMÍLIA", options: getUsedIds("PERSONAGEM", "familyId") },
                { field: "factionId", label: "FACÇÃO", options: getUsedIds("PERSONAGEM", "factionId") },
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
            const tabToType: Record<string, string> = {
                "Mapas": "MAPA", "Facções": "FACAO", "Religiões": "RELIGIAO",
                "Famílias": "FAMILIA", "Raças": "RACA", "Outros": "OUTROS"
            };
            const type = tabToType[subTabMundo] || "OUTROS";
            return [{ field: "tags", label: "TAGS", options: getTagsForType(type) }];
        }
    }, [state.worldEntities, subTabMundo, activeTab, diary.authors]);

    // --- Flat re-export (preserves backward-compatible API surface) ---
    return {
        // Navigation
        activeTab, setActiveTab,
        subTabMundo, setSubTabMundo,
        subTabTempo, setSubTabTempo,
        subTabJogo, setSubTabJogo,
        notesSubTab, setNotesSubTab,
        selectedPrivateFolderId, setSelectedPrivateFolderId,
        selectedPlayerNotesView, setSelectedPlayerNotesView,
        worldSearch, setWorldSearch,
        bestiarySearch, setBestiarySearch,
        bestiarySessionOnly, setBestiarySessionOnly,
        viewingBestiaryCharId, setViewingBestiaryCharId,
        worldFilters, toggleWorldFilter, worldFilterAvailableOptions,
        bestiaryList,

        // Cross-hook derived
        mentionEntities,
        worldSearchSuggestions,

        // --- World Entities ---
        ...worldEntities,

        // --- Missions & Timeline ---
        ...missions,

        // --- Skills & Items ---
        ...skillsItems,

        // --- Diary / Notes ---
        ...diary,
        editingNoteId: diary.editingNoteId,
        setEditingNoteId: diary.setEditingNoteId,
        connectionStatus: diary.connectionStatus,
        failedEventIds: diary.failedEventIds,
    };
}
