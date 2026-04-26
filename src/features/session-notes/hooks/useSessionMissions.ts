import { useState, useMemo } from "react";
import { SessionState, Mission, TimelineEvent, MissionSubTask } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UseSessionMissionsProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    worldFilters: Record<string, string[]>;
}

export function useSessionMissions({
    sessionId,
    userId: rawUserId,
    userRole,
    state,
    worldFilters,
}: UseSessionMissionsProps) {
    const userId = rawUserId.trim().toLowerCase();
    // --- Mission form state ---
    const [showAddMission, setShowAddMission] = useState(false);
    const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
    const [newMissionName, setNewMissionName] = useState("");
    const [newMissionDescription, setNewMissionDescription] = useState("");
    const [newMissionSubTasks, setNewMissionSubTasks] = useState<MissionSubTask[]>([]);
    const [newSubTaskInput, setNewSubTaskInput] = useState("");
    const [newMissionDay, setNewMissionDay] = useState<number | undefined>(undefined);
    const [newMissionMonth, setNewMissionMonth] = useState<number | undefined>(undefined);
    const [newMissionYear, setNewMissionYear] = useState<number>(new Date().getFullYear());

    // --- Timeline form state ---
    const [showAddTimelineEvent, setShowAddTimelineEvent] = useState(false);
    const [editingTimelineEventId, setEditingTimelineEventId] = useState<string | null>(null);
    const [newTimelineName, setNewTimelineName] = useState("");
    const [newTimelineDescription, setNewTimelineDescription] = useState("");
    const [newTimelineDay, setNewTimelineDay] = useState<number | undefined>(undefined);
    const [newTimelineMonth, setNewTimelineMonth] = useState<number | undefined>(undefined);
    const [newTimelineYear, setNewTimelineYear] = useState<number>(new Date().getFullYear());
    const [timelineSortAsc, setTimelineSortAsc] = useState(false);

    // --- Filtered derived state ---
    const filteredMissions = useMemo(() => {
        const list = state.missions || [];
        if (worldFilters.displayType && worldFilters.displayType.length > 0) {
            if (!worldFilters.displayType.includes("MISSÀO")) return [];
        }
        return list;
    }, [state.missions, worldFilters.displayType]);

    const filteredTimeline = useMemo(() => {
        const list = state.timeline || [];
        if (worldFilters.displayType && worldFilters.displayType.length > 0) {
            if (!worldFilters.displayType.includes("HISTÓRIA")) return [];
        }
        return list;
    }, [state.timeline, worldFilters.displayType]);

    // --- Mission handlers ---
    const handleUpdateMission = (missionId: string, patch: Partial<Mission>) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "MISSION_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { missionId, patch }
        } as any);
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
                id: uuidv4(), sessionId, seq: 0,
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

    const handleDeleteMission = (missionId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
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
        const newSubTasks = mission.subTasks.map(st =>
            st.id === subTaskId ? { ...st, completed: !st.completed } : st
        );
        handleUpdateMission(missionId, { subTasks: newSubTasks });
    };

    const handleAddSubTask = (missionId: string, text: string) => {
        const mission = state.missions?.find(m => m.id === missionId);
        if (!mission || !text.trim()) return;
        const newSubTask = { id: uuidv4(), text, completed: false };
        const newSubTasks = [...(mission.subTasks || []), newSubTask];
        handleUpdateMission(missionId, { subTasks: newSubTasks });
    };

    // --- Timeline handlers ---
    const handleCancelTimelineEdit = () => {
        setShowAddTimelineEvent(false);
        setEditingTimelineEventId(null);
        setNewTimelineName("");
        setNewTimelineDescription("");
        setNewTimelineDay(undefined);
        setNewTimelineMonth(undefined);
        setNewTimelineYear(new Date().getFullYear());
    };

    const handleCreateTimelineEvent = () => {
        if (userRole !== "GM") {
            console.error("[Timeline] Tentativa de criação por não-GM:", userId);
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
                id: uuidv4(), sessionId, seq: 0,
                type: "TIMELINE_EVENT_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { eventId: editingTimelineEventId, patch: event }
            } as any);
        } else {
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
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

    const handleDeleteTimelineEvent = (eventId: string) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "TIMELINE_EVENT_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { eventId }
        } as any);
    };

    return {
        // Mission state
        showAddMission, setShowAddMission,
        editingMissionId, setEditingMissionId,
        newMissionName, setNewMissionName,
        newMissionDescription, setNewMissionDescription,
        newMissionSubTasks, setNewMissionSubTasks,
        newSubTaskInput, setNewSubTaskInput,
        newMissionDay, setNewMissionDay,
        newMissionMonth, setNewMissionMonth,
        newMissionYear, setNewMissionYear,
        // Timeline state
        showAddTimelineEvent, setShowAddTimelineEvent,
        editingTimelineEventId, setEditingTimelineEventId,
        newTimelineName, setNewTimelineName,
        newTimelineDescription, setNewTimelineDescription,
        newTimelineDay, setNewTimelineDay,
        newTimelineMonth, setNewTimelineMonth,
        newTimelineYear, setNewTimelineYear,
        timelineSortAsc, setTimelineSortAsc,
        // Derived
        filteredMissions, filteredTimeline,
        // Mission handlers
        handleCreateMission,
        handleStartEditMission,
        handleCancelMissionEdit,
        handleUpdateMission,
        handleDeleteMission,
        handleToggleSubTask,
        handleAddSubTask,
        // Timeline handlers
        handleCreateTimelineEvent,
        handleStartEditTimelineEvent,
        handleCancelTimelineEdit,
        handleDeleteTimelineEvent,
    };
}
