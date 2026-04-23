"use client";

import { memo, useEffect, useRef } from "react";
import { MusicPlayer } from "@/components/MusicPlayer";
import { AtmosphericPlayer } from "@/components/AtmosphericPlayer";
import { TransmissionPlayer } from "@/components/TransmissionPlayer";
import { logStory59 } from "@/lib/story59Debug";

interface UnifiedSoundPanelProps {
    sessionId: string;
    userId: string;
    userRole: "GM" | "PLAYER";
    isOpen: boolean;
}

function UnifiedSoundPanelComponent({
    sessionId,
    userId,
    userRole,
    isOpen,
}: UnifiedSoundPanelProps) {
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;

    useEffect(() => {
        logStory59("UnifiedSoundPanel", "mount", { sessionId, userId, userRole });
        return () => logStory59("UnifiedSoundPanel", "unmount", { sessionId, userId, userRole });
    }, [sessionId, userId, userRole]);

    useEffect(() => {
        logStory59("UnifiedSoundPanel", "render", {
            count: renderCountRef.current,
            isOpen,
        });
    });

    return (
        <div className={`unified-sound-panel ${isOpen ? "show" : ""}`}>
            <TransmissionPlayer
                sessionId={sessionId}
                userId={userId}
                userRole={userRole}
                unifiedMode={true}
            />
            <AtmosphericPlayer
                sessionId={sessionId}
                userId={userId}
                userRole={userRole}
                unifiedMode={true}
            />
            <MusicPlayer
                sessionId={sessionId}
                userId={userId}
                userRole={userRole}
                unifiedMode={true}
            />

            <style jsx>{`
                .unified-sound-panel {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 10px;
                    background: rgba(10, 10, 10, 0.95);
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    padding: 12px;
                    border-radius: 8px;
                    width: 280px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8),
                        0 0 15px rgba(197, 160, 89, 0.1);
                    z-index: 1000;
                    display: none;
                    flex-direction: column;
                    gap: 12px;
                    backdrop-filter: blur(10px);
                }

                .unified-sound-panel.show {
                    display: flex;
                    animation: panel-fade-in 0.2s ease-out;
                }

                @keyframes panel-fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Slider thumbs — must stay :global() to override browser defaults */
                :global(.unified-sound-panel .volume-slider),
                :global(.unified-sound-panel .volume-slider.atmos),
                :global(.unified-sound-panel .volume-slider.trans) {
                    -webkit-appearance: none !important;
                    flex: 1 !important;
                    height: 5px !important;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px !important;
                    outline: none !important;
                    margin: 0 !important;
                    cursor: pointer !important;
                }

                :global(.unified-sound-panel .volume-slider::-webkit-slider-thumb),
                :global(.unified-sound-panel .volume-slider.atmos::-webkit-slider-thumb),
                :global(.unified-sound-panel .volume-slider.trans::-webkit-slider-thumb) {
                    -webkit-appearance: none !important;
                    appearance: none !important;
                    width: 14px !important;
                    height: 14px !important;
                    border-radius: 50% !important;
                    background: var(--accent-color, #c5a059) !important;
                    cursor: pointer !important;
                    border: 2px solid #000 !important;
                    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5) !important;
                    transition: all 0.2s ease !important;
                }

                :global(.unified-sound-panel .volume-slider::-webkit-slider-thumb:hover) {
                    transform: scale(1.2) !important;
                    box-shadow: 0 0 8px rgba(197, 160, 89, 0.5) !important;
                }

                /* Select overrides — must stay :global() to override library defaults */
                :global(.unified-sound-panel .track-select) {
                    background: rgba(20, 20, 20, 0.8) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    border-radius: 4px !important;
                    color: #ddd !important;
                    padding: 6px 8px !important;
                    font-size: 0.7rem !important;
                    width: 100% !important;
                    outline: none !important;
                    transition: border-color 0.2s !important;
                    cursor: pointer !important;
                }

                :global(.unified-sound-panel .track-select:hover) {
                    border-color: rgba(197, 160, 89, 0.5) !important;
                }

                :global(.unified-sound-panel .volume-horizontal) {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    flex-wrap: nowrap !important;
                    gap: 8px !important;
                    width: 100% !important;
                }

                :global(.unified-sound-panel .mute-btn-premium) {
                    background: rgba(197, 160, 89, 0.05) !important;
                    border: 1px solid rgba(197, 160, 89, 0.25) !important;
                    color: var(--accent-color, #c5a059) !important;
                    flex-shrink: 0 !important;
                }

                :global(.unified-sound-panel .mute-btn-premium:hover) {
                    background: rgba(197, 160, 89, 0.15) !important;
                    border-color: var(--accent-color, #c5a059) !important;
                }

                :global(.unified-sound-panel .volume-val-badge) {
                    background: rgba(40, 40, 40, 0.4) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    color: var(--accent-color, #c5a059) !important;
                    font-size: 0.7rem !important;
                    width: 34px !important;
                    height: 22px !important;
                    padding: 0 !important;
                    display: inline-block !important;
                    text-align: center !important;
                    vertical-align: middle !important;
                    flex-shrink: 0 !important;
                    border-radius: 4px !important;
                    outline: none !important;
                    cursor: text !important;
                    transition: all 0.2s !important;
                    -moz-appearance: textfield !important;
                    font-family: "JetBrains Mono", monospace !important;
                    font-weight: bold !important;
                }

                :global(.unified-sound-panel .volume-val-badge::-webkit-outer-spin-button),
                :global(.unified-sound-panel .volume-val-badge::-webkit-inner-spin-button) {
                    -webkit-appearance: none !important;
                    margin: 0 !important;
                }

                :global(.unified-sound-panel .volume-val-badge:focus) {
                    background: rgba(60, 60, 60, 0.6) !important;
                    border-color: var(--accent-color, #c5a059) !important;
                    box-shadow: 0 0 5px rgba(197, 160, 89, 0.3) !important;
                }
            `}</style>
        </div>
    );
}

function areUnifiedSoundPanelPropsEqual(prev: UnifiedSoundPanelProps, next: UnifiedSoundPanelProps): boolean {
    return (
        prev.sessionId === next.sessionId &&
        prev.userId === next.userId &&
        prev.userRole === next.userRole &&
        prev.isOpen === next.isOpen
    );
}

export const UnifiedSoundPanel = memo(UnifiedSoundPanelComponent, areUnifiedSoundPanelPropsEqual);
UnifiedSoundPanel.displayName = "UnifiedSoundPanel";
