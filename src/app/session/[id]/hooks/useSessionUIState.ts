/**
 * @file: src/app/session/[id]/hooks/useSessionUIState.ts
 * @summary: Bundles all UI-only useState declarations for the session page.
 * No game logic or side-effects — pure state atoms consumed by page.tsx.
 */
"use client";

import { useState } from "react";

export function useSessionUIState() {
    const [challengeMode, setChallengeMode] = useState(true);
    const [activeTab, setActiveTab] = useState<
        "characters" | "log" | "combat" | "bestiary" | "notes" | "vi"
    >("characters");
    const [showCreator, setShowCreator] = useState(false);
    const [showSummonModal, setShowSummonModal] = useState(false);
    const [summonMode, setSummonMode] = useState<"HERO" | "THREAT">("THREAT");
    const [creatorSource, setCreatorSource] = useState<"active" | "bestiary">("active");
    const [showAspectManager, setShowAspectManager] = useState(false);
    const [logFilter, setLogFilter] = useState<string>("ALL");
    const [logSessionFilter, setLogSessionFilter] = useState<number | null>(null);
    const [combatActivePcId, setCombatActivePcId] = useState<string>("");
    const [combatActiveNpcId, setCombatActiveNpcId] = useState<string>("");
    const [combatLastSelectedId, setCombatLastSelectedId] = useState<string>("");
    const [viewingBestiaryCharId, setViewingBestiaryCharId] = useState<string | null>(null);
    const [bestiarySearch, setBestiarySearch] = useState("");
    const [bestiarySessionOnly, setBestiarySessionOnly] = useState(false);
    const [showTurnOrderModal, setShowTurnOrderModal] = useState(false);
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    const [spectatorMode, setSpectatorMode] = useState(false);
    const [showDiceRoller, setShowDiceRoller] = useState(false);
    const [transmissionVolume, setTransmissionVolume] = useState(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("transmissionActualVolume");
            return stored ? parseFloat(stored) : 0.7;
        }
        return 0.7;
    });

    return {
        challengeMode, setChallengeMode,
        activeTab, setActiveTab,
        showCreator, setShowCreator,
        showSummonModal, setShowSummonModal,
        summonMode, setSummonMode,
        creatorSource, setCreatorSource,
        showAspectManager, setShowAspectManager,
        logFilter, setLogFilter,
        logSessionFilter, setLogSessionFilter,
        combatActivePcId, setCombatActivePcId,
        combatActiveNpcId, setCombatActiveNpcId,
        combatLastSelectedId, setCombatLastSelectedId,
        viewingBestiaryCharId, setViewingBestiaryCharId,
        bestiarySearch, setBestiarySearch,
        bestiarySessionOnly, setBestiarySessionOnly,
        showTurnOrderModal, setShowTurnOrderModal,
        videoStream, setVideoStream,
        spectatorMode, setSpectatorMode,
        showDiceRoller, setShowDiceRoller,
        transmissionVolume, setTransmissionVolume,
    };
}
