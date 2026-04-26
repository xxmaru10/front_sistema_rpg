"use client";

import { useState, useEffect } from "react";
import { Lock, Palette } from "lucide-react";
import { globalEventStore } from "@/lib/eventStore";
import { THEME_LIST, getThemePreset } from "@/lib/themePresets";
import { v4 as uuidv4 } from "uuid";

interface ThemeSelectorProps {
    sessionId: string;
    userId: string;
    themePreset: string;
    themeColor: string | null;
    customColorR: number;
    customColorG: number;
    customColorB: number;
    themeTitleColor: string | null;
    customTitleColorR: number;
    customTitleColorG: number;
    customTitleColorB: number;
    isGM: boolean;
    themeLocked: boolean;
    onLocalUpdate?: () => void;
}

type LocalThemePreference = {
    preset?: string;
    color?: string;
};

function normalizeUserId(userId: string): string {
    return userId.trim().toLowerCase();
}

function getLocalThemeKey(sessionId: string, userId: string): string | null {
    const normalizedUserId = normalizeUserId(userId);
    if (!sessionId || !normalizedUserId) return null;
    return `cronos_local_theme_${sessionId}_${normalizedUserId}`;
}

function readLocalThemePreference(sessionId: string, userId: string): LocalThemePreference {
    const key = getLocalThemeKey(sessionId, userId);
    if (key) {
        const raw = localStorage.getItem(key);
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as LocalThemePreference;
                return {
                    preset: parsed.preset || undefined,
                    color: parsed.color || undefined,
                };
            } catch {
                // Fallback to legacy keys below.
            }
        }
    }

    const legacyPreset = localStorage.getItem(`theme_preset_${sessionId}`) || undefined;
    const legacyColor = localStorage.getItem(`theme_color_${sessionId}`) || undefined;
    return { preset: legacyPreset, color: legacyColor };
}

function writeLocalThemePreference(sessionId: string, userId: string, preference: LocalThemePreference) {
    const key = getLocalThemeKey(sessionId, userId);
    if (!key) return;

    const normalized: LocalThemePreference = {
        preset: preference.preset || undefined,
        color: preference.color || undefined,
    };

    if (!normalized.preset && !normalized.color) {
        localStorage.removeItem(key);
        return;
    }

    localStorage.setItem(key, JSON.stringify(normalized));
}

function getLocalTitleColorKey(sessionId: string, userId: string): string | null {
    const normalizedUserId = normalizeUserId(userId);
    if (!sessionId || !normalizedUserId) return null;
    return `cronos_local_theme_title_color_${sessionId}_${normalizedUserId}`;
}

