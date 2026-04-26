import { useMemo } from "react";
import { SessionState, WorldEntity, WorldEntityType, EntityNote } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { useWorldEntityForm } from "./useWorldEntityForm";

interface UseWorldEntitiesProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    subTabMundo: string;
    worldSearch: string;
    worldFilters: Record<string, string[]>;
}

export function useWorldEntities({
    sessionId,
    userId: rawUserId,
    userRole,
    state,
    subTabMundo,
    worldSearch,
    worldFilters,
}: UseWorldEntitiesProps) {
    const userId = rawUserId.trim().toLowerCase();

    const form = useWorldEntityForm();
    const {
        showAddWorldEntity, setShowAddWorldEntity,
        newEntityName, newEntityType, newEntityColor, newEntityTags,
        newEntityDescription, newEntityFamily, newEntityFaction, newEntityRace, newEntityOrigin,
        newEntityCurrentLoc, newEntityReligion, newEntityLocationType, newEntityLinkedLocation,
        newEntityImageUrl, newEntityProfession,
        viewingEntityId, importBestiaryId,
        editingWorldEntityId, setEditingWorldEntityId,
        setNewEntityName, setNewEntityType, setNewEntityColor, setNewEntityTags,
        setTagInput, setNewEntityDescription, setNewEntityFamily, setNewEntityFaction, setNewEntityRace,
        setNewEntityOrigin, setNewEntityCurrentLoc, setNewEntityReligion,
        setNewEntityLocationType, setNewEntityLinkedLocation, setLocSearch,
        setNewEntityImageUrl, setNewEntityProfession, setViewingEntityId,
        setImportBestiaryId,
        handleCancelWorldEntityEdit,
    } = form;

    const byNameAsc = (a: WorldEntity, b: WorldEntity) =>
        (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" });

    // --- Derived lists ---
    const worldEntitiesList = Object.values(state.worldEntities || {}) as WorldEntity[];
    const familiesList = worldEntitiesList.filter(e => e.type === "FAMILIA").slice().sort(byNameAsc);
    const factionsList = worldEntitiesList.filter(e => e.type === "FACAO").slice().sort(byNameAsc);
    const racesList = worldEntitiesList.filter(e => e.type === "RACA").slice().sort(byNameAsc);
    const religionsList = worldEntitiesList.filter(e => e.type === "RELIGIAO").slice().sort(byNameAsc);
    const locationsList = worldEntitiesList.filter(e => e.type === "LOCALIZACAO").slice().sort(byNameAsc);
    const viewingEntity = viewingEntityId ? state.worldEntities?.[viewingEntityId] : null;

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
            const isTypeHiddenForPlayer = userRole !== "GM" && e.fieldVisibility?.type === true;
            const effectiveType = isTypeHiddenForPlayer ? "OUTROS" : e.type;
            if (effectiveType !== targetType) return false;

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
            const query = worldSearch.trim().toLowerCase();
            baseList = baseList.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.tags.some(t => t.toLowerCase().includes(query))
            );
        }

        return baseList;
    }, [state.worldEntities, subTabMundo, worldSearch, userRole, worldFilters]);

    const uniqueTags = useMemo(() => {
        const tags = new Set<string>();
        Object.values(state.worldEntities || {}).forEach(e => (e.tags || []).forEach(t => tags.add(t)));
        return Array.from(tags).sort();
    }, [state.worldEntities]);

    const getLinkedNotesForEntity = (
        type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM',
        entityId: string
    ): EntityNote[] => {
        if (type === 'WORLD') return state.worldEntities?.[entityId]?.linkedNotes || [];
        if (type === 'CHARACTER') return state.characters?.[entityId]?.linkedNotes || [];
        if (type === 'MISSION') return (state.missions || []).find(m => m.id === entityId)?.linkedNotes || [];
        if (type === 'TIMELINE') return (state.timeline || []).find(event => event.id === entityId)?.linkedNotes || [];
        if (type === 'SKILL') return (state.skills || []).find(skill => skill.id === entityId)?.linkedNotes || [];
        return (state.items || []).find(item => item.id === entityId)?.linkedNotes || [];
    };

    // --- Handlers ---
    const handleCreateWorldEntity = () => {
        if (userRole !== "GM") {
            console.error("[WorldEntities] Tentativa de criação por não-GM:", userId);
            return;
        }
        if (!newEntityName.trim()) {
            console.error("[WorldEntities] Nome da entidade está vazio — criação ignorada.");
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
            factionId: newEntityType === "PERSONAGEM" ? (newEntityFaction || undefined) : undefined,
            raceId: newEntityType === "PERSONAGEM" ? (newEntityRace || undefined) : undefined,
            religionId: newEntityType === "PERSONAGEM" ? (newEntityReligion || undefined) : undefined,
            originId: ["PERSONAGEM", "BESTIARIO"].includes(newEntityType) ? (newEntityOrigin || undefined) : undefined,
            profession: newEntityType === "PERSONAGEM" ? (newEntityProfession || undefined) : undefined,
            currentLocationId: ["PERSONAGEM", "FACAO"].includes(newEntityType) ? (newEntityCurrentLoc || undefined) : undefined,
            locationType: newEntityType === "LOCALIZACAO" ? (newEntityLocationType || undefined) : undefined,
            linkedLocationId: ["LOCALIZACAO", "MAPA", "BESTIARIO"].includes(newEntityType) ? (newEntityLinkedLocation || undefined) : undefined,
            imageUrl: newEntityImageUrl || undefined,
            fieldVisibility: !editingWorldEntityId ? {
                name: false, type: false, description: false, tags: false,
                image: false, color: false, family: false, faction: false, race: false,
                origin: false, religion: false, currentLocation: false,
                location: false, location_info: false
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
                if (newEntityFaction !== currentEntity.factionId) patch.factionId = newEntityFaction || undefined;
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
                id: uuidv4(), sessionId, seq: 0,
                type: "WORLD_ENTITY_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { entityId: editingWorldEntityId, patch }
            } as any);
        } else {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "WORLD_ENTITY_CREATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: newEntity
            } as any);
        }

        handleCancelWorldEntityEdit();
    };

    const handleStartEditWorldEntity = (entityId: string) => {
        const entity = state.worldEntities?.[entityId];
        if (!entity) return;

        setEditingWorldEntityId(entityId);
        setNewEntityName(entity.name);
        setNewEntityType(entity.type);
        setNewEntityColor(entity.color || "var(--accent-color)");
        setNewEntityTags(entity.tags || []);
        setNewEntityDescription(entity.description || "");
        setNewEntityFamily(entity.familyId || "");
        setNewEntityFaction(entity.factionId || "");
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

    const handleDeleteWorldEntity = (entityId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
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
        const fieldVisibility = { ...(entity.fieldVisibility || {}), [fieldName]: isHidden };
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
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
        const descriptionBlocks = [...(entity.descriptionBlocks || []), { id: uuidv4(), content, hidden: false }];
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
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
            id: uuidv4(), sessionId, seq: 0,
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
            id: uuidv4(), sessionId, seq: 0,
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
        const fields = ['name', 'type', 'description', 'tags', 'image', 'color', 'family', 'faction', 'race', 'religion', 'origin', 'currentLocation', 'location', 'location_info'];
        const fieldVisibility: Record<string, boolean> = {};
        fields.forEach(f => (fieldVisibility[f] = hideAll));
        const descriptionBlocks = (entity.descriptionBlocks || []).map((b: any) => ({ ...b, hidden: hideAll }));
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "WORLD_ENTITY_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { entityId, patch: { fieldVisibility, descriptionBlocks } }
        } as any);
    };

    const handleAddEntityNote = (
        type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM',
        entityId: string,
        content: string,
        isPrivate: boolean = false
    ) => {
        if (!content.trim()) return;
        const seat = state.seats.find(s => s.userId === userId);
        const char = seat?.characterId ? state.characters[seat.characterId] : null;
        const authorName = char?.name || userId;

        const note = {
            id: uuidv4(),
            authorId: userId,
            authorName,
            content,
            createdAt: new Date().toISOString(),
            isPrivate: !!isPrivate,
            is_private: !!isPrivate
        };

        const typeMap: Record<string, string> = {
            'WORLD': 'WORLD_ENTITY_NOTE_ADDED',
            'CHARACTER': 'CHARACTER_NOTE_ADDED',
            'MISSION': 'MISSION_NOTE_ADDED',
            'TIMELINE': 'TIMELINE_EVENT_NOTE_ADDED',
            'SKILL': 'GLOBAL_SKILL_NOTE_ADDED',
            'ITEM': 'GLOBAL_ITEM_NOTE_ADDED'
        };
        const payloadKeyMap: Record<string, string> = {
            'WORLD': 'entityId', 'CHARACTER': 'characterId',
            'MISSION': 'missionId', 'TIMELINE': 'eventId',
            'SKILL': 'skillId', 'ITEM': 'itemId'
        };

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: typeMap[type],
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
            payload: { [payloadKeyMap[type]]: entityId, note }
        } as any);
    };

    const handleDeleteEntityNote = (
        type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM',
        entityId: string,
        noteId: string
    ) => {
        const existingNote = getLinkedNotesForEntity(type, entityId).find(note => note.id === noteId);
        const typeMap: Record<string, string> = {
            'WORLD': 'WORLD_ENTITY_NOTE_DELETED', 'CHARACTER': 'CHARACTER_NOTE_DELETED',
            'MISSION': 'MISSION_NOTE_DELETED', 'TIMELINE': 'TIMELINE_EVENT_NOTE_DELETED',
            'SKILL': 'GLOBAL_SKILL_NOTE_DELETED', 'ITEM': 'GLOBAL_ITEM_NOTE_DELETED'
        };
        const payloadKeyMap: Record<string, string> = {
            'WORLD': 'entityId', 'CHARACTER': 'characterId',
            'MISSION': 'missionId', 'TIMELINE': 'eventId',
            'SKILL': 'skillId', 'ITEM': 'itemId'
        };
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: typeMap[type],
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: existingNote?.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
            payload: { [payloadKeyMap[type]]: entityId, noteId }
        } as any);
    };

    const handleUpdateEntityNote = (
        type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM',
        entityId: string,
        noteId: string,
        patch: Partial<EntityNote>
    ) => {
        const existingNote = getLinkedNotesForEntity(type, entityId).find(note => note.id === noteId);
        if (!existingNote) return;

        const typeMap: Partial<Record<'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', string>> = {
            CHARACTER: 'CHARACTER_NOTE_UPDATED'
        };
        const payloadKeyMap: Partial<Record<'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', string>> = {
            CHARACTER: 'characterId'
        };

        const updateType = typeMap[type];
        const payloadKey = payloadKeyMap[type];
        if (!updateType || !payloadKey) return;

        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: updateType,
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: existingNote.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
            payload: { [payloadKey]: entityId, noteId, patch }
        } as any);
    };

    return {
        // Spread all form state + handlers from sub-hook
        ...form,
        // Derived
        familiesList, factionsList, racesList, religionsList, locationsList,
        worldEntitiesForCurrentTab, uniqueTags, viewingEntity,
        // Handlers
        handleCreateWorldEntity,
        handleStartEditWorldEntity,
        handleDeleteWorldEntity,
        handleUpdateFieldVisibility,
        handleAddDescriptionBlock,
        handleUpdateDescriptionBlock,
        handleDeleteDescriptionBlock,
        handleToggleAllVisibility,
        handleAddEntityNote,
        handleUpdateEntityNote,
        handleDeleteEntityNote,
    };
}
