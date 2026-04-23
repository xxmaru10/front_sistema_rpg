/**
 * @file: src/app/session/[id]/hooks/useSessionScreenControl.ts
 * @summary: Manages the ScreenShareManager WebRTC lifecycle, video srcObject
 * assignment, and BroadcastChannel/localStorage volume synchronisation.
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ScreenShareManager } from "@/lib/screen-share-manager";
import { screenShareStore } from "@/lib/screenShareStore";

interface UseSessionScreenControlParams {
    sessionId: string;
    actorUserId: string;
    videoStream: MediaStream | null;
    setVideoStream: (stream: MediaStream | null) => void;
    spectatorMode: boolean;
    setSpectatorMode: (v: boolean) => void;
    activeTab: string;
    transmissionVolume: number;
    setTransmissionVolume: (v: number) => void;
}

export function useSessionScreenControl({
    sessionId,
    actorUserId,
    videoStream,
    setVideoStream,
    spectatorMode,
    setSpectatorMode,
    activeTab,
    transmissionVolume,
    setTransmissionVolume,
}: UseSessionScreenControlParams) {

    const screenVideoRef = useRef<HTMLVideoElement | null>(null);
    const screenShareManagerRef = useRef<ScreenShareManager | null>(null);
    const lastHandledReconnectVersionRef = useRef(0);
    const lastHandledTry1080VersionRef = useRef(0);
    const lastVisibilityReconnectAtRef = useRef(0);
    const videoStreamRef = useRef<MediaStream | null>(videoStream);
    const [videoNoSignal, setVideoNoSignal] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);

    useEffect(() => {
        videoStreamRef.current = videoStream;
    }, [videoStream]);

    // ── Screen share manager lifecycle ──────────────────────────
    useEffect(() => {
        if (!sessionId || !actorUserId) return;
        const timer = setTimeout(() => {
            if (!screenShareManagerRef.current) {
                const manager = new ScreenShareManager(
                    sessionId,
                    actorUserId,
                    (stream) => {
                        setVideoStream(stream);
                        screenShareStore.setHasStream(!!stream);
                    }
                );
                manager.initialize();
                screenShareManagerRef.current = manager;
            }
        }, 300);
        return () => {
            clearTimeout(timer);
            if (screenShareManagerRef.current) {
                const mgr = screenShareManagerRef.current;
                screenShareManagerRef.current = null;
                setTimeout(() => mgr.disconnect(), 200);
            }
            screenShareStore.setHasStream(false);
        };
    }, [sessionId, actorUserId, setVideoStream]);

    useEffect(() => {
        const videoEl = screenVideoRef.current;
        if (!videoEl || !videoStream) return;

        const isBroadcasting = screenShareManagerRef.current?.broadcasting ?? false;
        if (isBroadcasting) {
            videoEl.muted = true;
            console.log("[ScreenShare] Broadcaster — own audio muted to prevent feedback");
        }
    }, [videoStream]);

    // ── Broadcast flag: local user sharing tab audio (loopback guard) ───────
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const isBroadcasting = screenShareManagerRef.current?.broadcasting ?? false;
        const hasAudioTrack = !!videoStream?.getAudioTracks?.().length;
        const active = isBroadcasting && hasAudioTrack;

        window.dispatchEvent(
            new CustomEvent('screenshare:broadcast-audio', { detail: { active } })
        );

        return () => {
            window.dispatchEvent(
                new CustomEvent('screenshare:broadcast-audio', { detail: { active: false } })
            );
        };
    }, [videoStream, sessionId, actorUserId]);

    // ── Global reconnect trigger ─────────────────────────────────
    useEffect(() => {
        const unsubscribe = screenShareStore.subscribe(() => {
            if (screenShareStore.reconnectVersion > lastHandledReconnectVersionRef.current) {
                lastHandledReconnectVersionRef.current = screenShareStore.reconnectVersion;
                console.log("[WebRTC] Reconnect triggered from Header.");
                screenShareManagerRef.current?.reconnect();
            }
            if (screenShareStore.retry1080Version > lastHandledTry1080VersionRef.current) {
                lastHandledTry1080VersionRef.current = screenShareStore.retry1080Version;
                screenShareManagerRef.current?.tryRestore1080p();
            }
        });
        return unsubscribe;
    }, []);

    // ── Auto-exit spectator mode when stream ends ────────────────
    useEffect(() => {
        if (!videoStream && spectatorMode) setSpectatorMode(false);
    }, [videoStream, spectatorMode]);

    // ── Unmute helper — callable from UI ────────────────────────
    const unmuteVideo = useCallback(() => {
        const videoEl = screenVideoRef.current;
        if (!videoEl) return;
        videoEl.muted = false;
        videoEl.volume = transmissionVolume > 0 ? transmissionVolume : 1;
        setVideoMuted(false);
        console.log("[ScreenShare] Manually unmuted by user");
    }, [transmissionVolume]);

    // ── Assign video srcObject + smart play with unmute ──────────
    useEffect(() => {
        const videoEl = screenVideoRef.current;
        if (!videoEl) return;

        if (videoStream) {
            if (videoEl.srcObject !== videoStream) {
                videoEl.srcObject = videoStream;
                // Always start unmuted — browser will throw if autoplay policy
                // blocks it, then we fall back to muted
                videoEl.muted = false;
                videoEl.volume = transmissionVolume > 0 ? transmissionVolume : 1;
            }

            const tryPlay = async () => {
                try {
                    videoEl.muted = false;
                    await videoEl.play();
                    // If we are the broadcaster, mute our own audio to avoid feedback
                    const isBroadcasting = screenShareManagerRef.current?.broadcasting ?? false;
                    if (isBroadcasting) {
                        videoEl.muted = true;
                        console.log("[ScreenShare] Broadcaster — muted own audio to prevent feedback");
                    } else {
                        setVideoMuted(false);
                        console.log("[ScreenShare] Play success with audio");
                    }
                } catch (err) {
                    console.warn("[ScreenShare] Autoplay with audio blocked, retrying muted...", err);
                    videoEl.muted = true;
                    setVideoMuted(true);
                    try {
                        await videoEl.play();
                        console.log("[ScreenShare] Play success (muted fallback) — user must click unmute");

                        // Attempt auto-unmute after 500ms — works if user has
                        // already interacted with the page (clicked join, etc.)
                        setTimeout(() => {
                            if (!videoEl || videoEl.paused) return;
                            videoEl.muted = false;
                            videoEl.volume = transmissionVolume > 0 ? transmissionVolume : 1;
                            setVideoMuted(false);
                            console.log("[ScreenShare] Auto-unmuted successfully");
                        }, 500);
                    } catch (mutedErr) {
                        console.error("[ScreenShare] Muted play also failed:", mutedErr);
                        setVideoNoSignal(true);
                    }
                }
            };
            tryPlay();

            const clearNoSignal = () => {
                setVideoNoSignal(false);
                // Also try to unmute when video starts decoding frames —
                // this is a reliable signal that the user has interacted
                const el = screenVideoRef.current;
                if (el && el.muted) {
                    el.muted = false;
                    el.volume = transmissionVolume > 0 ? transmissionVolume : 1;
                    setVideoMuted(false);
                    console.log("[ScreenShare] Unmuted on canplay event");
                }
            };
            videoEl.addEventListener('canplay', clearNoSignal, { once: true });
            return () => videoEl.removeEventListener('canplay', clearNoSignal);
        } else {
            videoEl.srcObject = null;
            setVideoMuted(false);
        }
    }, [videoStream, activeTab, spectatorMode]);

    // ── Watchdog: show badge if video stalls for 10s ─────────────
    useEffect(() => {
        if (!videoStream) {
            setVideoNoSignal(false);
            return;
        }
        setVideoNoSignal(false);
        const timeout = setTimeout(() => {
            const el = screenVideoRef.current;
            if (!el || el.readyState >= 3) return;
            el.muted = true;
            el.play()
                .then(() => {
                    setVideoMuted(true);
                    // Try auto-unmute
                    setTimeout(() => {
                        if (el && !el.paused) {
                            el.muted = false;
                            setVideoMuted(false);
                        }
                    }, 500);
                })
                .catch(() => setVideoNoSignal(true));
        }, 10000);
        return () => clearTimeout(timeout);
    }, [videoStream]);

    // ── Diagnostics (Brave / HTTP) ───────────────────────────────
    useEffect(() => {
        const checkDiagnostics = async () => {
            const isSecure = window.isSecureContext;
            const isBrave = !!(navigator as any).brave && await (navigator as any).brave.isBrave();
            if (!isSecure) {
                console.error("[WebRTC Diagnosis] INSECURE CONTEXT (HTTP). WebRTC will be blocked on mobile.");
            }
            if (isBrave) {
                console.info("[WebRTC Diagnosis] Brave detected. Disable Shields if screen is black.");
            }
        };
        checkDiagnostics();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                const now = Date.now();
                if (now - lastVisibilityReconnectAtRef.current > 8000) {
                    lastVisibilityReconnectAtRef.current = now;
                    const el = screenVideoRef.current;
                    const expectsPlayableStream = !!videoStreamRef.current;
                    if (!expectsPlayableStream) {
                        return;
                    }
                    const hasPlayableStream = !!videoStreamRef.current && !!el?.srcObject && !el.paused && el.readyState >= 2;
                    if (!hasPlayableStream) {
                        screenShareManagerRef.current?.checkAndReconnect();
                    }
                }

                // Also try to unmute on tab refocus — user gesture may now be available
                const el = screenVideoRef.current;
                if (el && el.muted && !el.paused) {
                    el.muted = false;
                    setVideoMuted(false);
                    console.log("[ScreenShare] Unmuted on visibility change");
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // ── Volume sync via localStorage / BroadcastChannel ──────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleVolumeSync = () => {
            const actualVol = localStorage.getItem("transmissionActualVolume");
            if (actualVol !== null) setTransmissionVolume(parseFloat(actualVol));
        };
        window.addEventListener("storage", handleVolumeSync);
        let bc: BroadcastChannel | null = null;
        if ("BroadcastChannel" in window) {
            bc = new BroadcastChannel("transmission_audio");
            bc.onmessage = (msg) => {
                if (msg.data.type === "VOLUME_CHANGE") setTransmissionVolume(msg.data.volume);
            };
        }
        return () => {
            window.removeEventListener("storage", handleVolumeSync);
            bc?.close();
        };
    }, []);

    // ── Apply volume to video element ────────────────────────────
    useEffect(() => {
        const el = screenVideoRef.current;
        if (!el) return;
        el.volume = transmissionVolume;
        // If user raised volume while muted, take that as intent to unmute
        if (transmissionVolume > 0 && el.muted) {
            el.muted = false;
            setVideoMuted(false);
            console.log("[ScreenShare] Unmuted because volume was raised");
        }
    }, [transmissionVolume, videoStream]);

    // ── Reconnect stream (called from UI badge button) ───────────
    const reconnectStream = async () => {
        setVideoNoSignal(false);
        const videoEl = screenVideoRef.current;
        if (videoEl) {
            videoEl.muted = false;
            videoEl.play().catch(() => {
                videoEl.muted = true;
                setVideoMuted(true);
                videoEl.play().catch(() => { });
            });
        }
        await screenShareManagerRef.current?.reconnect();
    };

    return {
        screenVideoRef,
        screenShareManagerRef,
        reconnectStream,
        videoNoSignal,
        videoMuted,
        unmuteVideo,
    };
}
