"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { VoiceChatPanel } from "@/components/VoiceChatPanel";
import { TextChatPanel } from "@/components/TextChatPanel";
import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Volume2, StickyNote, RefreshCw } from "lucide-react";
import { floatingNotesStore } from "@/lib/floatingNotesStore";
import { screenShareStore } from "@/lib/screenShareStore";
import { useHeaderLogic } from "@/hooks/useHeaderLogic";
import { ThemeSelector } from "@/components/header/ThemeSelector";
import { BattlemapToolbar } from "@/components/header/BattlemapToolbar";
import { UnifiedSoundPanel } from "@/components/header/UnifiedSoundPanel";

export function HeaderWrapper() {
    const pathname = usePathname();
    const params = useParams();
    const searchParams = useSearchParams();
    const sessionId = params?.id as string;

    const [showSoundPanel, setShowSoundPanel] = useState(false);
    const [hasScreenShare, setHasScreenShare] = useState(false);

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
        changeSessionNumber,
    } = useHeaderLogic(sessionId, searchParams);

    useEffect(() => {
        if (sessionId && userId) {
            floatingNotesStore.init(sessionId, userId);
        }
    }, [sessionId, userId]);

    if (pathname === "/") {
        return null;
    }

    return (
        <header className={`main-header ${isTheaterMode ? "theater-mode" : ""}`}>
            <div className="container header-content">
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <h1>{sessionId ? `Sessão: ${sessionNumber}` : "Cronos Vtt"}</h1>
                    {sessionId && userRole === "GM" && (
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

                            <ThemeSelector
                                sessionId={sessionId}
                                userId={userId}
                                themePreset={themePreset}
                                themeColor={themeColor}
                                customColorR={customColorR}
                                customColorG={customColorG}
                                customColorB={customColorB}
                            />
                        </div>
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
                            <TextChatPanel sessionId={sessionId} userId={userId} />
                            <VoiceChatPanel
                                sessionId={sessionId}
                                userId={userId}
                                characterId={characterId}
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
