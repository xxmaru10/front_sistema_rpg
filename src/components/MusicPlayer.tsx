
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw, Link } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { audioUnlockManager } from "@/lib/audio-unlock-manager";

interface MusicPlayerProps {
    sessionId?: string;
    userId?: string;
    userRole?: "GM" | "PLAYER";
    unifiedMode?: boolean;
}

interface Playlist {
    name: string;
    tracks: string[];
}

const BUCKET_NAME = "campaign-uploads";

const isYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);

export function MusicPlayer({ sessionId, userId, userRole, unifiedMode }: MusicPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const reactPlayerRef = useRef<HTMLVideoElement | null>(null);
    // Seek pending until ReactPlayer is ready (e.g., late-join sync)
    const pendingSeekRef = useRef<number | null>(null);
    // isTemporary track state for onEnded restore logic (unified for audio and YouTube)
    const isTemporaryRef = useRef(false);
    const restoreUrlRef = useRef("");
    const restoreLoopRef = useRef(true);

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [activePlaylist, setActivePlaylist] = useState<string>("");
    const [currentTrack, setCurrentTrack] = useState<string>("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(true);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [youtubeInputUrl, setYoutubeInputUrl] = useState("");

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchPlaylists = async () => {
        setLoading(true);
        try {
            const newPlaylists: Record<string, string[]> = {};

            const scanFoldersRecursive = async (path: string) => {
                const { data: items, error } = await supabase
                    .storage
                    .from(BUCKET_NAME)
                    .list(path, { limit: 1000 });

                if (error || !items) return [];

                let allTracksInThisPath: string[] = [];
                const subFolders: string[] = [];

                for (const item of items) {
                    const fullPath = path ? `${path}/${item.name}` : item.name;
                    if (item.id) {
                        if (isAudioFile(item.name)) {
                            allTracksInThisPath.push(fullPath);
                        }
                    } else {
                        subFolders.push(fullPath);
                    }
                }

                // Get tracks from subfolders and merge them into THIS folder's tracker
                const subFolderResults = await Promise.all(subFolders.map(scanFoldersRecursive));
                for (const subTracks of subFolderResults) {
                    allTracksInThisPath = [...allTracksInThisPath, ...subTracks];
                }

                if (allTracksInThisPath.length > 0) {
                    newPlaylists[path || "Geral"] = allTracksInThisPath;
                }

                return allTracksInThisPath;
            };

            await scanFoldersRecursive("");

            const playlistArray: Playlist[] = Object.entries(newPlaylists)
                .map(([name, tracks]) => ({ name, tracks }))
                .filter(p => p.tracks.length > 0)
                .sort((a, b) => {
                    if (a.name === "Geral") return -1;
                    if (b.name === "Geral") return 1;
                    return a.name.localeCompare(b.name);
                });

            setPlaylists(playlistArray);

            if (playlistArray.length > 0 && !activePlaylist) {
                setActivePlaylist(playlistArray[0].name);
            }
        } catch (err) {
            console.error("Error fetching playlists:", err);
        } finally {
            setLoading(false);
        }
    };

    const isAudioFile = (name: string) => name.match(/\.(mp3|wav|ogg|m4a|aac)$/i);

    const getSupabaseUrl = useCallback((path: string) => {
        if (!path) return "";
        if (path.startsWith("/audio/")) return path;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
        return data.publicUrl;
    }, []);

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const volumeRef = useRef(volume);
    const isMutedRef = useRef(isMuted);
    // Ref espelhando isPlaying para uso dentro de callbacks sem stale closure
    const isPlayingRef = useRef(isPlaying);

    useEffect(() => {
        volumeRef.current = volume;
        isMutedRef.current = isMuted;
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    // Mantém isPlayingRef sincronizado com o estado para uso nos callbacks
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // Registra subscriber no audioUnlockManager para retry de play após desbloqueio
    useEffect(() => {
        const unsubscribeUnlock = audioUnlockManager.subscribe(() => {
            const el = audioRef.current;
            if (!isPlayingRef.current || !el?.src) return;

            const tryPlay = () => {
                el.play().catch(e => {
                    console.warn("[MusicPlayer] Retry play after unlock failed:", e);
                    audioUnlockManager.registerPendingPlay(el);
                });
            };

            if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                tryPlay();
            } else {
                el.addEventListener("canplay", tryPlay, { once: true });
            }
        });

        // Cleanup: remove pending play ao desmontar
        return () => {
            unsubscribeUnlock();
            if (audioRef.current) {
                audioUnlockManager.unregisterPendingPlay(audioRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const unsubscribe = globalEventStore.subscribe((event: any) => {
            if (event.type === "SFX_TRIGGERED") {
                const sfxUrl = getSupabaseUrl(event.payload.url);
                if (sfxUrl) {
                    const sfx = new Audio(sfxUrl);
                    sfx.volume = isMutedRef.current ? 0 : volumeRef.current;
                    sfx.play().catch(e => console.warn("SFX blocked:", e));
                }
            } else if (event.type === "MUSIC_PLAYBACK_CHANGED") {
                const { url, playing, loop, isTemporary, restoreUrl, restoreLoop } = event.payload;

                setCurrentTrack(url);
                setIsPlaying(playing);
                setIsLooping(loop);

                if (isYouTubeUrl(url)) {
                    // YouTube: ReactPlayer is controlled via props (playing, loop, volume).
                    // Handle startedAt sync: seek if player ready, otherwise queue via pendingSeekRef.
                    if (playing && event.payload.startedAt) {
                        const startedAt = new Date(event.payload.startedAt).getTime();
                        const now = Date.now();
                        const elapsed = (now - startedAt) / 1000;
                        const currentTime = reactPlayerRef.current?.currentTime ?? 0;
                        if (Math.abs(currentTime - elapsed) > 2) {
                            if (reactPlayerRef.current) {
                                reactPlayerRef.current.currentTime = elapsed;
                            } else {
                                pendingSeekRef.current = elapsed;
                            }
                        }
                    }
                    // isTemporary restore: stored in refs, handled by handleTrackEnded
                    isTemporaryRef.current = !!isTemporary;
                    restoreUrlRef.current = restoreUrl || "";
                    restoreLoopRef.current = restoreLoop ?? true;
                } else {
                    // Supabase audio: use native audioRef
                    if (audioRef.current) {
                        const fullUrl = getSupabaseUrl(url);

                        if (audioRef.current.src !== fullUrl && url) {
                            audioRef.current.src = fullUrl;
                            // Não chamar load() aqui: play() aciona o carregamento
                            // internamente. Chamar load() + play() em sequência causa
                            // "play() interrupted by a new call to load()" no browser,
                            // silenciando o áudio mesmo com user activation.
                        }

                        if (playing) {
                            const playAudio = async () => {
                                try {
                                    if (event.payload.startedAt && audioRef.current) {
                                        const startedAt = new Date(event.payload.startedAt).getTime();
                                        const now = Date.now();
                                        const elapsed = (now - startedAt) / 1000;

                                        // Só faz seek se o áudio já carregou metadata (duration disponível)
                                        if (audioRef.current.duration && Math.abs(audioRef.current.currentTime - elapsed) > 2) {
                                            audioRef.current.currentTime = elapsed % audioRef.current.duration;
                                        }
                                    }
                                    await audioRef.current?.play();
                                } catch (e) {
                                    console.warn("[MusicPlayer] play() blocked:", e);
                                    // Registra para retry no próximo gesto do usuário
                                    if (audioRef.current) {
                                        audioUnlockManager.registerPendingPlay(audioRef.current);
                                    }
                                }
                            };
                            playAudio();
                        } else {
                            audioRef.current.pause();
                        }

                        audioRef.current.loop = loop;

                        // isTemporary restore: stored in refs, handled by handleTrackEnded
                        isTemporaryRef.current = !!isTemporary;
                        restoreUrlRef.current = restoreUrl || "";
                        restoreLoopRef.current = restoreLoop ?? true;
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

    const getActiveTracks = () => {
        const playlist = playlists.find((p: Playlist) => p.name === activePlaylist);
        return playlist ? playlist.tracks : [];
    };

    const playNext = () => {
        const tracks = getActiveTracks();
        if (tracks.length === 0) return;
        let currentIndex = tracks.indexOf(currentTrack);
        const nextIndex = (currentIndex + 1) % tracks.length;
        setCurrentTrack(tracks[nextIndex]);
        broadcastUpdate(tracks[nextIndex], true, isLooping);
    };

    const playPrevious = () => {
        const tracks = getActiveTracks();
        if (tracks.length === 0) return;
        let currentIndex = tracks.indexOf(currentTrack);
        if (currentIndex === -1) currentIndex = 0;
        const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
        setCurrentTrack(tracks[prevIndex]);
        broadcastUpdate(tracks[prevIndex], true, isLooping);
    };

    const broadcastUpdate = (url: string, playing: boolean, loop: boolean) => {
        if (!sessionId || !userId) return;

        let startedAt: string | undefined = undefined;
        if (playing) {
            const now = Date.now();
            let currentSec = 0;
            if (isYouTubeUrl(url) && reactPlayerRef.current) {
                currentSec = reactPlayerRef.current.currentTime ?? 0;
            } else if (audioRef.current) {
                currentSec = audioRef.current.currentTime;
            }
            startedAt = new Date(now - (currentSec * 1000)).toISOString();
        }

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "MUSIC_PLAYBACK_CHANGED",
            actorUserId: userId?.trim().toLowerCase(),
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { url, playing, loop, startedAt }
        } as any);
    };

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    if (!sessionId) return null;

    const currentPlaylistTracks = getActiveTracks();

    const handleTrackEnded = () => {
        if (isLooping) {
            // YouTube: loop prop handles this natively; <audio> needs manual reset as safety
            if (!isYouTubeUrl(currentTrack) && audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn("[MusicPlayer] Retry play (Loop):", e));
            }
        } else if (isTemporaryRef.current && restoreUrlRef.current && userRole === "GM") {
            // Temporary track ended: restore previous music
            broadcastUpdate(restoreUrlRef.current, true, restoreLoopRef.current);
            isTemporaryRef.current = false;
        } else if (userRole === "GM") {
            // Advance playlist: GM orchestrates to keep Event Sourcing intact
            console.log(`[MusicPlayer - ${userId}] Track ended. Orchestrating next track for session: ${sessionId}`);
            playNext();
        }
    };

    const handleYouTubeReady = () => {
        if (pendingSeekRef.current !== null && reactPlayerRef.current) {
            reactPlayerRef.current.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
        }
    };

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
                className="volume-slider music dynamic-fill"
                style={{
                    background: isMounted
                        ? `linear-gradient(to right, #c5a059 ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.1) ${(isMuted ? 0 : volume) * 100}%)`
                        : `linear-gradient(to right, #c5a059 50%, rgba(255, 255, 255, 0.1) 50%)`
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
                className="volume-val-badge music-input"
            />
        </div>
    );

    const youtubeInputRow = (
        <div className="control-row">
            <input
                type="text"
                placeholder="URL do YouTube..."
                value={youtubeInputUrl}
                onChange={(e) => setYoutubeInputUrl(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && youtubeInputUrl.trim() && isYouTubeUrl(youtubeInputUrl.trim())) {
                        handleTrackChange(youtubeInputUrl.trim());
                        setYoutubeInputUrl("");
                    }
                }}
                className="track-select youtube-url-input"
            />
            <button
                className="control-btn"
                onClick={() => {
                    if (youtubeInputUrl.trim() && isYouTubeUrl(youtubeInputUrl.trim())) {
                        handleTrackChange(youtubeInputUrl.trim());
                        setYoutubeInputUrl("");
                    }
                }}
                disabled={!youtubeInputUrl.trim() || !isYouTubeUrl(youtubeInputUrl.trim())}
                title="Tocar Link do YouTube"
            >
                <Link size={12} />
            </button>
        </div>
    );

    const gmControls = userRole === "GM" ? (
        <>
            <div className="control-row">
                <div className="icon-label"><ListMusic size={14} /></div>
                <select
                    className="track-select playlist-select"
                    value={activePlaylist}
                    onChange={(e) => setActivePlaylist(e.target.value)}
                >
                    {playlists.map((pl: Playlist) => {
                        const parts = pl.name.split('/');
                        const depth = parts.length - 1;
                        const displayName = pl.name === "Geral" ? "Geral" : parts[parts.length - 1];
                        const indent = "\u00A0".repeat(depth * 3);

                        return (
                            <option key={pl.name} value={pl.name}>
                                {indent}{depth > 0 ? "📁 " : ""}{displayName}
                            </option>
                        );
                    })}
                    {playlists.length === 0 && <option value="">Sem playlists</option>}
                </select>
                <button onClick={fetchPlaylists} className="control-btn" title="Atualizar Lista" disabled={loading}>
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                </button>
            </div>
            <div className="control-row">
                <select
                    className="track-select"
                    value={isYouTubeUrl(currentTrack) ? "" : currentTrack}
                    onChange={(e) => handleTrackChange(e.target.value)}
                >
                    <option value="">Escolha sua trilha sonora! 🎵</option>
                    {currentPlaylistTracks.map((track: string) => (
                        <option key={track} value={track}>
                            {track.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '')}
                        </option>
                    ))}
                </select>
            </div>
            {youtubeInputRow}
            <div className="control-row actions">
                <button className="control-btn" onClick={playPrevious} disabled={currentPlaylistTracks.length === 0} title="Anterior">
                    <SkipBack size={14} />
                </button>
                <button className={`control-btn ${isPlaying ? "active" : ""}`} onClick={togglePlay} disabled={!currentTrack} title={isPlaying ? "Pausar" : "Tocar"}>
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="control-btn" onClick={playNext} disabled={currentPlaylistTracks.length === 0} title="Próxima">
                    <SkipForward size={14} />
                </button>
                <button className={`control-btn ${isLooping ? "active" : ""}`} onClick={toggleLoop} title="Loop">
                    <Repeat size={14} />
                </button>
            </div>
        </>
    ) : (
        <div className="now-playing">
            <span className="scrolling-text">
                {isPlaying
                    ? (isYouTubeUrl(currentTrack)
                        ? "YouTube ▶"
                        : (currentTrack.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '') || "Reproduzindo..."))
                    : "Pausado"}
            </span>
        </div>
    );

    return (
        <div
            className="music-player-container"
            style={unifiedMode ? { display: 'contents' } : { position: 'relative' }}
        >
            {/* Native audio element: used for Supabase tracks */}
            <audio ref={audioRef} onEnded={handleTrackEnded} />

            {/* ReactPlayer: used for YouTube URLs only — wrapped in display:none to suppress video/thumbnail render */}
            {isYouTubeUrl(currentTrack) && (
                <div style={{ display: "none" }}>
                    <ReactPlayer
                        ref={reactPlayerRef}
                        src={currentTrack}
                        playing={isPlaying}
                        loop={isLooping}
                        volume={isMuted ? 0 : volume}
                        muted={isMuted}
                        onEnded={handleTrackEnded}
                        onReady={handleYouTubeReady}
                    />
                </div>
            )}

            {/* Non-unified: toggle button */}
            {!unifiedMode && (
                <button
                    className={`player-toggle ${isPlaying ? "playing" : ""}`}
                    onClick={() => setShowControls(!showControls)}
                    title="Reprodutor de Música"
                >
                    <span style={{ fontSize: '0.8rem' }}>🎵</span>
                    {isPlaying && <span className="pulse-dot" />}
                </button>
            )}

            {/* Non-unified: controls panel */}
            {!unifiedMode && showControls && (
                <div className="player-controls-panel animate-reveal">
                    {gmControls}
                    {volumeRow}
                </div>
            )}

            {/* Unified: volume section */}
            {unifiedMode && (
                <div className="unified-vol-row" style={{ order: 2 }}>
                    <div className="unified-ch-label" style={{ color: '#c5a059' }}>
                        <span>MÚSICA</span>
                        {isPlaying && <div className="pulse-mini gold" />}
                    </div>
                    {volumeRow}
                </div>
            )}

            {/* Unified: controls section */}
            {unifiedMode && userRole === "GM" && (
                <div className="unified-ctrl-row" style={{ order: 5 }}>
                    <div className="control-row">
                        <select
                            className="track-select playlist-select"
                            value={activePlaylist}
                            onChange={(e) => setActivePlaylist(e.target.value)}
                        >
                            {playlists.map((pl: Playlist) => {
                                const parts = pl.name.split('/');
                                const depth = parts.length - 1;
                                const displayName = pl.name === "Geral" ? "Geral" : parts[parts.length - 1];
                                const indent = "\u00A0".repeat(depth * 3);

                                return (
                                    <option key={pl.name} value={pl.name}>
                                        {indent}{depth > 0 ? "📁 " : ""}{displayName}
                                    </option>
                                );
                            })}
                            {playlists.length === 0 && <option value="">Sem playlists</option>}
                        </select>
                        <button onClick={fetchPlaylists} className="control-btn" title="Atualizar Lista" disabled={loading}>
                            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                    <div className="control-row">
                        <select
                            className="track-select"
                            value={isYouTubeUrl(currentTrack) ? "" : currentTrack}
                            onChange={(e) => handleTrackChange(e.target.value)}
                        >
                            <option value="">Escolha sua trilha sonora! 🎵</option>
                            {currentPlaylistTracks.map((track: string) => (
                                <option key={track} value={track}>
                                    {track.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '')}
                                </option>
                            ))}
                        </select>
                    </div>
                    {youtubeInputRow}
                    <div className="control-row actions">
                        <button className="control-btn" onClick={playPrevious} disabled={currentPlaylistTracks.length === 0}>
                            <SkipBack size={12} />
                        </button>
                        <button className={`control-btn ${isPlaying ? "active" : ""}`} onClick={togglePlay} disabled={!currentTrack}>
                            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button className="control-btn" onClick={playNext} disabled={currentPlaylistTracks.length === 0}>
                            <SkipForward size={12} />
                        </button>
                        <button className={`control-btn ${isLooping ? "active" : ""}`} onClick={toggleLoop}>
                            <Repeat size={12} />
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .player-toggle {
                    background: transparent;
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    color: #c5a059;
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

                .player-toggle:hover {
                    background: rgba(197, 160, 89, 0.1);
                    border-color: #c5a059;
                }

                .player-toggle.playing {
                    border-color: #c5a059;
                    background: rgba(197, 160, 89, 0.05);
                    box-shadow: 0 0 5px rgba(197, 160, 89, 0.2);
                }

                .pulse-dot {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 6px;
                    height: 6px;
                    background: #c5a059;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(0.95); opacity: 0.7; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.7; }
                }

                .player-controls-panel {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: #0a0a0a;
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    padding: 8px;
                    border-radius: 4px;
                    width: 230px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
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

                .icon-label {
                    color: #666;
                    display: flex;
                    align-items: center;
                }

                .actions {
                    justify-content: center;
                }

                .track-select {
                    width: 100%;
                    background: rgba(10, 10, 10, 0.9);
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(197, 160, 89, 0.4);
                    color: #e0bb6b;
                    font-size: 0.75rem;
                    padding: 6px 24px 6px 8px;
                    border-radius: 4px;
                    -webkit-appearance: none;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23c5a059' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }

                .track-select:hover {
                    border-color: #c5a059;
                    background: rgba(20, 20, 20, 0.95);
                    box-shadow: 0 0 8px rgba(197, 160, 89, 0.1);
                }

                .track-select:focus {
                    outline: none;
                    border-color: #c5a059;
                    box-shadow: 0 0 0 1px rgba(197, 160, 89, 0.5);
                }

                .track-select option {
                    background: #0f0f0f;
                    color: #c5a059;
                    padding: 8px;
                }

                .playlist-select {
                    font-weight: bold;
                    color: #e0bb6b;
                    flex: 1;
                    min-width: 0;
                    width: auto;
                }

                .youtube-url-input {
                    background-image: none;
                    padding: 6px 8px;
                    flex: 1;
                    min-width: 0;
                }

                .youtube-url-input::placeholder {
                    color: rgba(197, 160, 89, 0.4);
                    font-style: italic;
                }

                .control-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #888;
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
                    border-color: #666;
                }

                .control-btn.active {
                    color: #c5a059;
                    border-color: #c5a059;
                    background: rgba(197, 160, 89, 0.1);
                }

                .control-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .volume-slider {
                    flex: 1;
                    height: 4px;
                    -webkit-appearance: none;
                    appearance: none;
                    background: #333;
                    border-radius: 2px;
                    cursor: pointer;
                }

                .volume-slider::-webkit-slider-runnable-track {
                    height: 4px;
                    background: #333;
                    border-radius: 2px;
                }

                .volume-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 12px;
                    height: 12px;
                    background: #c5a059;
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
                .mute-btn:hover { color: #ccc; }

                .now-playing {
                    font-size: 0.7rem;
                    color: #c5a059;
                    text-align: center;
                }

                .volume-input {
                    background: #050505;
                    border: 1px solid #333;
                    color: #c5a059;
                    width: 40px;
                    font-size: 0.75rem;
                    padding: 2px;
                    text-align: center;
                    -moz-appearance: textfield;
                }

                .volume-input::-webkit-outer-spin-button,
                .volume-input::-webkit-inner-spin-button {
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
                    background: rgba(197, 160, 89, 0.05);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    color: #c5a059;
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
                    background: rgba(197, 160, 89, 0.15);
                    border-color: #c5a059;
                }

                .volume-slider.dynamic-fill {
                    background: none; /* Controlled by inline style */
                }

                .volume-val-badge {
                    color: #c5a059;
                    border-color: rgba(197, 160, 89, 0.3) !important;
                }

                /* Unified mode */
                .unified-vol-row {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.1);
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

                .pulse-mini.gold {
                    background: #c5a059;
                    box-shadow: 0 0 5px #c5a059;
                    animation: pulse 2s infinite;
                }
            `}</style>
        </div>
    );
}
