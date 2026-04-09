"use client";

import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { SessionState } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { getMentionNavigationRequest, MentionNavigationRequest } from "@/lib/mentionNavigation";
import { NotesTab } from "@/features/session-notes/components/NotesTab";
import { useSessionNotesDiary } from "@/features/session-notes/hooks/useSessionNotesDiary";
import "@/features/session-notes/SessionNotes.css";

interface CharacterPrivateNotesPanelProps {
    sessionId: string;
    characterId: string;
    userId: string;
    userRole: "GM" | "PLAYER";
    state: SessionState;
    mentionEntities: any[];
    onMentionNavigate?: (request: MentionNavigationRequest) => void;
}

const EMPTY_WORLD_FILTERS: Record<string, string[]> = {};

export function CharacterPrivateNotesPanel({
    sessionId,
    characterId,
    userId,
    userRole,
    state,
    mentionEntities,
    onMentionNavigate,
}: CharacterPrivateNotesPanelProps) {
    const normalizedUserId = userId.trim().toLowerCase();
    const [selectedPrivateFolderId, setSelectedPrivateFolderId] = useState("all");

    const handleAddEntityNote = (
        type: "WORLD" | "CHARACTER" | "MISSION" | "TIMELINE" | "SKILL" | "ITEM",
        entityId: string,
        content: string,
        isPrivate: boolean = false,
    ) => {
        if (!content.trim()) return;

        const seat = state.seats.find((entry) => entry.userId.trim().toLowerCase() === normalizedUserId);
        const authorCharacter = seat?.characterId ? state.characters[seat.characterId] : null;
        const authorName = authorCharacter?.name || normalizedUserId;

        const note = {
            id: uuidv4(),
            authorId: normalizedUserId,
            authorName,
            content,
            createdAt: new Date().toISOString(),
            isPrivate,
            is_private: isPrivate,
        };

        const typeMap: Record<string, string> = {
            WORLD: "WORLD_ENTITY_NOTE_ADDED",
            CHARACTER: "CHARACTER_NOTE_ADDED",
            MISSION: "MISSION_NOTE_ADDED",
            TIMELINE: "TIMELINE_EVENT_NOTE_ADDED",
            SKILL: "GLOBAL_SKILL_NOTE_ADDED",
            ITEM: "GLOBAL_ITEM_NOTE_ADDED",
        };

        const payloadKeyMap: Record<string, string> = {
            WORLD: "entityId",
            CHARACTER: "characterId",
            MISSION: "missionId",
            TIMELINE: "eventId",
            SKILL: "skillId",
            ITEM: "itemId",
        };

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: typeMap[type],
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: isPrivate ? { kind: "PLAYER_ONLY", userId: normalizedUserId } : "PUBLIC",
            payload: { [payloadKeyMap[type]]: entityId, note },
        } as any);
    };

    const diary = useSessionNotesDiary({
        sessionId,
        userId: normalizedUserId,
        state,
        notesSubTab: "Privado",
        worldFilters: EMPTY_WORLD_FILTERS,
        selectedPrivateFolderId,
        targetInventoryCharacterId: characterId,
        handleAddEntityNote,
    });

    const handleMentionClick = (e: React.MouseEvent) => {
        if (!onMentionNavigate) return;

        const target = e.target as HTMLElement | null;
        if (target?.closest(".mention-editor-container, .mention-rich-editor")) {
            return;
        }

        const request = getMentionNavigationRequest(e.target);
        if (!request) return;

        e.preventDefault();
        e.stopPropagation();
        onMentionNavigate(request);
    };

    return (
        <div className="character-private-notes-panel" onClick={handleMentionClick}>
            <NotesTab
                notes={diary.notes}
                filteredNotes={diary.filteredNotes}
                userId={normalizedUserId}
                userRole={userRole}
                authors={diary.authors}
                filterAuthor={diary.filterAuthor}
                setFilterAuthor={diary.setFilterAuthor}
                editorContent={diary.editorContent}
                setEditorContent={diary.setEditorContent}
                editorRef={diary.editorRef}
                scrollRef={diary.scrollRef}
                handleDeleteAll={diary.handleDeleteAll}
                handleClearNotesLocally={diary.handleClearNotesLocally}
                handleDelete={diary.handleDelete}
                handleFormat={diary.handleFormat}
                handleSend={diary.handleSend}
                getAuthorColor={diary.getAuthorColor}
                notesSubTab="Privado"
                editingNoteId={diary.editingNoteId}
                handleStartEdit={diary.handleStartEdit}
                handleCancelEdit={diary.handleCancelEdit}
                mentionEntities={mentionEntities}
                state={state}
                connectionStatus={diary.connectionStatus}
                failedEventIds={diary.failedEventIds}
                handleRetry={diary.handleRetry}
                handleAddEntityNote={handleAddEntityNote}
                handleUpdateEntityNote={() => {}}
                handleDeleteEntityNote={() => {}}
                privateNoteFolders={diary.privateNoteFolders}
                handleCreatePrivateFolder={diary.handleCreatePrivateFolder}
                handleUpdatePrivateFolder={diary.handleUpdatePrivateFolder}
                handleDeletePrivateFolder={diary.handleDeletePrivateFolder}
                handleMovePrivateNoteToFolder={diary.handleMovePrivateNoteToFolder}
                handleReorderPrivateFolders={diary.handleReorderPrivateFolders}
                selectedPrivateFolderId={selectedPrivateFolderId}
                setSelectedPrivateFolderId={setSelectedPrivateFolderId}
                selectedPlayerNotesView="all"
                setSelectedPlayerNotesView={() => {}}
            />
        </div>
    );
}
