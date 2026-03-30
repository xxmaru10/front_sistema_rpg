
"use client";

import { useEffect, useState } from "react";
import { Monitor, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface TransmissionPlayerProps {
    sessionId?: string;
    userId?: string;
    userRole?: "GM" | "PLAYER";
    unifiedMode?: boolean;
}

export function TransmissionPlayer({ sessionId, unifiedMode }: TransmissionPlayerProps) {
    const [volume, setVolume] = useState(0.7);
    const [isMuted, setIsMuted] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Carregar volume inicial
    useEffect(() => {
        const stored = localStorage.getItem('transmissionVolume');
        if (stored) setVolume(parseFloat(stored));
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!sessionId) return;

        const checkActive = async () => {
            const { data } = await supabase
                .from('webrtc_signals')
                .select('created_at')
                .eq('session_id', sessionId)
                .eq('signal_type', 'stream-started')
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                const lastSignalTime = new Date(data[0].created_at).getTime();
                const now = Date.now();
                setIsActive(now - lastSignalTime < 45000);
            } else {
                setIsActive(false);
            }
        };

        checkActive();
        const interval = setInterval(checkActive, 10000);

        const channel = supabase
            .channel(`transmission-status-${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'webrtc_signals',
                    filter: `session_id=eq.${sessionId}`
                },
                (payload: any) => {
                    const row = payload.new;
                    if (row.signal_type === 'stream-started') {
                        setIsActive(true);
                    } else if (row.signal_type === 'stop-share') {
                        setIsActive(false);
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [sessionId]);

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
    }, [volume, isMuted]);

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
                        ? `linear-gradient(to right, var(--accent-color) ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.1) ${(isMuted ? 0 : volume) * 100}%)`
                        : `linear-gradient(to right, var(--accent-color) 70%, rgba(255, 255, 255, 0.1) 70%)`
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
            {/* Non-unified: toggle button */}
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

            {/* Non-unified: controls panel */}
            {!unifiedMode && showControls && (
                <div className="player-controls-panel trans animate-reveal">
                    <div className="now-playing">
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: isActive ? 'var(--accent-color)' : '#666' }}>
                           CANAL DE TRANSMISSÃO
                        </span>
                    </div>
                    {volumeControls}
                    {!isActive && (
                        <div style={{ fontSize: '0.6rem', color: '#666', textAlign: 'center', marginTop: '4px', fontStyle: 'italic' }}>
                            Sem transmissão ativa
                        </div>
                    )}
                </div>
            )}

            {/* Unified mode: volume row only */}
            {unifiedMode && (
                <div className="unified-vol-row" style={{ order: 0 }}>
                    <div className="unified-ch-label" style={{ color: isActive ? 'var(--accent-color)' : '#666' }}>
                        <span>TRANSMISSÃO</span>
                        {isActive && <div className="pulse-mini" />}
                    </div>
                    {volumeControls}
                    {!isActive && (
                        <div className="inactive-hint">Sem transmissão ativa</div>
                    )}
                </div>
            )}

            <style jsx>{`
                .player-toggle.trans {
                    background: transparent;
                    border: 1px solid rgba(160, 160, 160, 0.3);
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
                    background: rgba(255, 255, 255, 0.05);
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

                .volume-slider.trans::-webkit-slider-runnable-track {
                    height: 4px;
                    background: #222;
                    border-radius: 2px;
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

                .mute-btn {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                }
                .mute-btn:hover { color: var(--accent-color); }

                .now-playing {
                    font-size: 0.7rem;
                    text-align: center;
                    margin-bottom: 2px;
                }

                .volume-input.trans {
                    background: #050505;
                    border: 1px solid #333;
                    color: var(--accent-color);
                    width: 40px;
                    font-size: 0.75rem;
                    padding: 2px;
                    text-align: center;
                    -moz-appearance: textfield;
                }

                .volume-input.trans::-webkit-outer-spin-button,
                .volume-input.trans::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                .volume-horizontal {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 16px;
                    width: 100%;
                }

                .mute-btn-premium {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
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
                    background: rgba(255, 255, 255, 0.08);
                    border-color: #fff;
                    color: #fff;
                }

                .volume-slider.dynamic-fill {
                    background: none; /* Controlled by inline style */
                }

                .volume-val-badge {
                    color: var(--accent-color);
                    border-color: rgba(var(--accent-rgb), 0.3) !important;
                }

                /* Unified mode */
                .unified-vol-row {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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

                .inactive-hint {
                    font-size: 0.58rem;
                    color: #555;
                    font-style: italic;
                    margin-top: -2px;
                }
            `}</style>
        </div>
    );
}
