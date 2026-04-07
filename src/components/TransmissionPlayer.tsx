"use client";

import { useEffect, useState } from "react";
import { Monitor, Volume2, VolumeX } from "lucide-react";
import { getSocket } from "@/lib/socketClient";

interface TransmissionPlayerProps {
    sessionId?: string;
    userId?: string;
    userRole?: "GM" | "PLAYER";
    unifiedMode?: boolean;
}

export function TransmissionPlayer({ sessionId, userId, unifiedMode }: TransmissionPlayerProps) {
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('transmissionVolume');
        const parsed = stored ? parseFloat(stored) : NaN;
        if (Number.isFinite(parsed)) setVolume(Math.min(1, Math.max(0, parsed)));
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!sessionId) return;

        const socket = getSocket(userId);

        const handleSync = (payload: { type: string }) => {
            if (payload.type === 'stream-started') setIsActive(true);
            else if (payload.type === 'stop-share') setIsActive(false);
        };

        socket.on('transmission-sync', handleSync);
        socket.emit('transmission-status-req', { sessionId });
        
        return () => {
            socket.off('transmission-sync', handleSync);
        };
    }, [sessionId, userId]);

    useEffect(() => {
        if (!isMounted) return;
        const v = isMuted ? 0 : volume;
        localStorage.setItem('transmissionVolume', volume.toString());
        localStorage.setItem('transmissionActualVolume', v.toString());
        window.dispatchEvent(new Event('storage'));

        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel('transmission_audio');
            bc.postMessage({ type: 'VOLUME_CHANGE', volume: v });
            bc.close();
        }
    }, [volume, isMuted, isMounted]);

    if (!sessionId) return null;

    const volumeControls = (
        <div className="control-row volume-horizontal">
            <button
                onClick={() => setIsMuted(!isMuted)}
                className="mute-btn-premium"
                title={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                }}
                className="volume-slider trans dynamic-fill"
                style={{
                    background: isMounted
                        ? `linear-gradient(to right, var(--accent-color) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`
                        : `linear-gradient(to right, var(--accent-color) 100%, rgba(255,255,255,0.1) 100%)`
                }}
                suppressHydrationWarning
            />
            <input
                type="number"
                min="0"
                max="100"
                value={isMuted ? 0 : Math.round(volume * 100)}
                onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                        setVolume(Math.min(1, Math.max(0, val / 100)));
                        setIsMuted(val === 0);
                    }
                }}
                className="volume-val-badge trans-input"
            />
        </div>
    );

    return (
        <div
            className="transmission-player-container"
            style={unifiedMode ? { display: 'contents' } : { position: 'relative' }}
        >
            {!unifiedMode && (
                <button
                    className={`player-toggle trans ${isActive ? "playing" : ""}`}
                    onClick={() => setShowControls(!showControls)}
                    title="Som da Transmissão"
                >
                    <Monitor size={16} />
                    {isActive && <span className="pulse-dot-trans" />}
                </button>
            )}

            {!unifiedMode && showControls && (
                <div className="player-controls-panel trans animate-reveal">
                    <div className="now-playing">
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isActive ? 'var(--accent-color)' : '#666' }}>
                            CANAL DE TRANSMISSÃO
                        </span>
                    </div>
                    {volumeControls}
                </div>
            )}

            {unifiedMode && (
                <div className="unified-vol-row" style={{ order: 0 }}>
                    <div className="unified-ch-label" style={{ color: isActive ? 'var(--accent-color)' : '#666' }}>
                        <span>TRANSMISSÃO</span>
                        {isActive && <div className="pulse-mini" />}
                    </div>
                    {volumeControls}
                </div>
            )}

            <style jsx>{`
                .player-toggle.trans {
                    background: transparent;
                    border: 1px solid rgba(160,160,160,0.3);
                    color: #aaa;
                    width: 32px;
                    height: 32px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }
                .player-toggle.trans:hover {
                    background: rgba(255,255,255,0.05);
                    border-color: #fff;
                    color: #fff;
                }
                .player-toggle.trans.playing {
                    border-color: var(--accent-color);
                    color: var(--accent-color);
                    background: rgba(var(--accent-rgb), 0.05);
                    box-shadow: 0 0 5px rgba(var(--accent-rgb), 0.2);
                }
                .pulse-dot-trans {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 6px;
                    height: 6px;
                    background: var(--accent-color);
                    border-radius: 50%;
                    animation: pulse-trans 2s infinite;
                }
                @keyframes pulse-trans {
                    0% { transform: scale(0.95); opacity: 0.7; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.7; }
                }
                .player-controls-panel.trans {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: #0a0a0a;
                    border: 1px solid rgba(var(--accent-rgb), 0.3);
                    padding: 8px;
                    border-radius: 4px;
                    width: 220px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.6);
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .control-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .volume-slider.trans {
                    flex: 1;
                    height: 4px;
                    -webkit-appearance: none;
                    appearance: none;
                    background: #222;
                    border-radius: 2px;
                    cursor: pointer;
                }
                .volume-slider.trans::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 12px;
                    height: 12px;
                    background: var(--accent-color);
                    border-radius: 50%;
                    cursor: pointer;
                    margin-top: -4px;
                }
                .mute-btn-premium {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: var(--accent-color);
                    width: 26px;
                    height: 26px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }
                .mute-btn-premium:hover {
                    background: rgba(255,255,255,0.08);
                    border-color: #fff;
                    color: #fff;
                }
                .volume-slider.dynamic-fill { background: none; }
                .volume-val-badge {
                    color: var(--accent-color);
                    border-color: rgba(var(--accent-rgb), 0.3) !important;
                }
                .now-playing {
                    font-size: 0.7rem;
                    text-align: center;
                    margin-bottom: 2px;
                }
                .volume-horizontal {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 16px;
                    width: 100%;
                }
                .unified-vol-row {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .unified-ch-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.6rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                .pulse-mini {
                    width: 4px;
                    height: 4px;
                    background: var(--accent-color);
                    border-radius: 50%;
                    animation: pulse-trans 2s infinite;
                    flex-shrink: 0;
                }
            `}</style>
        </div>
    );
}
