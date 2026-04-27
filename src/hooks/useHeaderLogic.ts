"use client";

import { useEffect, useState } from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import { globalEventStore } from "@/lib/eventStore";
import { battlemapToolStore, Tool } from "@/lib/battlemapToolStore";
import { projectedStateStore } from "@/lib/projectedStateStore";
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
    const parts = rgbStr.split(",").map((s) => parseInt(s.trim(), 10));
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
    themeTitleColor: string | null;
    customTitleColorR: number;
    customTitleColorG: number;
    customTitleColorB: number;
    isTheaterMode: boolean;
    themeLocked: boolean;
    showLayersPanel: boolean;
    activeShape: import("@/lib/battlemapToolStore").BattlemapShapeKind;
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
    const [themeTitleColor, setThemeTitleColor] = useState<string | null>(null);
    const [customTitleColorR, setCustomTitleColorR] = useState(249);
    const [customTitleColorG, setCustomTitleColorG] = useState(231);
    const [customTitleColorB, setCustomTitleColorB] = useState(159);
    const [isTheaterMode, setIsTheaterMode] = useState(battlemapToolStore.isTheaterMode);
    const [showLayersPanel, setShowLayersPanel] = useState(battlemapToolStore.showLayersPanel);
    const [activeShape, setActiveShape] = useState(battlemapToolStore.activeShape);
    const [themeLocked, setThemeLocked] = useState(false);

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
            const currentRole = localStorage.getItem("userRole");
            if (currentRole !== "GM") {
                const stored = localStorage.getItem("characterId");
                if (stored) setCharacterId(stored);
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (characterId) return;
        if (!userId) return;
        if (!sessionId) return;

        const storedRole = localStorage.getItem("userRole");
        if (storedRole === "GM") return;

        const snapshot = globalEventStore.getSnapshotState();
        if (!snapshot?.characters) return;

        const norm = (s: string) => (s || "").trim().toLowerCase().normalize("NFC");
        const uidNorm = norm(userId);
        const matches = Object.values(snapshot.characters).filter((c) =>
            norm(c.ownerUserId) === uidNorm || norm(c.name) === uidNorm
        );

        if (matches.length === 1) {
            const detectedId = matches[0].id;
            setCharacterId(detectedId);
            localStorage.setItem("characterId", detectedId);
            console.info(`[useHeaderLogic] Auto-detect characterId: ${matches[0].name} (${detectedId})`);
        }
    }, [userId, characterId, sessionId]);

    useEffect(() => {
        if (!sessionId) return;

        const applyFromProjection = () => {
            const projected = projectedStateStore.getState();

            if (projected.sessionNumber !== undefined) {
                setSessionNumber(projected.sessionNumber);
            }
            if (projected.battlemap?.isActive !== undefined) {
                setBattlemapActive(projected.battlemap.isActive);
            }
            if (projected.themeLocked !== undefined) {
                setThemeLocked(projected.themeLocked);
            }

            const presetId = projected.themePreset || "medieval";
            setThemePreset(presetId);

            const resolvedThemeColor = projected.themeColor || null;
            setThemeColor(resolvedThemeColor);

            if (resolvedThemeColor) {
                const parsed = hexToRgb(resolvedThemeColor);
                if (parsed) {
                    setCustomColorR(parsed.r);
                    setCustomColorG(parsed.g);
                    setCustomColorB(parsed.b);
                }
            } else {
                const { r, g, b } = rgbStringToComponents(getThemePreset(presetId).accentRgb);
                setCustomColorR(r);
                setCustomColorG(g);
                setCustomColorB(b);
            }

            const resolvedTitleColor = projected.themeTitleColor || null;
            setThemeTitleColor(resolvedTitleColor);

            if (resolvedTitleColor) {
                const parsed = hexToRgb(resolvedTitleColor);
                if (parsed) {
                    setCustomTitleColorR(parsed.r);
                    setCustomTitleColorG(parsed.g);
                    setCustomTitleColorB(parsed.b);
                }
            } else {
                const { r, g, b } = rgbStringToComponents(getThemePreset(presetId).titleRgb);
                setCustomTitleColorR(r);
                setCustomTitleColorG(g);
                setCustomTitleColorB(b);
            }
        };

        applyFromProjection();
        const unsubscribeStore = projectedStateStore.subscribe(applyFromProjection);
        const unsubscribeToolStore = battlemapToolStore.subscribe(() => {
            setShowToolbar(battlemapToolStore.showToolbar);
            setActiveTool(battlemapToolStore.activeTool);
            setPenColor(battlemapToolStore.penColor);
            setIsTheaterMode(battlemapToolStore.isTheaterMode);
            setShowLayersPanel(battlemapToolStore.showLayersPanel);
            setActiveShape(battlemapToolStore.activeShape);
        });

        return () => {
            unsubscribeStore();
            unsubscribeToolStore();
        };
    }, [sessionId]);

    const changeSessionNumber = (delta: number) => {
        const newNumber = Math.max(1, sessionNumber + delta);
        if (newNumber === sessionNumber) return;

        const normalizedUserId = userId.trim().toLowerCase();
        if (!normalizedUserId) return;

        setSessionNumber(newNumber);

        globalEventStore.append({
            id: uuidv4(),
            sessionId: sessionId!,
            seq: 0,
            type: "SESSION_NUMBER_UPDATED",
            actorUserId: normalizedUserId,
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
        themeTitleColor,
        customTitleColorR,
        customTitleColorG,
        customTitleColorB,
        isTheaterMode,
        showLayersPanel,
        activeShape,
        themeLocked,
        changeSessionNumber,
    };
}
