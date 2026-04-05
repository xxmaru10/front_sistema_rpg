"use client";

/**
 * @file: src/components/AudioUnlockBanner.tsx
 * @summary: Banner não-modal fixado no canto inferior da tela, visível apenas para
 * jogadores (userRole === "PLAYER") enquanto o áudio da sessão não foi desbloqueado.
 * Ao clicar, chama audioUnlockManager.unlock() que: resume o AudioContext,
 * notifica MusicPlayer e AtmosphericPlayer para retentarem .play(), e desmuta
 * o vídeo do screen share.
 */

import { useEffect, useRef, useState } from "react";
import { audioUnlockManager } from "@/lib/audio-unlock-manager";

interface AudioUnlockBannerProps {
    userRole?: "GM" | "PLAYER";
}

export function AudioUnlockBanner({ userRole }: AudioUnlockBannerProps) {
    const [visible, setVisible] = useState(false);
    const [unlocking, setUnlocking] = useState(false);
    // Garante que o banner nunca reapareça na mesma sessão
    const dismissedRef = useRef(false);

    useEffect(() => {
        // Só mostra para jogadores e apenas se o áudio ainda não foi desbloqueado
        if (userRole !== "PLAYER") return;
        if (audioUnlockManager.isUnlocked) return;
        if (dismissedRef.current) return;

        setVisible(true);
    }, [userRole]);

    const handleUnlock = async () => {
        if (unlocking || dismissedRef.current) return;
        setUnlocking(true);
        try {
            await audioUnlockManager.unlock();
        } finally {
            dismissedRef.current = true;
            setUnlocking(false);
            setVisible(false);
        }
    };

    if (!visible) return null;

    return (
        <>
            <div
                className="audio-unlock-banner"
                role="alert"
                aria-live="polite"
            >
                <button
                    className={`audio-unlock-btn${unlocking ? " unlocking" : ""}`}
                    onClick={handleUnlock}
                    disabled={unlocking}
                    aria-label="Ativar áudio da sessão"
                >
                    <span className="banner-icon" aria-hidden="true">
                        {unlocking ? "⏳" : "🔇"}
                    </span>
                    <span className="banner-text">
                        {unlocking
                            ? "Ativando áudio..."
                            : "Clique aqui para ativar o áudio da sessão"}
                    </span>
                    <span className="banner-pulse" aria-hidden="true" />
                </button>
            </div>

            <style>{`
                .audio-unlock-banner {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9999;
                    pointer-events: none;
                    animation: banner-slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                }

                @keyframes banner-slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(24px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }

                .audio-unlock-btn {
                    pointer-events: all;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 20px;
                    background: rgba(10, 10, 14, 0.92);
                    border: 1px solid rgba(197, 160, 89, 0.55);
                    border-radius: 8px;
                    color: #e0bb6b;
                    font-size: 0.85rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    backdrop-filter: blur(12px);
                    box-shadow:
                        0 4px 24px rgba(0, 0, 0, 0.6),
                        0 0 0 1px rgba(197, 160, 89, 0.1),
                        inset 0 1px 0 rgba(255, 255, 255, 0.04);
                    transition:
                        background 0.2s,
                        border-color 0.2s,
                        box-shadow 0.2s,
                        transform 0.15s;
                    white-space: nowrap;
                    position: relative;
                    overflow: hidden;
                }

                .audio-unlock-btn:not(:disabled):hover {
                    background: rgba(20, 18, 10, 0.96);
                    border-color: rgba(197, 160, 89, 0.85);
                    box-shadow:
                        0 6px 32px rgba(0, 0, 0, 0.7),
                        0 0 16px rgba(197, 160, 89, 0.12),
                        inset 0 1px 0 rgba(255, 255, 255, 0.06);
                    transform: translateY(-1px);
                }

                .audio-unlock-btn:not(:disabled):active {
                    transform: translateY(0px) scale(0.99);
                }

                .audio-unlock-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .audio-unlock-btn.unlocking {
                    border-color: rgba(197, 160, 89, 0.4);
                }

                .banner-icon {
                    font-size: 1.1rem;
                    line-height: 1;
                    flex-shrink: 0;
                }

                .banner-text {
                    line-height: 1.2;
                }

                /* Animated shimmer pulse on the button border */
                .banner-pulse {
                    position: absolute;
                    inset: 0;
                    border-radius: 8px;
                    animation: banner-glow 2.4s ease-in-out infinite;
                    pointer-events: none;
                }

                @keyframes banner-glow {
                    0%, 100% {
                        box-shadow: inset 0 0 0 1px rgba(197, 160, 89, 0);
                    }
                    50% {
                        box-shadow: inset 0 0 0 1px rgba(197, 160, 89, 0.35);
                    }
                }
            `}</style>
        </>
    );
}
