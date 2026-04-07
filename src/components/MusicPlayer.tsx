"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw, Link } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const ReactPlayer = dynamic(() => import("@/components/ReactPlayerWrapper"), { ssr: false });

const isYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);

const getYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?.*?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
};

// Extrai apenas o videoId e retorna URL canônica watch?v=ID
// Remove parâmetros de playlist/mix (list=RD..., start_radio=1) que interferem
// com o ciclo de onReady do YouTube IFrame API
const normalizeYouTubeUrl = (url: string): string => {
    if (!isYouTubeUrl(url)) return url;
    const match = url.match(/(?:youtube\.com\/watch\?.*?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
};

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

declare global {
    interface Window {
        YT?: any;
        onYouTubeIframeAPIReady?: () => void;
    }
}

const BUCKET_NAME = "campaign-uploads";

export function MusicPlayer({ sessionId, userId, userRole, unifiedMode }: MusicPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ytPlayerRef = useRef<any>(null);
    const ytContainerIdRef = useRef(`yt-audio-${Math.random().toString(36).slice(2)}`);
    const pendingSeekRef = useRef<number | null>(null);
    const isTemporaryRef = useRef(false);
    const restoreUrlRef = useRef("");
    const restoreLoopRef = useRef(true);
    const ytPlayedRef = useRef(false);  // flag para timeout de diagnóstico
    const snapshotInitRef = useRef(false); // garante que o bulk listener só restaura snapshot uma vez por sessão
    const ytLocalGestureUnlockRef = useRef(false);

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [activePlaylist, setActivePlaylist] = useState<string>("");
    const [currentTrack, setCurrentTrack] = useState<string>("");
    const [youtubeInputUrl, setYoutubeInputUrl] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    const [isLooping, setIsLooping] = useState(true);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    // Controla muted-start do YouTube: começa mudo para garantir autoplay
    // e desmuta automaticamente após onReady — evita bloqueio de autoplay do browser
    const [ytAutoplayUnlocked, setYtAutoplayUnlocked] = useState(false);
    const [ytNeedsManualUnlock, setYtNeedsManualUnlock] = useState(false);
    const [ytManualNonce, setYtManualNonce] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Resetar unlock a cada nova faixa YouTube (cada troca de URL começa muda)
    useEffect(() => {
        if (isYouTubeUrl(currentTrack)) {
            if (!ytLocalGestureUnlockRef.current) {
                setYtAutoplayUnlocked(false);
            }
            setYtNeedsManualUnlock(false);
            setYtManualNonce(0);
            ytPlayedRef.current = false;
            ytLocalGestureUnlockRef.current = false;
        }
    }, [currentTrack]);

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

    useEffect(() => {
        volumeRef.current = volume;
        isMutedRef.current = isMuted;
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    useEffect(() => {
        snapshotInitRef.current = false;
        const unsubscribe = globalEventStore.subscribe((event: any) => {
            if (event.type === "SFX_TRIGGERED") {
                const sfxUrl = getSupabaseUrl(event.payload.url);
                if (sfxUrl) {
                    const sfx = new Audio(sfxUrl);
                    sfx.volume = isMutedRef.current ? 0 : volumeRef.current;
                    sfx.play().catch(e => console.warn("SFX blocked:", e));
                }
            } else if (event.type === "MUSIC_PLAYBACK_CHANGED") {
                const { url: rawUrl, playing, loop, isTemporary, restoreUrl, restoreLoop } = event.payload;
                const url = normalizeYouTubeUrl(rawUrl);

                if (isYouTubeUrl(url)) {
                    setCurrentTrack(url);
                    setIsPlaying(playing);
                    setIsLooping(loop);
                    
                    if (playing && event.payload.startedAt) {
                        const elapsed = (Date.now() - new Date(event.payload.startedAt).getTime()) / 1000;
                        if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
                            ytPlayerRef.current.seekTo(elapsed, true);
                        } else {
                            pendingSeekRef.current = elapsed;
                        }
                    }
                    isTemporaryRef.current = !!isTemporary;
                    restoreUrlRef.current = restoreUrl || "";
                    restoreLoopRef.current = restoreLoop ?? true;
                    return;
                }

                if (audioRef.current) {
                    const fullUrl = getSupabaseUrl(url);

                    if (audioRef.current.src !== fullUrl && url) {
                        audioRef.current.src = fullUrl;
                        audioRef.current.load();
                        setCurrentTrack(url);
                    }

                    if (playing) {
                        const playAudio = async () => {
                            try {
                                if (event.payload.startedAt) {
                                    const startedAt = new Date(event.payload.startedAt).getTime();
                                    const now = Date.now();
                                    const elapsed = (now - startedAt) / 1000;

                                    if (audioRef.current && Math.abs(audioRef.current.currentTime - elapsed) > 2) {
                                        audioRef.current.currentTime = elapsed % (audioRef.current.duration || 1);
                                    }
                                }
                                await audioRef.current?.play();
                            } catch (e) {
                                console.warn("Autoplay blocked, scheduling retry on click:", e);
                                const unlock = async () => {
                                    try {
                                        await audioRef.current?.play();
                                        console.log("Autoplay unlocked by interaction");
                                    } catch (err) {
                                        console.warn("Autoplay still blocked after interaction:", err);
                                    }
                                };
                                document.addEventListener('pointerdown', unlock, { once: true });
                                document.addEventListener('keydown', unlock, { once: true });
                            }
                        };
                        playAudio();
                    } else {
                        audioRef.current.pause();
                    }

                    audioRef.current.loop = loop;

                    isTemporaryRef.current = !!isTemporary;
                    restoreUrlRef.current = restoreUrl || "";
                    restoreLoopRef.current = restoreLoop ?? true;

                    setIsPlaying(playing);
                    setIsLooping(loop);
                }
            }
        },
        (bulkEvents) => {
            // O bulk listener é chamado a cada novo evento do jogo — só restaurar snapshot UMA vez por sessão
            if (snapshotInitRef.current) return;
            snapshotInitRef.current = true;

            // Evento delta tem prioridade sobre snapshot (inclui startedAt para sync)
            const lastDeltaMusic = [...bulkEvents]
                .filter((e: any) => e.type === "MUSIC_PLAYBACK_CHANGED" && !e.payload?.isTemporary)
                .pop() as any;

            if (lastDeltaMusic) return;

            const snap = globalEventStore.getSnapshotState() as any;
            const snapMusic = snap?.currentMusic;
            if (!snapMusic?.url) return;

            // React 18 batcha os três setters na mesma renderização (sem setter aninhado)
            setCurrentTrack(prev => prev || normalizeYouTubeUrl(snapMusic.url));
            setIsPlaying(snapMusic.playing ?? false);
            setIsLooping(snapMusic.loop ?? true);
        }
        );

        return unsubscribe;
    }, [sessionId, userId, userRole, getSupabaseUrl]);

    const handleTrackChange = (track: string) => {
        const normalized = normalizeYouTubeUrl(track);
        if (isYouTubeUrl(normalized)) {
            ytLocalGestureUnlockRef.current = true;
            setYtAutoplayUnlocked(true);
            setYtNeedsManualUnlock(false);
        }
        setCurrentTrack(normalized);
        broadcastUpdate(normalized, true, isLooping);
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
            const currentSec = isYouTubeUrl(url)
                ? (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function'
                    ? (ytPlayerRef.current.getCurrentTime() || 0)
                    : 0)
                : (audioRef.current?.currentTime || 0);
            startedAt = new Date(now - (currentSec * 1000)).toISOString();
        }

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "MUSIC_PLAYBACK_CHANGED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { url, playing, loop, startedAt }
        } as any);
    };

    const forceYouTubeAudioUnlock = useCallback((reason: string) => {
        const player: any = ytPlayerRef.current;
        const internal = player?.getInternalPlayer?.();

        try {
            player.muted = false;
            player.volume = isMutedRef.current ? 0 : volumeRef.current;
            if (typeof player.play === "function") {
                player.play().catch(() => {});
            }
        } catch (_) {}

        try {
            internal?.unMute?.();
            internal?.setVolume?.(Math.round((isMutedRef.current ? 0 : volumeRef.current) * 100));
            internal?.playVideo?.();
            internal?.setPlaybackQuality?.("small");
        } catch (_) {}

        setIsMuted(false);
        setYtAutoplayUnlocked(true);
        setYtNeedsManualUnlock(false);
        if (reason.startsWith("manual-button")) {
            setYtManualNonce((n) => n + 1);
        }
        console.log(`[MusicPlayer] YT_UNLOCK_APPLIED — reason=${reason} internal=${internal ? "ok" : "missing"}`);
    }, []);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    if (!sessionId) return null;

    const currentPlaylistTracks = getActiveTracks();

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
                <input
                    type="text"
                    placeholder="URL do YouTube..."
                    value={youtubeInputUrl}
                    onChange={(e) => setYoutubeInputUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && isYouTubeUrl(youtubeInputUrl.trim())) {
                            handleTrackChange(youtubeInputUrl.trim());
                            setYoutubeInputUrl("");
                        }
                    }}
                    className="track-select youtube-url-input"
                />
                <button
                    className="control-btn"
                    onClick={() => {
                        if (isYouTubeUrl(youtubeInputUrl.trim())) {
                            handleTrackChange(youtubeInputUrl.trim());
                            setYoutubeInputUrl("");
                        }
                    }}
                    disabled={!isYouTubeUrl(youtubeInputUrl.trim())}
                    title="Tocar Link do YouTube"
                >
                    <Link size={12} />
                </button>
            </div>
            {isYouTubeUrl(currentTrack) && (
                <div className="control-row">
                    <button
                        className="control-btn"
                        style={{ width: "100%", color: "#e0bb6b", borderColor: "rgba(197,160,89,0.5)" }}
                        onClick={() => forceYouTubeAudioUnlock("manual-button")}
                        title="Forçar áudio do YouTube"
                    >
                        Ativar áudio YouTube
                    </button>
                </div>
            )}
            <div className="control-row">
                <select
                    className="track-select"
                    value={currentTrack}
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

    const handleTrackEnded = useCallback(() => {
        if (isLooping) {
            if (!isYouTubeUrl(currentTrack) && audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn("[MusicPlayer] Retry play (Loop):", e));
            }
            return;
        }

        if (isTemporaryRef.current && restoreUrlRef.current && userRole === "GM") {
            broadcastUpdate(restoreUrlRef.current, true, restoreLoopRef.current);
            isTemporaryRef.current = false;
            return;
        }

        if (userRole === "GM") {
            playNext();
        }
    }, [isLooping, userRole, playNext, userId, sessionId, currentTrack]);

    const handleYouTubeReady = () => {
        console.log('[MusicPlayer] YT_READY — isPlaying:', isPlayingRef.current, 'pendingSeek:', pendingSeekRef.current);
        if (pendingSeekRef.current !== null && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(pendingSeekRef.current, 'seconds');
            pendingSeekRef.current = null;
        }
        try {
            const internal = ytPlayerRef.current?.getInternalPlayer?.();
            internal?.setPlaybackQuality?.("small");
        } catch (_) {}
        ytPlayedRef.current = false;
        setTimeout(() => {
            if (!ytPlayedRef.current) {
                console.warn('[MusicPlayer] YT_UNLOCK_TIMEOUT — onPlay não disparou em 3s após onReady');
            } else if (isPlayingRef.current && !ytAutoplayUnlocked) {
                setYtNeedsManualUnlock(true);
                console.warn('[MusicPlayer] YT_UNLOCK_MANUAL_REQUIRED');
            }
        }, 3000);
    };

    return (
        <div
            className="music-player-container"
            style={unifiedMode ? { display: 'contents' } : { position: 'relative' }}
        >
            <audio ref={audioRef} onEnded={handleTrackEnded} />

            {isMounted && isYouTubeUrl(currentTrack) && (() => {
                console.log('[MusicPlayer] YT_MOUNT — url:', currentTrack, 'playing:', isPlaying, 'unlocked:', ytAutoplayUnlocked);
                return createPortal(
                    <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '1px', height: '1px', pointerEvents: 'none' }}>
                        <ReactPlayer
                            key={`${currentTrack}-${ytManualNonce}`}
                            ref={ytPlayerRef}
                            width="1px"
                            height="1px"
                            {...{
                                url: currentTrack,
                                playing: isPlaying,
                                loop: isLooping,
                                // muted=true enquanto não confirmamos que o player está pronto
                                // Isso garante autoplay sem user gesture (browsers permitem muted autoplay)
                                // handleYouTubeReady define ytAutoplayUnlocked=true e isso desmuta
                                volume: isMuted ? 0 : volume,
                                muted: isMuted || !ytAutoplayUnlocked,
                                onEnded: handleTrackEnded,
                                onReady: handleYouTubeReady,
                                onPlay: () => {
                                    ytPlayedRef.current = true;
                                    forceYouTubeAudioUnlock("onPlay");
                                    console.log('[MusicPlayer] YT_PLAY_ATTEMPT — sucesso');
                                },
                                config: {
                                    youtube: {
                                        playerVars: {
                                            autoplay: 1,
                                            controls: 0,
                                            disablekb: 1,
                                            fs: 0,
                                            iv_load_policy: 3,
                                            modestbranding: 1,
                                            playsinline: 1,
                                            rel: 0
                                        }
                                    }
                                },
                                onError: (e: any) => console.warn('[MusicPlayer] YT_ERROR:', e),
                            } as any}
                        />
                    </div>,
                    document.body
                );
            })()}

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

            {!unifiedMode && showControls && (
                <div className="player-controls-panel animate-reveal">
                    {gmControls}
                    {volumeRow}
                </div>
            )}

            {unifiedMode && (
                <div className="unified-vol-row" style={{ order: 2 }}>
                    <div className="unified-ch-label" style={{ color: '#c5a059' }}>
                        <span>MÚSICA</span>
                        {isPlaying && <div className="pulse-mini gold" />}
                    </div>
                    {volumeRow}
                </div>
            )}

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
                        <input
                            type="text"
                            placeholder="URL do YouTube..."
                            value={youtubeInputUrl}
                            onChange={(e) => setYoutubeInputUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && isYouTubeUrl(youtubeInputUrl.trim())) {
                                    handleTrackChange(youtubeInputUrl.trim());
                                    setYoutubeInputUrl("");
                                }
                            }}
                            className="track-select youtube-url-input"
                        />
                        <button
                            className="control-btn"
                            onClick={() => {
                                if (isYouTubeUrl(youtubeInputUrl.trim())) {
                                    handleTrackChange(youtubeInputUrl.trim());
                                    setYoutubeInputUrl("");
                                }
                            }}
                            disabled={!isYouTubeUrl(youtubeInputUrl.trim())}
                            title="Tocar Link do YouTube"
                        >
                            <Link size={12} />
                        </button>
                    </div>
                    {isYouTubeUrl(currentTrack) && (
                        <div className="control-row">
                            <button
                                className="control-btn"
                                style={{ width: "100%", color: "#e0bb6b", borderColor: "rgba(197,160,89,0.5)" }}
                                onClick={() => forceYouTubeAudioUnlock("manual-button-unified")}
                                title="Forçar áudio do YouTube"
                            >
                                Ativar áudio YouTube
                            </button>
                        </div>
                    )}
                    <div className="control-row">
                        <select
                            className="track-select"
                            value={currentTrack}
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
                    background-image: none !important;
                    padding: 6px 8px !important;
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
            `}</style>
        </div>
    );
}
