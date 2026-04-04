/**
 * @file: src/app/session/[id]/hooks/useSessionScreenControl.ts
 * @summary: Manages the ScreenShareManager WebRTC lifecycle, video srcObject
 * assignment, and BroadcastChannel/localStorage volume synchronisation.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { ScreenShareManager } from "@/lib/screen-share-manager";

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
    const [videoNoSignal, setVideoNoSignal] = useState(false);

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

    // Assign video srcObject when stream or tab changes.
    // Autoplay muted fallback: iOS Safari bloqueia play() em vídeo não-silenciado sem
    // gesto de usuário. Se play() falhar, silencia e retenta — o stream continua, só sem áudio.
    useEffect(() => {
        const videoEl = screenVideoRef.current;
        if (!videoEl) return;
        if (videoStream) {
            if (videoEl.srcObject !== videoStream) videoEl.srcObject = videoStream;

            const tryPlay = async () => {
                try {
                    await videoEl.play();
                } catch {
                    // Autoplay bloqueado (comum em iOS sem interação prévia).
                    // Silencia e retenta: garante que o vídeo apareça mesmo sem áudio.
                    videoEl.muted = true;
                    videoEl.play().catch(e => console.warn("[ScreenShare] Muted play also failed:", e));
                }
            };
            tryPlay();

            // Limpa badge "sem sinal" assim que o vídeo conseguir decodificar frames
            const clearNoSignal = () => setVideoNoSignal(false);
            videoEl.addEventListener('canplay', clearNoSignal, { once: true });
            return () => videoEl.removeEventListener('canplay', clearNoSignal);
        } else {
            videoEl.srcObject = null;
        }
    }, [videoStream, activeTab, spectatorMode]);

    // Watchdog: se stream chegou mas vídeo não avança em 10s, tenta play() uma última
    // vez (cobre casos de race entre srcObject e play) antes de exibir o badge.
    useEffect(() => {
        if (!videoStream) {
            setVideoNoSignal(false);
            return;
        }
        setVideoNoSignal(false);
        const timeout = setTimeout(() => {
            const el = screenVideoRef.current;
            if (!el || el.readyState >= 3) return;
            // Última tentativa com muted antes de mostrar o badge
            el.muted = true;
            el.play()
                .then(() => { /* play ok, canplay vai limpar o badge */ })
                .catch(() => {
                    // Mesmo com muted falhou — mostra badge para o usuário usar o botão
                    setVideoNoSignal(true);
                });
        }, 10000);
        return () => clearTimeout(timeout);
    }, [videoStream]);

    // Visibilidade: quando o usuário volta à aba (mobile background / lock screen),
    // verifica se a conexão WebRTC ainda está ativa e reconecta se necessário.
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                screenShareManagerRef.current?.checkAndReconnect();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

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

    const reconnectStream = async () => {
        setVideoNoSignal(false);
        const videoEl = screenVideoRef.current;
        if (videoEl) {
            // Tenta primeiro só com play() — se falhar, silencia e retenta.
            // Cobre o caso de vídeo já conectado mas pausado por autoplay policy.
            videoEl.play().catch(() => {
                videoEl.muted = true;
                videoEl.play().catch(() => {});
            });
        }
        await screenShareManagerRef.current?.reconnect();
    };

    return {
        screenVideoRef,
        screenShareManagerRef,
        reconnectStream,
        videoNoSignal,
    };
}
