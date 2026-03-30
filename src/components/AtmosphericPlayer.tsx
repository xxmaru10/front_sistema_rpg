"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface AtmosphericPlayerProps {
    sessionId?: string;
    userId?: string;
    userRole?: "GM" | "PLAYER";
    unifiedMode?: boolean;
}

const BUCKET_NAME = "campaign-uploads";
const ATMOSPHERIC_FOLDER = "Atmosferico";

export function AtmosphericPlayer({ sessionId, userId, userRole, unifiedMode }: AtmosphericPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [tracks, setTracks] = useState<string[]>([]);
    const [currentTrack, setCurrentTrack] = useState<string>("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(true);
    const [volume, setVolume] = useState(0.4);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchTracks = async () => {
        setLoading(true);
        try {
            // Recursive function to get all audio files in a folder
            const getAllFilesRecursive = async (path: string): Promise<string[]> => {
                const { data: folderFiles, error } = await supabase
                    .storage
                    .from(BUCKET_NAME)
                    .list(path, {
                        limit: 1000,
                        offset: 0,
                        sortBy: { column: 'name', order: 'asc' },
                    });

                if (error || !folderFiles) return [];

                let tracks: string[] = [];
                for (const file of folderFiles) {
                    const fullPath = `${path}/${file.name}`;
                    if (file.id) {
                        // It's a file
                        if (file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
                            tracks.push(fullPath);
                        }
                    } else {
                        // It's a folder, recurse
                        const subTracks = await getAllFilesRecursive(fullPath);
                        tracks = [...tracks, ...subTracks];
                    }
                }
                return tracks;
            };

            const audioFiles = await getAllFilesRecursive(ATMOSPHERIC_FOLDER);
            setTracks(audioFiles);
        } catch (err) {
            console.error("Error fetching atmospheric tracks:", err);
        } finally {
            setLoading(false);
        }
    };

    const getSupabaseUrl = useCallback((path: string) => {
        if (!path) return "";
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        return data.publicUrl;
    }, []);

    useEffect(() => {
        fetchTracks();
    }, []);

    const volumeRef = useRef(volume);
    const isMutedRef = useRef(isMuted);

    useEffect(() => {
        volumeRef.current = volume;
        isMutedRef.current = isMuted;
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    useEffect(() => {
        const unsubscribe = globalEventStore.subscribe((event: any) => {
            if (event.type === "ATMOSPHERIC_PLAYBACK_CHANGED") {
                if (!event.payload) return;
                const { url, playing, loop, startedAt } = event.payload;

                if (audioRef.current) {
                    const targetFullUrl = getSupabaseUrl(url);
                    const currentSrc = audioRef.current.src;
                    const isNewTrack = url && currentSrc !== targetFullUrl;

                    if (isNewTrack) {
                        audioRef.current.src = targetFullUrl;
                        audioRef.current.load();
                        setCurrentTrack(url);
                    }

                    setIsPlaying(playing);
                    setIsLooping(loop);
                    audioRef.current.loop = loop;

                    if (playing) {
                        const playAudio = async () => {
                            try {
                                if (startedAt && audioRef.current) {
                                    const startedAtTime = new Date(startedAt).getTime();
                                    const now = Date.now();
                                    const elapsed = (now - startedAtTime) / 1000;

                                    if (audioRef.current.duration && Math.abs(audioRef.current.currentTime - elapsed) > 2) {
                                        audioRef.current.currentTime = elapsed % audioRef.current.duration;
                                    }
                                }
                                await audioRef.current?.play();
                            } catch (e) {
                                console.warn("Atmospheric Autoplay blocked:", e);
                            }
                        };
                        playAudio();
                    } else {
                        audioRef.current.pause();
                    }
                }
            }
        });

        return unsubscribe;
    }, [sessionId, userId, userRole, getSupabaseUrl]);

    const handleTrackChange = (track: string) => {
        setCurrentTrack(track);
        broadcastUpdate(track, true, isLooping);
    };

    const togglePlay = () => {
        const newState = !isPlaying;
        setIsPlaying(newState);
        broadcastUpdate(currentTrack, newState, isLooping);
    };

    const toggleLoop = () => {
        const newState = !isLooping;
        setIsLooping(newState);
        broadcastUpdate(currentTrack, isPlaying, newState);
    };

    const broadcastUpdate = (url: string, playing: boolean, loop: boolean) => {
        if (!sessionId || !userId) return;

        let startedAt: string | undefined = undefined;
        if (playing && audioRef.current) {
            const now = Date.now();
            const currentSec = audioRef.current.currentTime;
            startedAt = new Date(now - (currentSec * 1000)).toISOString();
        }

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "ATMOSPHERIC_PLAYBACK_CHANGED" as any,
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { url, playing, loop, startedAt }
        } as any);
    };

    if (!sessionId) return null;

    const volumeRow = (
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
                className="volume-slider atmos dynamic-fill"
                style={{
                    background: isMounted
                        ? `linear-gradient(to right, #82b4ff ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.1) ${(isMuted ? 0 : volume) * 100}%)`
                        : `linear-gradient(to right, #82b4ff 40%, rgba(255, 255, 255, 0.1) 40%)`
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
                className="volume-val-badge atmos-input"
            />
        </div>
    );

    const gmControls = userRole === "GM" ? (
        <>
            <div className="control-row">
                <select
                    className="track-select"
                    value={currentTrack}
                    onChange={(e) => handleTrackChange(e.target.value)}
                >
                    <option value="">Clima/Ambiente...</option>
                    {tracks.map((track) => (
                        <option key={track} value={track}>
                            {track.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '')}
                        </option>
                    ))}
                </select>
                <button onClick={fetchTracks} className="control-btn" title="Atualizar" disabled={loading}>
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
            <div className="control-row actions">
                <button
                    className={`control-btn ${isPlaying ? "active" : ""}`}
                    onClick={togglePlay}
                    disabled={!currentTrack}
                    title={isPlaying ? "Parar" : "Tocar"}
                >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                    className={`control-btn ${isLooping ? "active" : ""}`}
                    onClick={toggleLoop}
                    title="Loop"
                >
                    <Repeat size={14} />
                </button>
            </div>
        </>
    ) : (
        <div className="now-playing">
            <span className="scrolling-text">
                {isPlaying ? (currentTrack.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '') || "Ambiente...") : "Silêncio"}
            </span>
        </div>
    );

    return (
        <div
            className="atmospheric-player-container"
            style={unifiedMode ? { display: 'contents' } : { position: 'relative' }}
        >
            <audio ref={audioRef} loop={isLooping} />

            {/* Non-unified: toggle button */}
            {!unifiedMode && (
                <button
                    className={`player-toggle atmos ${isPlaying ? "playing" : ""}`}
                    onClick={() => setShowControls(!showControls)}
                    title="Sons Atmosféricos"
                >
                    <span style={{ fontSize: '0.7rem' }}>🌧</span>
                    {isPlaying && <span className="pulse-dot-atmos" />}
                </button>
            )}

            {/* Non-unified: controls panel */}
            {!unifiedMode && showControls && (
                <div className="player-controls-panel atmos animate-reveal">
                    {gmControls}
                    {volumeRow}
                </div>
            )}

            {/* Unified: volume section */}
            {unifiedMode && (
                <div className="unified-vol-row" style={{ order: 1 }}>
                    <div className="unified-ch-label" style={{ color: '#82b4ff' }}>
                        <span>CLIMA</span>
                        {isPlaying && <div className="pulse-mini blue" />}
                    </div>
                    {volumeRow}
                </div>
            )}

            {/* Unified: controls section */}
            {unifiedMode && userRole === "GM" && (
                <div className="unified-ctrl-row" style={{ order: 4 }}>
                    <div className="control-row">
                        <select
                            className="track-select"
                            value={currentTrack}
                            onChange={(e) => handleTrackChange(e.target.value)}
                        >
                            <option value="">Clima/Ambiente...</option>
                            {tracks.map((track) => (
                                <option key={track} value={track}>
                                    {track.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '')}
                                </option>
                            ))}
                        </select>
                        <button onClick={fetchTracks} className="control-btn" title="Atualizar" disabled={loading}>
                            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                    <div className="control-row actions">
                        <button
                            className={`control-btn ${isPlaying ? "active" : ""}`}
                            onClick={togglePlay}
                            disabled={!currentTrack}
                        >
                            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button
                            className={`control-btn ${isLooping ? "active" : ""}`}
                            onClick={toggleLoop}
                        >
                            <Repeat size={12} />
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .player-toggle.atmos {
                    background: transparent;
                    border: 1px solid rgba(130, 180, 255, 0.3);
                    color: #82b4ff;
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

                .player-toggle.atmos:hover {
                    background: rgba(130, 180, 255, 0.1);
                    border-color: #82b4ff;
                }

                .player-toggle.atmos.playing {
                    border-color: #82b4ff;
                    background: rgba(130, 180, 255, 0.05);
                    box-shadow: 0 0 5px rgba(130, 180, 255, 0.2);
                }

                .pulse-dot-atmos {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 6px;
                    height: 6px;
                    background: #82b4ff;
                    border-radius: 50%;
                    animation: pulse-atmos 2s infinite;
                }

                @keyframes pulse-atmos {
                    0% { transform: scale(0.95); opacity: 0.7; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.7; }
                }

                .player-controls-panel.atmos {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: #050a12;
                    border: 1px solid rgba(130, 180, 255, 0.3);
                    padding: 8px;
                    border-radius: 4px;
                    width: 210px;
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

                .actions {
                    justify-content: center;
                }

                .track-select {
                    width: 100%;
                    background: rgba(5, 10, 18, 0.9);
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(130, 180, 255, 0.4);
                    color: #82b4ff;
                    font-size: 0.75rem;
                    padding: 6px 24px 6px 8px;
                    border-radius: 4px;
                    -webkit-appearance: none;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%2382b4ff' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }

                .track-select:hover {
                    border-color: #82b4ff;
                    background: rgba(10, 20, 35, 0.95);
                    box-shadow: 0 0 8px rgba(130, 180, 255, 0.1);
                }

                .track-select:focus {
                    outline: none;
                    border-color: #82b4ff;
                    box-shadow: 0 0 0 1px rgba(130, 180, 255, 0.5);
                }

                .track-select option {
                    background: #050a12;
                    color: #82b4ff;
                    padding: 8px;
                }

                .control-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #666;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 4px;
                }

                .control-btn:hover {
                    color: #fff;
                    border-color: #555;
                }

                .control-btn.active {
                    color: #82b4ff;
                    border-color: #82b4ff;
                    background: rgba(130, 180, 255, 0.1);
                }

                .volume-slider.atmos {
                    flex: 1;
                    height: 4px;
                    -webkit-appearance: none;
                    appearance: none;
                    background: #1e2a3b;
                    border-radius: 2px;
                    cursor: pointer;
                }

                .volume-slider.atmos::-webkit-slider-runnable-track {
                    height: 4px;
                    background: #1e2a3b;
                    border-radius: 2px;
                }

                .volume-slider.atmos::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 12px;
                    height: 12px;
                    background: #82b4ff;
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
                .mute-btn:hover { color: #82b4ff; }

                .now-playing {
                    font-size: 0.7rem;
                    color: #82b4ff;
                    text-align: center;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                }

                .volume-input.atmos {
                    background: #050a12;
                    border: 1px solid #1e2a3b;
                    color: #82b4ff;
                    width: 40px;
                    font-size: 0.75rem;
                    padding: 2px;
                    text-align: center;
                    -moz-appearance: textfield;
                }

                .volume-input.atmos::-webkit-outer-spin-button,
                .volume-input.atmos::-webkit-inner-spin-button {
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
                    background: rgba(130, 180, 255, 0.05);
                    border: 1px solid rgba(130, 180, 255, 0.2);
                    color: #82b4ff;
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
                    background: rgba(130, 180, 255, 0.15);
                    border-color: #82b4ff;
                }

                .volume-slider.dynamic-fill {
                    background: none; /* Controlled by inline style */
                }

                .volume-val-badge {
                    color: #82b4ff;
                    border-color: rgba(130, 180, 255, 0.3) !important;
                }

                /* Unified mode */
                .unified-vol-row {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(130, 180, 255, 0.1);
                }

                .unified-ctrl-row {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 8px 0;
                }

                .unified-ch-label {
                    font-size: 0.6rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .pulse-mini {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                }

                .pulse-mini.blue {
                    background: #82b4ff;
                    box-shadow: 0 0 5px #82b4ff;
                    animation: pulse-atmos 1s infinite;
                }
            `}</style>
        </div>
    );
}
