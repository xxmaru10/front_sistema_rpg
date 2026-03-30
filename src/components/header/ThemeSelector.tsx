"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
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
}

export function ThemeSelector({
    sessionId,
    userId,
    themePreset,
    themeColor,
    customColorR,
    customColorG,
    customColorB,
}: ThemeSelectorProps) {
    const [showPanel, setShowPanel] = useState(false);

    return (
        <div style={{ position: "relative" }}>
            <button
                onClick={() => setShowPanel(!showPanel)}
                style={{
                    background: showPanel
                        ? "var(--accent-color)"
                        : "rgba(var(--accent-rgb), 0.08)",
                    border: `1px solid ${showPanel ? "var(--accent-color)" : "rgba(var(--accent-rgb), 0.3)"}`,
                    color: showPanel ? "#000" : "var(--accent-color)",
                    fontSize: "0.65rem",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontFamily: "var(--font-header)",
                    letterSpacing: "0.1em",
                    borderRadius: "var(--border-radius)",
                    transition: "all 0.3s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginLeft: "8px",
                    height: "32px",
                }}
            >
                <Palette size={14} />
                <span>TEMA</span>
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
                                <span>⚜ PRESETS TEMÁTICOS</span>
                                <span
                                    onClick={() => setShowPanel(false)}
                                    style={{ cursor: "pointer", opacity: 0.5 }}
                                >
                                    ✕
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
                                    const isActive = themePreset === theme.id;
                                    return (
                                        <button
                                            key={theme.id}
                                            title={theme.description}
                                            onClick={() => {
                                                globalEventStore.append({
                                                    id: uuidv4(),
                                                    sessionId,
                                                    seq: 0,
                                                    type: "SESSION_THEME_PRESET_UPDATED",
                                                    actorUserId: userId,
                                                    createdAt: new Date().toISOString(),
                                                    visibility: "PUBLIC",
                                                    payload: { preset: theme.id },
                                                } as any);
                                            }}
                                            style={{
                                                background: isActive
                                                    ? `linear-gradient(135deg, ${theme.accentColor}, rgba(${theme.accentRgb}, 0.7))`
                                                    : `rgba(${theme.accentRgb}, 0.04)`,
                                                border: `1px solid ${isActive ? theme.accentColor : `rgba(${theme.accentRgb}, 0.2)`}`,
                                                color: isActive ? "#000" : theme.accentColor,
                                                fontSize: "0.6rem",
                                                padding: "10px 4px",
                                                cursor: "pointer",
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
                                🎨 COR PERSONALIZADA
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
                                        themeColor ||
                                        getThemePreset(themePreset as any).accentColor
                                    }
                                    onChange={(e) => {
                                        const hex = e.target.value;
                                        globalEventStore.append({
                                            id: uuidv4(),
                                            sessionId,
                                            seq: 0,
                                            type: "SESSION_THEME_UPDATED",
                                            actorUserId: userId,
                                            createdAt: new Date().toISOString(),
                                            visibility: "PUBLIC",
                                            payload: { color: hex },
                                        } as any);
                                    }}
                                    style={{
                                        width: "44px",
                                        height: "44px",
                                        border: "2px solid rgba(var(--accent-rgb), 0.3)",
                                        borderRadius: "6px",
                                        cursor: "pointer",
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
                                                        globalEventStore.append({
                                                            id: uuidv4(),
                                                            sessionId,
                                                            seq: 0,
                                                            type: "SESSION_THEME_UPDATED",
                                                            actorUserId: userId,
                                                            createdAt: new Date().toISOString(),
                                                            visibility: "PUBLIC",
                                                            payload: { color: hex },
                                                        } as any);
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
                                {themeColor && (
                                    <button
                                        title="Resetar para cor do preset"
                                        onClick={() => {
                                            globalEventStore.append({
                                                id: uuidv4(),
                                                sessionId,
                                                seq: 0,
                                                type: "SESSION_THEME_UPDATED",
                                                actorUserId: userId,
                                                createdAt: new Date().toISOString(),
                                                visibility: "PUBLIC",
                                                payload: { color: "" },
                                            } as any);
                                        }}
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
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
