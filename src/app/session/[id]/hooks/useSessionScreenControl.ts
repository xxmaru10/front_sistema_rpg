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

import { screenShareStore } from "@/lib/screenShareStore";

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
        };
    }, [sessionId, actorUserId, setVideoStream]);

    // Listen to global reconnect trigger
    useEffect(() => {
        const unsubscribe = screenShareStore.subscribe(() => {
            if (screenShareStore.reconnectVersion > 0) {
                console.log("[WebRTC] Reconnect triggered from Header.");
                screenShareManagerRef.current?.reconnect();
            }
        });
        return unsubscribe;
    }, []);

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
                    // Tenta play() normal (pode ter áudio se o usuário já interagiu com a página)
                    await videoEl.play();
                    console.log("[ScreenShare] Play success with audio");
                } catch (err) {
                    console.warn("[ScreenShare] Autoplay with audio failed, retrying muted...", err);
                    // Falha comum em mobile (Brave/iOS) se não houver interação prévia.
                    // Silenciamos forçadamente e tentamos novamente.
                    videoEl.muted = true;
                    try {
                        await videoEl.play();
                        console.log("[ScreenShare] Play success (muted fallback)");
                    } catch (mutedErr) {
                        console.error("[ScreenShare] Muted play also failed. Browser may be blocking WebRTC/Video or requires user gesture:", mutedErr);
                    }
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

    // Visibilidade e Diagnósticos para Brave/Mobile
    useEffect(() => {
        const checkDiagnostics = async () => {
            const isSecure = window.isSecureContext;
            const isBrave = !!(navigator as any).brave && await (navigator as any).brave.isBrave();
            
            if (!isSecure) {
                console.error("[WebRTC Diagnosis] AMBIENTE NÃO SEGURO (HTTP). WebRTC será bloqueado no celular.");
            }
            if (isBrave) {
                console.info("[WebRTC Diagnosis] Navegador Brave detectado. Se a tela estiver preta, desative o 'Brave Shields' ou verifique as permissões de WebRTC.");
            }
        };
        checkDiagnostics();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                console.log("[ScreenShare] Visibility visible, checking connection...");
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
