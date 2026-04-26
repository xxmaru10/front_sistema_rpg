import { useState, useMemo } from "react";
import { SessionState, GlobalSkill, GlobalItem, ItemSize } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UseSessionSkillsItemsProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    worldFilters: Record<string, string[]>;
}

export function useSessionSkillsItems({
    sessionId,
    userId: rawUserId,
    userRole,
    state,
    worldFilters,
}: UseSessionSkillsItemsProps) {
    const userId = rawUserId.trim().toLowerCase();
    // --- Skill form state ---
    const [showAddSkill, setShowAddSkill] = useState(false);
    const [newSkillName, setNewSkillName] = useState("");
    const [newSkillDescription, setNewSkillDescription] = useState("");
    const [newSkillRequirement, setNewSkillRequirement] = useState("");
    const [newSkillColor, setNewSkillColor] = useState("var(--accent-color)");
    const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

    // --- Item form state ---
    const [showAddItem, setShowAddItem] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [newItemDescription, setNewItemDescription] = useState("");
    const [newItemPrice, setNewItemPrice] = useState(0);
    const [newItemQuantity, setNewItemQuantity] = useState(1);
    const [newItemBonus, setNewItemBonus] = useState(0);
    const [newItemSize, setNewItemSize] = useState<ItemSize | undefined>(undefined);
    const [newItemRequirement, setNewItemRequirement] = useState("");
    const [newItemImageUrl, setNewItemImageUrl] = useState("");
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // --- Filtered derived state ---
    const filteredSkills = useMemo(() => {
        const list = state.skills || [];
        if (worldFilters.displayType && worldFilters.displayType.length > 0) {
            if (!worldFilters.displayType.includes("HABILIDADE")) return [];
        }
        return list;
    }, [state.skills, worldFilters.displayType]);

    const filteredItems = useMemo(() => {
        const list = state.items || [];
        if (worldFilters.displayType && worldFilters.displayType.length > 0) {
            if (!worldFilters.displayType.includes("ITEM")) return [];
        }
        return list;
    }, [state.items, worldFilters.displayType]);

    // --- Skill handlers ---
    const handleUpdateSkill = (skillId: string, patch: Partial<GlobalSkill>) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "GLOBAL_SKILL_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { skillId, patch }
        } as any);
    };

    const handleCancelSkillEdit = () => {
        setShowAddSkill(false);
        setEditingSkillId(null);
        setNewSkillName("");
        setNewSkillDescription("");
        setNewSkillRequirement("");
    };

    const handleCreateSkill = () => {
        if (userRole !== "GM") {
            console.error("[Skills] Tentativa de criação por não-GM:", userId);
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
                id: uuidv4(), sessionId, seq: 0,
                type: "GLOBAL_SKILL_CREATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
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
        setNewSkillColor(skill.color || "var(--accent-color)");
        setShowAddSkill(true);
    };

    const handleDeleteSkill = (skillId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "GLOBAL_SKILL_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { skillId }
        } as any);
    };

    // --- Item handlers ---
    const handleUpdateItem = (itemId: string, patch: Partial<GlobalItem>) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "GLOBAL_ITEM_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { itemId, patch }
        } as any);
    };

    const handleCancelItemEdit = () => {
        setShowAddItem(false);
        setEditingItemId(null);
        setNewItemName("");
        setNewItemDescription("");
        setNewItemPrice(0);
        setNewItemQuantity(1);
        setNewItemBonus(0);
        setNewItemSize(undefined);
        setNewItemRequirement("");
        setNewItemImageUrl("");
    };

    const handleCreateItem = () => {
        if (userRole !== "GM") {
            console.error("[Items] Tentativa de criação por não-GM:", userId);
            return;
        }
        if (!newItemName.trim()) return;

        const itemId = editingItemId || uuidv4();
        const normalizedDescription = newItemDescription.replace(/data-mention-id="__draft_global_item__"/g, `data-mention-id="${itemId}"`);

        const item: GlobalItem = {
            id: itemId,
            name: newItemName,
            description: normalizedDescription,
            price: newItemPrice,
            quantity: newItemQuantity,
            bonus: newItemBonus,
            size: newItemSize,
            requirement: newItemRequirement,
            imageUrl: newItemImageUrl || undefined,
            createdAt: new Date().toISOString()
        };

        if (editingItemId) {
            handleUpdateItem(editingItemId, item);
        } else {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "GLOBAL_ITEM_CREATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
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
        setNewItemBonus(item.bonus || 0);
        setNewItemSize(item.size);
        setNewItemRequirement(item.requirement || "");
        setNewItemImageUrl(item.imageUrl || "");
        setShowAddItem(true);
    };

    const handleDeleteItem = (itemId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "GLOBAL_ITEM_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { itemId }
        } as any);
    };

    return {
        // Skill state
        showAddSkill, setShowAddSkill,
        newSkillName, setNewSkillName,
        newSkillDescription, setNewSkillDescription,
        newSkillRequirement, setNewSkillRequirement,
        newSkillColor, setNewSkillColor,
        editingSkillId, setEditingSkillId,
        // Item state
        showAddItem, setShowAddItem,
        newItemName, setNewItemName,
        newItemDescription, setNewItemDescription,
        newItemPrice, setNewItemPrice,
        newItemQuantity, setNewItemQuantity,
        newItemBonus, setNewItemBonus,
        newItemSize, setNewItemSize,
        newItemRequirement, setNewItemRequirement,
        newItemImageUrl, setNewItemImageUrl,
        editingItemId, setEditingItemId,
        // Derived
        filteredSkills, filteredItems,
        // Skill handlers
        handleCreateSkill, handleUpdateSkill, handleDeleteSkill,
        handleStartEditSkill, handleCancelSkillEdit,
        // Item handlers
        handleCreateItem, handleUpdateItem, handleDeleteItem,
        handleStartEditItem, handleCancelItemEdit,
    };
}
