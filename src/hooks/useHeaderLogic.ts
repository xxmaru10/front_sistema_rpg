"use client";

import { useEffect, useState } from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import { globalEventStore } from "@/lib/eventStore";
import { battlemapToolStore, Tool } from "@/lib/battlemapToolStore";
import { getThemePreset } from "@/lib/themePresets";
import { v4 as uuidv4 } from "uuid";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return {
        r: parseInt(m[1], 16),
        g: parseInt(m[2], 16),
        b: parseInt(m[3], 16),
    };
}

function rgbStringToComponents(rgbStr: string): { r: number; g: number; b: number } {
    const parts = rgbStr.split(",").map((s) => parseInt(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2] };
}

export interface HeaderLogicState {
    userRole: "GM" | "PLAYER";
    userId: string;
    characterId: string | undefined;
    sessionNumber: number;
    battlemapActive: boolean;
    showToolbar: boolean;
    activeTool: Tool;
    penColor: string;
    themePreset: string;
    themeColor: string | null;
    customColorR: number;
    customColorG: number;
    customColorB: number;
    isTheaterMode: boolean;
}

export interface HeaderLogicActions {
    changeSessionNumber: (delta: number) => void;
}

export function useHeaderLogic(
    sessionId: string | undefined,
    searchParams: ReadonlyURLSearchParams
): HeaderLogicState & HeaderLogicActions {
    const [userRole, setUserRole] = useState<"GM" | "PLAYER">("PLAYER");
    const [userId, setUserId] = useState("");
    const [characterId, setCharacterId] = useState<string | undefined>(undefined);
    const [sessionNumber, setSessionNumber] = useState(1);
    const [battlemapActive, setBattlemapActive] = useState(false);
    const [showToolbar, setShowToolbar] = useState(battlemapToolStore.showToolbar);
    const [activeTool, setActiveTool] = useState<Tool>(battlemapToolStore.activeTool);
    const [penColor, setPenColor] = useState(battlemapToolStore.penColor);
    const [themePreset, setThemePreset] = useState<string>("medieval");
    const [themeColor, setThemeColor] = useState<string | null>(null);
    const [customColorR, setCustomColorR] = useState(244);
    const [customColorG, setCustomColorG] = useState(180);
    const [customColorB, setCustomColorB] = useState(60);
    const [isTheaterMode, setIsTheaterMode] = useState(battlemapToolStore.isTheaterMode);

    // ── URL param persistence ──────────────────────────────────────────────
    useEffect(() => {
        const urlRole = searchParams.get("r") as "GM" | "PLAYER";
        const urlUser = searchParams.get("u");
        const urlCharId = searchParams.get("c");

        if (urlRole) {
            setUserRole(urlRole);
            localStorage.setItem("userRole", urlRole);
        } else {
            const stored = localStorage.getItem("userRole");
            if (stored) setUserRole(stored as "GM" | "PLAYER");
        }

        if (urlUser) {
            setUserId(urlUser);
            localStorage.setItem("userId", urlUser);
        } else {
            const stored = localStorage.getItem("userId");
            if (stored) setUserId(stored);
        }

        if (urlCharId) {
            localStorage.setItem("characterId", urlCharId);
            setCharacterId(urlCharId);
        } else {
            const stored = localStorage.getItem("characterId");
            if (stored) setCharacterId(stored);
        }
    }, [searchParams]);

    // ── Auto-detect characterId quando ausente (apenas match único) ────────
    useEffect(() => {
        if (characterId) return;                     // já temos — não sobrescrever
        if (!userId) return;                          // userId ainda não resolvido
        if (!sessionId) return;                       // sem sessão
        const storedRole = localStorage.getItem("userRole");
        if (storedRole === "GM") return;              // GM não tem personagem

        const snapshot = globalEventStore.getSnapshotState();
        if (!snapshot?.characters) return;

        const norm = (s: string) => (s || "").trim().toLowerCase().normalize("NFC");
        const uidNorm = norm(userId);

        const matches = Object.values(snapshot.characters).filter(c =>
            norm(c.ownerUserId) === uidNorm || norm(c.name) === uidNorm
        );

        if (matches.length === 1) {
            // Match único: seguro para auto-associar
            const detectedId = matches[0].id;
            setCharacterId(detectedId);
            localStorage.setItem("characterId", detectedId);
            console.info(`[useHeaderLogic] Auto-detect characterId: ${matches[0].name} (${detectedId})`);
        }
        // 0 ou 2+ matches: não fazer nada — depender de ?c= explícito
    }, [userId, characterId, sessionId]);

    // ── Event store subscriptions ──────────────────────────────────────────
    useEffect(() => {
        if (!sessionId) return;

        const snapshot = globalEventStore.getSnapshotState();
        if (snapshot) {
            if (snapshot.sessionNumber !== undefined) {
                setSessionNumber(snapshot.sessionNumber);
            }
            if (snapshot.battlemap?.isActive !== undefined) {
                setBattlemapActive(snapshot.battlemap.isActive);
            }
            if (snapshot.themePreset) {
                setThemePreset(snapshot.themePreset);
                const { r, g, b } = rgbStringToComponents(
                    getThemePreset(snapshot.themePreset).accentRgb
                );
                setCustomColorR(r);
                setCustomColorG(g);
                setCustomColorB(b);
            }
            if (snapshot.themeColor) {
                setThemeColor(snapshot.themeColor);
                const parsed = hexToRgb(snapshot.themeColor);
                if (parsed) {
                    setCustomColorR(parsed.r);
                    setCustomColorG(parsed.g);
                    setCustomColorB(parsed.b);
                }
            }
        }

        const unsubscribeStore = globalEventStore.subscribe(
            (event) => {
                if (event.sessionId !== sessionId) return;

                if (event.type === "SESSION_NUMBER_UPDATED") {
                    setSessionNumber((event.payload as any).number);
                } else if (event.type === "BATTLEMAP_UPDATED") {
                    if (event.payload.isActive !== undefined) {
                        setBattlemapActive(event.payload.isActive);
                    }
                } else if (event.type === "SESSION_THEME_PRESET_UPDATED") {
                    const presetId = event.payload.preset;
                    setThemePreset(presetId);
                    // Derive RGB from the preset's accentRgb string (e.g. "244, 180, 60")
                    const { r, g, b } = rgbStringToComponents(
                        getThemePreset(presetId).accentRgb
                    );
                    setCustomColorR(r);
                    setCustomColorG(g);
                    setCustomColorB(b);
                } else if (event.type === "SESSION_THEME_UPDATED") {
                    const hex = event.payload.color;
                    setThemeColor(hex || null);
                    if (hex) {
                        // Derive RGB from hex color chosen via color picker
                        const parsed = hexToRgb(hex);
                        if (parsed) {
                            setCustomColorR(parsed.r);
                            setCustomColorG(parsed.g);
                            setCustomColorB(parsed.b);
                        }
                    } else {
                        // Color was reset — re-derive from current preset
                        const { r, g, b } = rgbStringToComponents(
                            getThemePreset(themePreset).accentRgb
                        );
                        setCustomColorR(r);
                        setCustomColorG(g);
                        setCustomColorB(b);
                    }
                }
            },
            (bulkEvents) => {
                const sorted = [...bulkEvents].reverse();

                const lastSessionUpdate = sorted.find(
                    (e) => e.type === "SESSION_NUMBER_UPDATED"
                );
                if (lastSessionUpdate) {
                    setSessionNumber((lastSessionUpdate.payload as any).number);
                }

                const lastBattlemap = sorted.find((e) => e.type === "BATTLEMAP_UPDATED");
                if (lastBattlemap && lastBattlemap.payload.isActive !== undefined) {
                    setBattlemapActive(lastBattlemap.payload.isActive);
                }
            }
        );

        const unsubscribeToolStore = battlemapToolStore.subscribe(() => {
            setShowToolbar(battlemapToolStore.showToolbar);
            setActiveTool(battlemapToolStore.activeTool);
            setPenColor(battlemapToolStore.penColor);
            setIsTheaterMode(battlemapToolStore.isTheaterMode);
        });

        return () => {
            unsubscribeStore();
            unsubscribeToolStore();
        };
    }, [sessionId]);
    // ── Note: themePreset is intentionally excluded from the dep array above.
    // The reset-to-preset branch of SESSION_THEME_UPDATED reads themePreset
    // via closure. Re-subscribing on every preset change would cause double
    // subscriptions; the value is always current at the moment the event fires
    // because React state updates are synchronous within a single render cycle
    // when triggered by the same subscriber call.

    // ── Actions ───────────────────────────────────────────────────────────
    const changeSessionNumber = (delta: number) => {
        const newNumber = Math.max(1, sessionNumber + delta);
        if (newNumber === sessionNumber) return;

        setSessionNumber(newNumber);

        globalEventStore.append({
            id: uuidv4(),
            sessionId: sessionId!,
            seq: 0,
            type: "SESSION_NUMBER_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { number: newNumber },
        } as any);
    };

    return {
        userRole,
        userId,
        characterId,
        sessionNumber,
        battlemapActive,
        showToolbar,
        activeTool,
        penColor,
        themePreset,
        themeColor,
        customColorR,
        customColorG,
        customColorB,
        isTheaterMode,
        changeSessionNumber,
    };
}
