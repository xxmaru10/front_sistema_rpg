"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { Character, SessionState } from "@/types/domain";
import { FateCharacterCard } from "@/components/CharacterCard/FateCharacterCard";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { VAMPIRE_SKILLS, toRoman } from "../../utils";
import { VampireHungerConsequences } from "./VampireHungerConsequences";
import { VampireDisciplines } from "./VampireDisciplines";
import { VampireVitality } from "./VampireVitality";
import type { VampireCharacter, VampireSystemData } from "../../types";
import type { MentionNavigationRequest } from "@/lib/mentionNavigation";

interface VampireCharacterCardProps {
  character: Character;
  sessionId: string;
  actorUserId: string;
  isGM?: boolean;
  isCompact?: boolean;
  isLinkedCharacter?: boolean;
  mentionEntities?: any[];
  hideInventory?: boolean;
  sessionState?: SessionState;
  userRole?: "GM" | "PLAYER";
  onMentionNavigate?: (request: MentionNavigationRequest) => void;
  // Legacy props passed by CharacterCard proxy that we don't need but accept
  isOwner?: boolean;
  canEdit?: boolean;
  canEditStressOrFP?: boolean;
}

function GenerationBadge({
  generation, isGM, characterId, sessionId, actorUserId,
}: { generation: number; isGM: boolean; characterId: string; sessionId: string; actorUserId: string }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState("");

  const save = () => {
    const val = parseInt(temp, 10);
    if (!isNaN(val) && val >= 1 && val <= 13) {
      globalEventStore.append({
        id: uuidv4(), sessionId, seq: 0, type: "VAMPIRE_GENERATION_UPDATED",
        actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
        payload: { characterId, generation: val },
      } as any);
    }
    setEditing(false);
  };

  if (editing && isGM) {
    return (
      <input
        autoFocus
        type="number" min={1} max={13}
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        style={{
          width: "52px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(192,57,43,0.4)",
          color: "#c0392b", padding: "2px 6px", borderRadius: "6px", textAlign: "center", fontSize: "0.85rem",
        }}
      />
    );
  }

  return (
    <span
      onClick={() => isGM && (setTemp(String(generation)), setEditing(true))}
      title={isGM ? "Editar geração" : `Geração ${generation}`}
      style={{
        fontSize: "0.78rem", fontWeight: 700, color: "#c0392b",
        background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)",
        borderRadius: "6px", padding: "2px 8px",
        cursor: isGM ? "pointer" : "default", letterSpacing: "0.05em",
      }}
    >
      {toRoman(generation)}
    </span>
  );
}

export default function VampireCharacterCard(props: VampireCharacterCardProps) {
  const { character, sessionId, actorUserId, isGM = false, isLinkedCharacter } = props;
  const vc = character as VampireCharacter;
  const data = vc.systemData as VampireSystemData | undefined;
  const userId = actorUserId.trim().toLowerCase();

  const isOwner =
    !!(actorUserId &&
      character.ownerUserId &&
      actorUserId.trim().toLowerCase() === character.ownerUserId.trim().toLowerCase()) ||
    !!isLinkedCharacter;
  const canEdit = isGM || isOwner;

  const generation = data?.generation ?? 13;

  const vitalityNode = data ? (
    <VampireVitality
      characterId={character.id}
      sessionId={sessionId}
      actorUserId={userId}
      data={data}
      isGM={isGM}
      canEditStressOrFP={canEdit}
    />
  ) : undefined;

  const hungerNode = data ? (
    <VampireHungerConsequences
      characterId={character.id}
      sessionId={sessionId}
      actorUserId={userId}
      data={data}
      isGM={isGM}
    />
  ) : undefined;

  const replaceSpellsTab = {
    label: "DISCIPLINAS",
    icon: <Zap size={18} />,
    content: (
      <VampireDisciplines
        characterId={character.id}
        sessionId={sessionId}
        actorUserId={userId}
        disciplines={data?.disciplines ?? []}
        canEdit={canEdit}
      />
    ),
  };

  return (
    <FateCharacterCard
      {...props}
      skillsOverride={VAMPIRE_SKILLS}
      vitalityOverride={vitalityNode}
      extraConsequenceColumn={hungerNode}
      headerBadge={
        <GenerationBadge
          generation={generation}
          isGM={isGM}
          characterId={character.id}
          sessionId={sessionId}
          actorUserId={userId}
        />
      }
      replaceSpellsTab={replaceSpellsTab}
    />
  );
}
