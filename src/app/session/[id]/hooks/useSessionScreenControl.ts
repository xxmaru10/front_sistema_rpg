/**
 * @file: src/app/session/[id]/hooks/useSessionScreenControl.ts
 * @summary: Manages the ScreenShareManager WebRTC lifecycle, video srcObject
 * assignment, and BroadcastChannel/localStorage volume synchronisation.
 */
"use client";

import { useEffect, useRef } from "react";
import { ScreenShareManager } from "@/lib/ScreenShareManager";

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

    // Screen share manager lifecycle
    useEffect(() => {
        if (!sessionId || !actorUserId) return;
        const timer = setTimeout(() => {
            if (!screenShareManagerRef.current) {
                const manager = new ScreenShareManager(
                    sessionId,
                    actorUserId,
                    (stream) => setVideoStream(stream)
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
        };
    }, [sessionId, actorUserId]);

    // Auto-exit spectator mode when stream ends
    useEffect(() => {
        if (!videoStream && spectatorMode) setSpectatorMode(false);
    }, [videoStream, spectatorMode]);

    // Assign video srcObject when stream or tab changes
    useEffect(() => {
        const videoEl = screenVideoRef.current;
        if (!videoEl) return;
        if (videoStream) {
            if (videoEl.srcObject !== videoStream) videoEl.srcObject = videoStream;
            videoEl.play().catch(e => console.warn("[ScreenShare] Video play() failed:", e));
        } else {
            videoEl.srcObject = null;
        }
    }, [videoStream, activeTab, spectatorMode]);

    // Transmission audio volume sync
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

    // Apply volume to video element
    useEffect(() => {
        if (screenVideoRef.current) screenVideoRef.current.volume = transmissionVolume;
    }, [transmissionVolume, videoStream]);

    return {
        screenVideoRef,
        screenShareManagerRef,
    };
}
