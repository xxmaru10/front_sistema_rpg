import { useState } from "react";
import { WorldEntityType } from "@/types/domain";

export const COLOR_PRESETS = [
    "var(--accent-color)", "#D0021B", "#4A90E2", "#7ED321",
    "#9013FE", "#F5A623", "#50E3C2", "#4A4A4A",
    "#8B572A", "#B00000"
];

export const TYPE_LABELS: Record<WorldEntityType, string> = {
    "PERSONAGEM": "PERSONAGEM",
    "LOCALIZACAO": "LOCALIZAÇÀO",
    "MAPA": "MAPA",
    "FACAO": "FACÇÀO",
    "RELIGIAO": "RELIGIÀO",
    "FAMILIA": "FAMÍLIA",
    "BESTIARIO": "CRIATURA",
    "RACA": "RAÇA",
    "OUTROS": "OUTROS"
};

export const LOCATION_CATEGORIES: Record<string, string[]> = {
    "Geográfico": ["MUNDO", "CONTINENTE", "PAÍS", "REINO", "ESTADO", "FEUDO"],
    "Urbano": ["CIDADE", "VILA", "BAIRRO", "RUA", "FORTALEZA", "ACAMPAMENTO", "PRISÀO", "FÁBRICA", "RUÍNAS"],
    "Natureza": ["FLORESTA", "SELVA", "PANTANO", "TUNDRA", "DESERTO", "MONTANHA", "PENHASCO", "VALE", "VULCÀO", "RIO", "CLAREIRA", "CAVERNA"],
    "Especial": ["MINA", "ESCONDERIJO", "SANTUÁRIO", "EXTRA-DIMENSIONAL", "OUTRO"]
};

export function useWorldEntityForm() {
    const [showAddWorldEntity, setShowAddWorldEntity] = useState(false);
    const [newEntityName, setNewEntityName] = useState("");
    const [newEntityType, setNewEntityType] = useState<WorldEntityType>("PERSONAGEM");
    const [newEntityColor, setNewEntityColor] = useState("var(--accent-color)");
    const [newEntityTags, setNewEntityTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [newEntityDescription, setNewEntityDescription] = useState("");
    const [newEntityFamily, setNewEntityFamily] = useState("");
    const [newEntityFaction, setNewEntityFaction] = useState("");
    const [newEntityRace, setNewEntityRace] = useState("");
    const [newEntityOrigin, setNewEntityOrigin] = useState("");
    const [newEntityCurrentLoc, setNewEntityCurrentLoc] = useState("");
    const [newEntityReligion, setNewEntityReligion] = useState("");
    const [newEntityLocationType, setNewEntityLocationType] = useState("");
    const [newEntityLinkedLocation, setNewEntityLinkedLocation] = useState("");
    const [locSearch, setLocSearch] = useState("");
    const [newEntityImageUrl, setNewEntityImageUrl] = useState("");
    const [newEntityProfession, setNewEntityProfession] = useState("");
    const [viewingEntityId, setViewingEntityId] = useState<string | null>(null);
    const [importBestiaryId, setImportBestiaryId] = useState("");
    const [editingWorldEntityId, setEditingWorldEntityId] = useState<string | null>(null);
    const [isImageProcessing, setIsImageProcessing] = useState(false);

    const handleCancelWorldEntityEdit = () => {
        setShowAddWorldEntity(false);
        setEditingWorldEntityId(null);
        setNewEntityName("");
        setNewEntityTags([]);
        setTagInput("");
        setNewEntityDescription("");
        setNewEntityFamily("");
        setNewEntityFaction("");
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
        setIsImageProcessing(false);
    };

    const handleAddTag = (e?: React.KeyboardEvent | string) => {
        if (typeof e === 'string') {
            const val = e.trim();
            if (val && !newEntityTags.includes(val)) setNewEntityTags(prev => [...prev, val]);
            setTagInput("");
            return;
        }
        if (e && (e as React.KeyboardEvent).key) {
            const key = (e as React.KeyboardEvent).key;
            if (key === 'Enter' || key === ',' || key === ';') {
                (e as React.KeyboardEvent).preventDefault();
                const val = tagInput.trim();
                if (val && !newEntityTags.includes(val)) setNewEntityTags(prev => [...prev, val]);
                setTagInput("");
            }
        }
    };

    const removeTag = (tag: string) => {
        setNewEntityTags(prev => prev.filter(t => t !== tag));
    };

    return {
        // Form state
        showAddWorldEntity, setShowAddWorldEntity,
        newEntityName, setNewEntityName,
        newEntityType, setNewEntityType,
        newEntityColor, setNewEntityColor,
        newEntityTags, setNewEntityTags,
        tagInput, setTagInput,
        newEntityDescription, setNewEntityDescription,
        newEntityFamily, setNewEntityFamily,
        newEntityFaction, setNewEntityFaction,
        newEntityRace, setNewEntityRace,
        newEntityOrigin, setNewEntityOrigin,
        newEntityCurrentLoc, setNewEntityCurrentLoc,
        newEntityReligion, setNewEntityReligion,
        newEntityLocationType, setNewEntityLocationType,
        newEntityLinkedLocation, setNewEntityLinkedLocation,
        locSearch, setLocSearch,
        newEntityImageUrl, setNewEntityImageUrl,
        newEntityProfession, setNewEntityProfession,
        viewingEntityId, setViewingEntityId,
        importBestiaryId, setImportBestiaryId,
        editingWorldEntityId, setEditingWorldEntityId,
        isImageProcessing, setIsImageProcessing,
        // Handlers
        handleCancelWorldEntityEdit,
        handleAddTag,
        removeTag,
        // Constants
        COLOR_PRESETS,
        TYPE_LABELS,
        LOCATION_CATEGORIES,
    };
}