export function ThemeSelector({
    sessionId,
    userId,
    themePreset,
    themeColor,
    customColorR,
    customColorG,
    customColorB,
    themeTitleColor,
    customTitleColorR,
    customTitleColorG,
    customTitleColorB,
    isGM,
    themeLocked,
    onLocalUpdate,
}: ThemeSelectorProps) {
    const [showPanel, setShowPanel] = useState(false);

    // Local Theme State (Players Only)
    const [localPreset, setLocalPreset] = useState<string | null>(null);
    const [localColor, setLocalColor] = useState<string | null>(null);
    const [localTitleColor, setLocalTitleColor] = useState<string | null>(null);

    const isPlayerLocked = themeLocked && !isGM;

    // Load from localStorage on mount and when user changes
    useEffect(() => {
        if (!isGM) {
            const pref = readLocalThemePreference(sessionId, userId);
            setLocalPreset(pref.preset || null);
            setLocalColor(pref.color || null);
            const titleKey = getLocalTitleColorKey(sessionId, userId);
            if (titleKey) setLocalTitleColor(localStorage.getItem(titleKey));
        }
    }, [isGM, sessionId, userId]);

    // Handle lock synchronization
    useEffect(() => {
        if (themeLocked && !isGM) {
            setShowPanel(false);
            setLocalPreset(null);
            setLocalColor(null);
            setLocalTitleColor(null);
        } else if (!themeLocked && !isGM) {
            const pref = readLocalThemePreference(sessionId, userId);
            setLocalPreset(pref.preset || null);
            setLocalColor(pref.color || null);
            const titleKey = getLocalTitleColorKey(sessionId, userId);
            if (titleKey) setLocalTitleColor(localStorage.getItem(titleKey));
        }
    }, [themeLocked, isGM, sessionId, userId]);

    const activePreset = !isGM && localPreset ? localPreset : themePreset;
    const activeColor = !isGM && localColor ? localColor : themeColor;

    const handlePresetChange = (presetId: string) => {
        const normalizedUserId = normalizeUserId(userId);
        if (!normalizedUserId) return;

        if (isGM) {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "SESSION_THEME_PRESET_UPDATED",
                actorUserId: normalizedUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { preset: presetId },
            } as any);
        } else if (!themeLocked) {
            setLocalPreset(presetId);
            writeLocalThemePreference(sessionId, userId, {
                preset: presetId,
                color: localColor || undefined,
            });
            onLocalUpdate?.();
        }
    };

    const handleColorChange = (hex: string) => {
        const normalizedUserId = normalizeUserId(userId);
        if (!normalizedUserId) return;

        if (isGM) {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "SESSION_THEME_UPDATED",
                actorUserId: normalizedUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { color: hex },
            } as any);
        } else if (!themeLocked) {
            const normalizedHex = hex || null;
            setLocalColor(normalizedHex);
            writeLocalThemePreference(sessionId, userId, {
                preset: localPreset || undefined,
                color: normalizedHex || undefined,
            });
            onLocalUpdate?.();
        }
    };

    const handleTitleColorChange = (hex: string) => {
        const normalizedUserId = normalizeUserId(userId);
        if (!normalizedUserId) return;

        if (isGM) {
            globalEventStore.append({
                id: uuidv4(),
                sessionId,
                seq: 0,
                type: "SESSION_THEME_TITLE_COLOR_UPDATED",
                actorUserId: normalizedUserId,
                createdAt: new Date().toISOString(),
                visibility: "PUBLIC",
                payload: { color: hex || null },
            } as any);
        } else if (!themeLocked) {
            const normalizedHex = hex || null;
            setLocalTitleColor(normalizedHex);
            const titleKey = getLocalTitleColorKey(sessionId, userId);
            if (titleKey) {
                if (normalizedHex) {
                    localStorage.setItem(titleKey, normalizedHex);
                } else {
                    localStorage.removeItem(titleKey);
                }
            }
            onLocalUpdate?.();
        }
    };

    const toggleLock = (locked: boolean) => {
        if (!isGM) return;
        const normalizedUserId = normalizeUserId(userId);
        if (!normalizedUserId) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "SESSION_THEME_LOCK_UPDATED",
            actorUserId: normalizedUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { locked },
        } as any);
    };

    return (
        <div style={{ position: "relative" }}>
            <button
                type="button"
                onClick={() => {
                    if (isPlayerLocked) return;
                    setShowPanel(!showPanel);
                }}
                title={isPlayerLocked ? "Tema bloqueado pelo Mestre" : "Abrir seletor de tema"}
                aria-disabled={isPlayerLocked}
                disabled={isPlayerLocked}
                style={{
                    background: showPanel
                        ? "var(--accent-color)"
                        : "rgba(var(--accent-rgb), 0.08)",
                    border: `1px solid ${showPanel ? "var(--accent-color)" : "rgba(var(--accent-rgb), 0.3)"}`,
                    color: showPanel ? "#000" : "var(--accent-color)",
                    fontSize: "0.65rem",
                    padding: "4px 10px",
                    cursor: isPlayerLocked ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-header)",
                    letterSpacing: "0.1em",
                    borderRadius: "var(--border-radius)",
                    transition: "all 0.3s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginLeft: "8px",
                    height: "32px",
                    opacity: isPlayerLocked ? 0.55 : 1,
                }}
            >
                <Palette size={14} />
                <span>{isPlayerLocked ? "TEMA BLOQUEADO" : "TEMA"}</span>
                {isPlayerLocked ? <Lock size={12} /> : null}
            </button>

            {showPanel && (
                <>
                    <div
                        onClick={() => setShowPanel(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 9999 }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: "calc(100% + 12px)",
                            left: 0,
                            zIndex: 10000,
                            background: "var(--bg-color, #0d0907)",
                            border: "1px solid rgba(var(--accent-rgb), 0.3)",
                            borderRadius: "var(--border-radius)",
                            boxShadow:
                                "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(var(--accent-rgb), 0.05)",
                            padding: "20px",
                            minWidth: "340px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                        }}
                    >
                        {/* Section: Presets */}
                        <div>
                            <div
                                style={{
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.65rem",
                                    letterSpacing: "0.2em",
                                    color: "var(--accent-color)",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid rgba(var(--accent-rgb), 0.15)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                }}
                            >
                                <span>PRESETS TEMATICOS</span>
                                <span
                                    onClick={() => setShowPanel(false)}
                                    style={{ cursor: "pointer", opacity: 0.5 }}
                                >
                                    x
                                </span>
                            </div>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(3, 1fr)",
                                    gap: "8px",
                                }}
                            >
                                {THEME_LIST.map((theme) => {
                                    const isActive = activePreset === theme.id;
                                    return (
                                        <button
                                            key={theme.id}
                                            title={theme.description}
                                            onClick={() => handlePresetChange(theme.id)}
                                            style={{
                                                background: isActive
                                                    ? `linear-gradient(135deg, ${theme.accentColor}, rgba(${theme.accentRgb}, 0.7))`
                                                    : `rgba(${theme.accentRgb}, 0.04)`,
                                                border: `1px solid ${isActive ? theme.accentColor : `rgba(${theme.accentRgb}, 0.2)`}`,
                                                color: isActive ? "#000" : theme.accentColor,
                                                fontSize: "0.6rem",
                                                padding: "10px 4px",
                                                cursor: isPlayerLocked ? "not-allowed" : "pointer",
                                                fontFamily: "var(--font-header)",
                                                letterSpacing: "0.05em",
                                                borderRadius: "4px",
                                                transition: "all 0.3s",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                gap: "6px",
                                                boxShadow: isActive
                                                    ? `0 0 15px rgba(${theme.accentRgb}, 0.2)`
                                                    : "none",
                                                transform: isActive ? "scale(1.03)" : "scale(1)",
                                                opacity: isPlayerLocked ? 0.5 : 1,
                                            }}
                                        >
                                            <span style={{ fontSize: "1.2rem" }}>{theme.icon}</span>
                                            <span>{theme.label.toUpperCase()}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Section: Custom Accent Color */}
                        <div>
                            <div
                                style={{
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.65rem",
                                    letterSpacing: "0.2em",
                                    color: "var(--accent-color)",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid rgba(var(--accent-rgb), 0.15)",
                                }}
                            >
                                COR GERAL
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                <input
                                    type="color"
                                    value={
                                        activeColor ||
                                        getThemePreset(activePreset as any).accentColor
                                    }
                                    disabled={isPlayerLocked}
                                    onChange={(e) => handleColorChange(e.target.value)}
                                    style={{
                                        width: "44px",
                                        height: "44px",
                                        border: "2px solid rgba(var(--accent-rgb), 0.3)",
                                        borderRadius: "6px",
                                        cursor: isPlayerLocked ? "not-allowed" : "pointer",
                                        background: "transparent",
                                        padding: 0,
                                    }}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: "center",
                                        flex: 1,
                                    }}
                                >
                                    {(["R", "G", "B"] as const).map((channel) => {
                                        const val =
                                            channel === "R"
                                                ? customColorR
                                                : channel === "G"
                                                ? customColorG
                                                : customColorB;
                                        const channelColor =
                                            channel === "R"
                                                ? "#ff6666"
                                                : channel === "G"
                                                ? "#66ff66"
                                                : "#6666ff";
                                        return (
                                            <div
                                                key={channel}
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    gap: "3px",
                                                    flex: 1,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontSize: "0.6rem",
                                                        color: channelColor,
                                                        fontFamily: "var(--font-header)",
                                                        letterSpacing: "0.1em",
                                                    }}
                                                >
                                                    {channel}
                                                </span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={255}
                                                    value={val}
                                                    onChange={(e) => {
                                                        if (isPlayerLocked) return;
                                                        const v = Math.max(
                                                            0,
                                                            Math.min(255, parseInt(e.target.value) || 0)
                                                        );
                                                        const r = channel === "R" ? v : customColorR;
                                                        const g = channel === "G" ? v : customColorG;
                                                        const b = channel === "B" ? v : customColorB;
                                                        const hex =
                                                            "#" +
                                                            [r, g, b]
                                                                .map((x) => x.toString(16).padStart(2, "0"))
                                                                .join("");
                                                        handleColorChange(hex);
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        background: "rgba(255,255,255,0.05)",
                                                        border: "1px solid rgba(var(--accent-rgb), 0.2)",
                                                        color: "#fff",
                                                        padding: "8px 4px",
                                                        fontSize: "0.8rem",
                                                        textAlign: "center",
                                                        fontFamily: "var(--font-main)",
                                                        outline: "none",
                                                        borderRadius: "4px",
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                {(isGM ? !!themeColor : !!localColor) && (
                                    <button
                                        title="Resetar para cor do preset"
                                        onClick={() => handleColorChange("")}
                                        style={{
                                            background: "rgba(255,100,100,0.1)",
                                            border: "1px solid rgba(255,100,100,0.3)",
                                            color: "#ff6666",
                                            fontSize: "0.8rem",
                                            padding: "8px 10px",
                                            cursor: "pointer",
                                            borderRadius: "4px",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        RESET
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Section: Title Color */}
                        <div>
                            <div
                                style={{
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.65rem",
                                    letterSpacing: "0.2em",
                                    color: "var(--accent-color)",
                                    marginBottom: "12px",
                                    paddingBottom: "8px",
                                    borderBottom: "1px solid rgba(var(--accent-rgb), 0.15)",
                                }}
                            >
                                COR DE TÍTULO
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <input
                                    type="color"
                                    value={
                                        (isGM ? themeTitleColor : localTitleColor) ||
                                        getThemePreset(activePreset as any).titleColor
                                    }
                                    disabled={isPlayerLocked}
                                    onChange={(e) => handleTitleColorChange(e.target.value)}
                                    style={{
                                        width: "44px",
                                        height: "44px",
                                        border: "2px solid rgba(var(--accent-rgb), 0.3)",
                                        borderRadius: "6px",
                                        cursor: isPlayerLocked ? "not-allowed" : "pointer",
                                        background: "transparent",
                                        padding: 0,
                                    }}
                                />
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", flex: 1 }}>
                                    {(["R", "G", "B"] as const).map((channel) => {
                                        const val =
                                            channel === "R"
                                                ? customTitleColorR
                                                : channel === "G"
                                                ? customTitleColorG
                                                : customTitleColorB;
                                        const channelColor =
                                            channel === "R" ? "#ff6666" : channel === "G" ? "#66ff66" : "#6666ff";
                                        return (
                                            <div
                                                key={channel}
                                                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flex: 1 }}
                                            >
                                                <span style={{ fontSize: "0.6rem", color: channelColor, fontFamily: "var(--font-header)", letterSpacing: "0.1em" }}>
                                                    {channel}
                                                </span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={255}
                                                    value={val}
                                                    onChange={(e) => {
                                                        if (isPlayerLocked) return;
                                                        const v = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                                                        const r = channel === "R" ? v : customTitleColorR;
                                                        const g = channel === "G" ? v : customTitleColorG;
                                                        const b = channel === "B" ? v : customTitleColorB;
                                                        const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
                                                        handleTitleColorChange(hex);
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        background: "rgba(255,255,255,0.05)",
                                                        border: "1px solid rgba(var(--accent-rgb), 0.2)",
                                                        color: "#fff",
                                                        padding: "8px 4px",
                                                        fontSize: "0.8rem",
                                                        textAlign: "center",
                                                        fontFamily: "var(--font-main)",
                                                        outline: "none",
                                                        borderRadius: "4px",
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                {(isGM ? !!themeTitleColor : !!localTitleColor) && (
                                    <button
                                        title="Resetar cor de título para o preset"
                                        onClick={() => handleTitleColorChange("")}
                                        style={{
                                            background: "rgba(255,100,100,0.1)",
                                            border: "1px solid rgba(255,100,100,0.3)",
                                            color: "#ff6666",
                                            fontSize: "0.8rem",
                                            padding: "8px 10px",
                                            cursor: "pointer",
                                            borderRadius: "4px",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        RESET
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Section: GM Focus (Lock) */}
                        {isGM && (
                            <div style={{ marginTop: "10px", borderTop: "1px solid rgba(var(--accent-rgb), 0.15)", paddingTop: "15px" }}>
                                <button
                                    onClick={() => toggleLock(!themeLocked)}
                                    style={{
                                        width: "100%",
                                        background: themeLocked ? "rgba(220, 50, 50, 0.15)" : "rgba(255, 255, 255, 0.03)",
                                        border: `1px solid ${themeLocked ? "#dc3232" : "rgba(var(--accent-rgb), 0.3)"}`,
                                        color: themeLocked ? "#ff6b6b" : "var(--accent-color)",
                                        fontSize: "0.6rem",
                                        padding: "10px",
                                        cursor: "pointer",
                                        fontFamily: "var(--font-header)",
                                        letterSpacing: "0.15em",
                                        borderRadius: "4px",
                                        transition: "all 0.3s",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "8px"
                                    }}
                                >
                                    <span style={{ fontSize: "1rem" }}>{themeLocked ? "🔒" : "🔓"}</span>
                                    <span>{themeLocked ? "DESBLOQUEAR TEMAS" : "FORCAR TEMA PARA TODOS (SOMENTE MESTRE)"}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
