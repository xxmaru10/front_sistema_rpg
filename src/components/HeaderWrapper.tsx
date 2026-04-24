"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { VoiceChatPanel } from "@/components/VoiceChatPanel";
import { TextChatPanel } from "@/components/TextChatPanel";
import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Volume2, StickyNote, RefreshCw } from "lucide-react";
import { floatingNotesStore } from "@/lib/floatingNotesStore";
import { screenShareStore } from "@/lib/screenShareStore";
import { useHeaderLogic } from "@/hooks/useHeaderLogic";
import { ThemeSelector } from "@/components/header/ThemeSelector";
import { BattlemapToolbar } from "@/components/header/BattlemapToolbar";
import { UnifiedSoundPanel } from "@/components/header/UnifiedSoundPanel";
import { generateThemeCSS, getThemePreset } from "@/lib/themePresets";
import { logStory59 } from "@/lib/story59Debug";

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
                // Ignore parse errors and fallback to legacy storage keys.
            }
        }
    }

    const legacyPreset = localStorage.getItem(`theme_preset_${sessionId}`) || undefined;
    const legacyColor = localStorage.getItem(`theme_color_${sessionId}`) || undefined;
    return { preset: legacyPreset, color: legacyColor };
}

export function HeaderWrapper() {
    const pathname = usePathname();
    const params = useParams();
    const searchParams = useSearchParams();
    const sessionId = params?.id as string;

    const [showSoundPanel, setShowSoundPanel] = useState(false);
    const [hasScreenShare, setHasScreenShare] = useState(false);
    const [isMobileHeader, setIsMobileHeader] = useState(false);
    const renderCountRef = useRef(0);

    renderCountRef.current += 1;

    useEffect(() => {
        logStory59("HeaderWrapper", "mount", { sessionId: sessionId || "none" });
        return () => logStory59("HeaderWrapper", "unmount", { sessionId: sessionId || "none" });
    }, [sessionId]);

    useEffect(() => {
        logStory59("HeaderWrapper", "render", {
            count: renderCountRef.current,
            hasScreenShare,
            showSoundPanel,
            isMobileHeader,
        });
    });

    useEffect(() => {
        const media = window.matchMedia("(max-width: 768px)");
        const sync = () => setIsMobileHeader(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        const unsub = screenShareStore.subscribe(() => {
            setHasScreenShare(screenShareStore.hasStream);
        });
        return unsub;
    }, []);

    const {
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
        themeLocked,
        changeSessionNumber,
    } = useHeaderLogic(sessionId, searchParams);

    const [localUpdateKey, setLocalUpdateKey] = useState(0);
    const isGM = userRole === "GM";

    useEffect(() => {
        if (sessionId && userId) {
            floatingNotesStore.init(sessionId, userId);
        }
    }, [sessionId, userId]);

    // ─── Local Theme Override Injection ───
    useEffect(() => {
        if (isGM || !sessionId || themeLocked) {
            const el = document.getElementById("theme-player-override");
            if (el) el.remove();
            return;
        }

        const localThemeKey = getLocalThemeKey(sessionId, userId);
        if (!localThemeKey) {
            const el = document.getElementById("theme-player-override");
            if (el) el.remove();
            return;
        }
        const { preset: localPreset, color: localColor } = readLocalThemePreference(sessionId, userId);

        if (!localPreset && !localColor) {
            const el = document.getElementById("theme-player-override");
            if (el) el.remove();
            return;
        }

        const theme = getThemePreset((localPreset as any) || themePreset);
        let css = generateThemeCSS(theme);

        if (localColor) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(localColor);
            if (result) {
                const r = parseInt(result[1], 16);
                const g = parseInt(result[2], 16);
                const b = parseInt(result[3], 16);
                css += `
                    :root {
                        --accent-color: ${localColor} !important;
                        --accent-rgb: ${r}, ${g}, ${b} !important;
                        --accent-glow: ${localColor}4D !important;
                        --border-color: rgba(${r}, ${g}, ${b}, 0.2) !important;
                        --ornament-glow: 0 0 15px rgba(${r}, ${g}, ${b}, 0.15) !important;
                        --theme-modal-border: ${localColor} !important;
                        --theme-scrollbar-thumb: rgba(${r}, ${g}, ${b}, 0.2) !important;
                        --gold-gradient: linear-gradient(135deg, ${localColor} 0%, rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 1) 50%, ${localColor} 100%) !important;
                    }
                `;
            }
        }

        let styleEl = document.getElementById("theme-player-override") as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = "theme-player-override";
            document.head.appendChild(styleEl);
        }

        if (styleEl.textContent !== css) {
            styleEl.textContent = css;
        }
        // Keep this style as the last <head> child so it overrides session theme styles.
        document.head.appendChild(styleEl);
    }, [isGM, sessionId, userId, localUpdateKey, themePreset, themeLocked]);
    // Note: themeLocked is a dependency here so that if the GM locks it, 
    // the effect re-runs, localStorage is cleared by ThemeSelector(or here), 
    // and the override is removed.

    if (pathname === "/") {
        return null;
    }

    return (
        <header className={`main-header ${isTheaterMode ? "theater-mode" : ""}`}>
            <div className="container header-content">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <h1>{sessionId ? `Sessão: ${sessionNumber}` : "Cronos Vtt"}</h1>
                    {sessionId && isGM && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                }}
                            >
                                <button
                                    onClick={() => changeSessionNumber(1)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#ccc",
                                        cursor: "pointer",
                                        padding: 0,
                                    }}
                                    aria-label="Aumentar sessão"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    onClick={() => changeSessionNumber(-1)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        color: "#ccc",
                                        cursor: "pointer",
                                        padding: 0,
                                    }}
                                    aria-label="Diminuir sessão"
                                    disabled={sessionNumber <= 1}
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                    {sessionId && (
                        <ThemeSelector
                            sessionId={sessionId}
                            userId={userId}
                            themePreset={themePreset}
                            themeColor={themeColor}
                            customColorR={customColorR}
                            customColorG={customColorG}
                            customColorB={customColorB}
                            isGM={isGM}
                            themeLocked={themeLocked}
                            onLocalUpdate={() => setLocalUpdateKey(k => k + 1)}
                        />
                    )}
                </div>

                {sessionId && (
                    <div
                        className="header-extras"
                        style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            position: "relative",
                        }}
                    >
                        <button
                            className={`player-toggle unified-sound-toggle ${showSoundPanel ? "playing" : ""}`}
                            onClick={() => setShowSoundPanel(!showSoundPanel)}
                            title="Painel de Som e Transmissão"
                        >
                            <Volume2 size={16} />
                        </button>

                        <button
                            className="player-toggle unified-sound-toggle notes-toggle"
                            onClick={() => floatingNotesStore.createNote()}
                            title="Nova Nota Flutuante (Post-it)"
                        >
                            <StickyNote size={16} />
                        </button>

                        {hasScreenShare && (
                            <button
                                className="player-toggle unified-sound-toggle screenshare-reconnect-toggle"
                                onClick={() => screenShareStore.triggerReconnect()}
                                title="Reconectar transmissão"
                            >
                                <RefreshCw size={16} />
                            </button>
                        )}

                        {battlemapActive && (
                            <BattlemapToolbar
                                sessionId={sessionId}
                                userId={userId}
                                userRole={userRole}
                                showToolbar={showToolbar}
                                activeTool={activeTool}
                                penColor={penColor}
                                isTheaterMode={isTheaterMode}
                            />
                        )}

                        <UnifiedSoundPanel
                            sessionId={sessionId}
                            userId={userId}
                            userRole={userRole}
                            isOpen={showSoundPanel}
                        />
                    </div>
                )}

                <div
                    className="user-nav"
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                    {sessionId && userId && (
                        <>
                            <TextChatPanel
                                sessionId={sessionId}
                                userId={userId}
                                userRole={userRole}
                            />
                            <VoiceChatPanel
                                sessionId={sessionId}
                                userId={userId}
                                characterId={characterId}
                                isMobile={isMobileHeader}
                            />
                        </>
                    )}
                    <Link href="/" className="logout-btn">
                        <LogOut size={14} />
                        <span>Sair</span>
                    </Link>
                </div>
            </div>

            <style jsx>{`
                .unified-sound-toggle {
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: #ccc;
                    width: 36px;
                    height: 36px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }

                .unified-sound-toggle:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: #fff;
                    color: #fff;
                }

                .unified-sound-toggle.playing {
                    border-color: #e0bb6b;
                    color: #e0bb6b;
                    background: rgba(197, 160, 89, 0.1);
                    box-shadow: 0 0 5px rgba(197, 160, 89, 0.2);
                }

                .notes-toggle {
                    color: #fef08a;
                    border-color: rgba(254, 240, 138, 0.35);
                }

                .notes-toggle:hover {
                    color: #fef08a;
                    border-color: #fef08a;
                    background: rgba(254, 240, 138, 0.1);
                }

                .screenshare-reconnect-toggle {
                    color: #6edc80;
                    border-color: rgba(110, 220, 128, 0.35);
                }

                .screenshare-reconnect-toggle:hover {
                    color: #6edc80;
                    border-color: #6edc80;
                    background: rgba(110, 220, 128, 0.1);
                }

                .theater-mode .container.header-content > *:not(.header-extras) {
                    visibility: hidden;
                    pointer-events: none;
                }
                .theater-mode .header-extras > *:not(.battlemap-toolbar-container) {
                    display: none;
                }
                .theater-mode {
                    background: transparent !important;
                    border-bottom: none !important;
                    backdrop-filter: none !important;
                }
            `}</style>
        </header>
    );
}
