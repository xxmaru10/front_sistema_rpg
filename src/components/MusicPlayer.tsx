"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw, Link, Youtube, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { logStory59 } from "@/lib/story59Debug";
import { logStory61 } from "@/lib/story61Debug";

const isYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);

const getYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?.*?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
};

const isPlayableYouTubeUrl = (url: string) => !!getYouTubeVideoId(url);

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
const YT_SEEK_EPSILON_SEC = 2;

type YtLogOperation = "seekTo" | "seekTo-skipped" | "playVideo" | "pauseVideo" | "stopVideo";

const YT_STATE_FALLBACK = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
} as const;

function logYt(
    op: YtLogOperation,
    reason: string,
    data?: Record<string, unknown> | (() => Record<string, unknown>),
) {
    if (
        process.env.NODE_ENV !== "development" &&
        !(typeof window !== "undefined" && window.localStorage?.getItem("debugMusicPlayer") === "1")
    ) {
        return;
    }
    const resolvedData = typeof data === "function" ? data() : data;
    console.debug("[MusicPlayer/YT]", { op, reason, ...(resolvedData || {}) });
}

function MusicPlayerComponent({ sessionId, userId, userRole, unifiedMode }: MusicPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ytPlayerRef = useRef<any>(null);
    const ytContainerIdRef = useRef(`yt-audio-${Math.random().toString(36).slice(2)}`);
    const ytApiPromiseRef = useRef<Promise<any> | null>(null);
    const ytReadyRef = useRef(false);
    const pendingSeekRef = useRef<number | null>(null);
    const isTemporaryRef = useRef(false);
    const restoreUrlRef = useRef("");
    const restoreLoopRef = useRef(true);
    const handleTrackEndedRef = useRef<(() => void) | null>(null);
    const ytPlayedRef = useRef(false);  // flag para timeout de diagnóstico
    const snapshotInitRef = useRef(false); // garante que o bulk listener só restaura snapshot uma vez por sessão
    const ytLocalGestureUnlockRef = useRef(false);
    const currentTrackRef = useRef("");
    const sawLiveMusicEventRef = useRef(false);
    const lastMusicEventTsRef = useRef(0);
    const lastMusicSeqRef = useRef(0);
    const renderCountRef = useRef(0);

    renderCountRef.current += 1;
    logStory61("MusicPlayer", "render", { count: renderCountRef.current });

    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [activePlaylist, setActivePlaylist] = useState<string>("");
    const [currentTrack, setCurrentTrack] = useState<string>("");
    const [youtubeInputUrl, setYoutubeInputUrl] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const isPlayingRef = useRef(isPlaying);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        currentTrackRef.current = currentTrack;
    }, [currentTrack]);

    const [isLooping, setIsLooping] = useState(true);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    // Controla muted-start do YouTube: começa mudo para garantir autoplay
    // e desmuta automaticamente após onReady — evita bloqueio de autoplay do browser
    const [ytAutoplayUnlocked, setYtAutoplayUnlocked] = useState(false);
    const [, setYtNeedsManualUnlock] = useState(false);

    useEffect(() => {
        logStory59("MusicPlayer", "mount", {
            sessionId: sessionId || "none",
            userId: userId || "none",
            userRole: userRole || "none",
            unifiedMode: !!unifiedMode,
        });
        return () => {
            logStory59("MusicPlayer", "unmount", {
                sessionId: sessionId || "none",
                userId: userId || "none",
                userRole: userRole || "none",
                unifiedMode: !!unifiedMode,
            });
        };
    }, [sessionId, userId, userRole, unifiedMode]);

    useEffect(() => {
        logStory59("MusicPlayer", "render", {
            count: renderCountRef.current,
            currentTrack,
            isPlaying,
            isYouTube: isPlayableYouTubeUrl(currentTrack),
            unifiedMode: !!unifiedMode,
        });
    });

    const isYouTubePlayerAttached = useCallback(() => {
        const player = ytPlayerRef.current;
        const iframe = player?.getIframe?.();
        return !!player && !!iframe && !!iframe.isConnected && ytReadyRef.current;
    }, []);

    const getYtStateCode = useCallback((stateName: keyof typeof YT_STATE_FALLBACK) => {
        const ytStates = window.YT?.PlayerState;
        const fromApi = ytStates?.[stateName];
        return typeof fromApi === "number" ? fromApi : YT_STATE_FALLBACK[stateName];
    }, []);

    const getPlayerState = useCallback((player: any): number | null => {
        if (!player || typeof player.getPlayerState !== "function") return null;
        const state = player.getPlayerState();
        return typeof state === "number" ? state : null;
    }, []);

    const seekYouTubeWithGuard = useCallback((
        player: any,
        targetSec: number,
        reason: string,
        meta?: Record<string, unknown>,
    ) => {
        if (!player || typeof player.seekTo !== "function") return;
        const current = typeof player.getCurrentTime === "function" ? (player.getCurrentTime() || 0) : 0;
        const delta = Math.abs(current - targetSec);
        if (delta <= YT_SEEK_EPSILON_SEC) {
            logYt("seekTo-skipped", reason, () => ({ ...(meta || {}), target: targetSec, current, delta }));
            return;
        }
        logYt("seekTo", reason, () => ({ ...(meta || {}), target: targetSec, current, delta }));
        player.seekTo(targetSec, true);
    }, []);

    const playYouTubeWithGuard = useCallback((player: any, reason: string) => {
        if (!player || typeof player.playVideo !== "function") return;
        const state = getPlayerState(player);
        const playing = getYtStateCode("PLAYING");
        const buffering = getYtStateCode("BUFFERING");
        if (state === playing || state === buffering) {
            logYt("playVideo", `${reason}-skipped`, () => ({ state }));
            return;
        }
        logYt("playVideo", reason, () => ({ state }));
        player.playVideo();
    }, [getPlayerState, getYtStateCode]);

    const pauseYouTubeWithGuard = useCallback((player: any, reason: string) => {
        if (!player || typeof player.pauseVideo !== "function") return;
        const state = getPlayerState(player);
        const paused = getYtStateCode("PAUSED");
        const ended = getYtStateCode("ENDED");
        const unstarted = getYtStateCode("UNSTARTED");
        if (state === paused || state === ended || state === unstarted) {
            logYt("pauseVideo", `${reason}-skipped`, () => ({ state }));
            return;
        }
        logYt("pauseVideo", reason, () => ({ state }));
        player.pauseVideo();
    }, [getPlayerState, getYtStateCode]);

    const stopYouTubeWithLog = useCallback((player: any, reason: string) => {
        if (!player || typeof player.stopVideo !== "function") return;
        const state = getPlayerState(player);
        const unstarted = getYtStateCode("UNSTARTED");
        const ended = getYtStateCode("ENDED");
        if (state === unstarted || state === ended) {
            logYt("stopVideo", `${reason}-skipped`, () => ({ state }));
            return;
        }
        logYt("stopVideo", reason, () => ({ state }));
        player.stopVideo();
    }, [getPlayerState, getYtStateCode]);

    const applyYouTubeRemoteState = useCallback(({
        url,
        playing,
        loop,
        startedAt,
        reason,
        seq,
    }: {
        url: string;
        playing: boolean;
        loop: boolean;
        startedAt?: string;
        reason: "delta-event" | "bulk-restore";
        seq?: number;
    }) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.removeAttribute("src");
        }
        setCurrentTrack(url);
        setIsPlaying(playing);
        setIsLooping(loop);

        if (playing && startedAt) {
            const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
            if (isYouTubePlayerAttached()) {
                const currentId = ytPlayerRef.current?.getVideoData?.()?.video_id;
                const newId = getYouTubeVideoId(url);
                if (newId && currentId !== newId) {
                    // Vídeo diferente: seek deve ser aplicado via loadVideoById, não no vídeo atual
                    pendingSeekRef.current = elapsed;
                } else {
                    seekYouTubeWithGuard(ytPlayerRef.current, elapsed, reason, { seq });
                }
            } else {
                pendingSeekRef.current = elapsed;
            }
        }
    }, [isYouTubePlayerAttached, seekYouTubeWithGuard]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Evita herança de estado entre entradas/reloads de sessão.
    useEffect(() => {
        setCurrentTrack("");
        setIsPlaying(false);
        setYtAutoplayUnlocked(false);
        currentTrackRef.current = "";
        sawLiveMusicEventRef.current = false;
        lastMusicEventTsRef.current = 0;
        lastMusicSeqRef.current = 0;
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.removeAttribute("src");
        }
        try {
            pauseYouTubeWithGuard(ytPlayerRef.current, "session-reset");
            stopYouTubeWithLog(ytPlayerRef.current, "session-reset");
        } catch (_) { }
    }, [sessionId, pauseYouTubeWithGuard, stopYouTubeWithLog]);

    // Resetar unlock a cada nova faixa YouTube (cada troca de URL começa muda)
    useEffect(() => {
        if (isPlayableYouTubeUrl(currentTrack)) {
            if (!ytLocalGestureUnlockRef.current) {
                setYtAutoplayUnlocked(false);
            }
            setYtNeedsManualUnlock(false);
            ytPlayedRef.current = false;
            ytLocalGestureUnlockRef.current = false;
        }
    }, [currentTrack]);

    useEffect(() => {
        if (!isMounted) return;
        if (isPlayableYouTubeUrl(currentTrack)) return;
        if (ytPlayerRef.current) {
            try {
                ytPlayerRef.current.destroy?.();
            } catch (_) { }
            ytPlayerRef.current = null;
            ytReadyRef.current = false;
        }
    }, [isMounted, currentTrack]);

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

    const ensureYouTubeApi = useCallback((): Promise<any> => {
        if (window.YT?.Player) {
            return Promise.resolve(window.YT);
        }
        if (ytApiPromiseRef.current) {
            return ytApiPromiseRef.current;
        }
        ytApiPromiseRef.current = new Promise((resolve) => {
            const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
            if (!existing) {
                const script = document.createElement("script");
                script.src = "https://www.youtube.com/iframe_api";
                script.async = true;
                document.head.appendChild(script);
            }
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                previous?.();
                resolve(window.YT);
            };
        });
        return ytApiPromiseRef.current;
    }, []);

    useEffect(() => {
        if (!isMounted || !isPlayableYouTubeUrl(currentTrack)) return;
        let cancelled = false;
        const videoId = getYouTubeVideoId(currentTrack);
        if (!videoId) return;

        ensureYouTubeApi().then((YT) => {
            if (cancelled || !YT?.Player) return;
            const container = document.getElementById(ytContainerIdRef.current);
            if (!container || !container.isConnected) return;

            const existingIframe = ytPlayerRef.current?.getIframe?.();
            if (ytPlayerRef.current && (!existingIframe || !existingIframe.isConnected)) {
                try {
                    ytPlayerRef.current.destroy?.();
                } catch (_) { }
                ytPlayerRef.current = null;
                ytReadyRef.current = false;
            }

            if (!ytPlayerRef.current) {
                ytPlayerRef.current = new YT.Player(ytContainerIdRef.current, {
                    width: "200",
                    height: "112",
                    videoId,
                    host: "https://www.youtube.com",
                    playerVars: {
                        autoplay: isPlaying ? 1 : 0,
                        origin: window.location.origin,
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,
                        playsinline: 1,
                        rel: 0,
                    },
                    events: {
                        onReady: () => {
                            console.log("[MusicPlayer] YT_NATIVE_READY");
                            logStory61("MusicPlayer", "yt-onReady");
                            ytReadyRef.current = true;
                            try {
                                const targetVol = Math.round((isMutedRef.current ? 0 : volumeRef.current) * 100);
                                ytPlayerRef.current?.setVolume?.(targetVol);
                                if (isMutedRef.current || !ytAutoplayUnlocked) {
                                    ytPlayerRef.current?.mute?.();
                                } else {
                                    ytPlayerRef.current?.unMute?.();
                                }
                                if (pendingSeekRef.current !== null) {
                                    seekYouTubeWithGuard(
                                        ytPlayerRef.current,
                                        pendingSeekRef.current,
                                        "on-ready-pending-seek",
                                    );
                                    pendingSeekRef.current = null;
                                }
                                if (isPlayingRef.current) {
                                    playYouTubeWithGuard(ytPlayerRef.current, "on-ready-was-playing");
                                }
                            } catch (_) { }
                        },
                        onStateChange: (ev: any) => {
                            console.log("[MusicPlayer] YT_NATIVE_STATE:", ev?.data);
                            logStory61("MusicPlayer", "yt-onStateChange", { state: ev?.data });
                            if (ev?.data === YT.PlayerState.PLAYING) {
                                ytPlayedRef.current = true;
                                try {
                                    ytPlayerRef.current?.unMute?.();
                                    ytPlayerRef.current?.setVolume?.(Math.round((isMutedRef.current ? 0 : volumeRef.current) * 100));
                                } catch (_) { }
                                setYtAutoplayUnlocked(true);
                            } else if (ev?.data === YT.PlayerState.ENDED) {
                                handleTrackEndedRef.current?.();
                            }
                        },
                        onError: (e: any) => {
                            console.warn("[MusicPlayer] YT_ERROR:", e);
                            logStory61("MusicPlayer", "yt-onError", { error: e?.data });
                        }
                    }
                });
                return;
            }

            try {
                const currentId = ytPlayerRef.current?.getVideoData?.()?.video_id;
                if (currentId !== videoId) {
                    const startSec = pendingSeekRef.current;
                    pendingSeekRef.current = null;
                    ytPlayerRef.current?.loadVideoById?.({ videoId, startSeconds: startSec ?? 0 });
                }
            } catch (_) { }
        });

        return () => {
            cancelled = true;
        };
    }, [isMounted, currentTrack, isPlaying, ensureYouTubeApi, ytAutoplayUnlocked, playYouTubeWithGuard, seekYouTubeWithGuard]);

    useEffect(() => {
        if (!isPlayableYouTubeUrl(currentTrack) || !isYouTubePlayerAttached()) return;
        try {
            ytPlayerRef.current?.setVolume?.(Math.round((isMuted ? 0 : volume) * 100));
            if (isMuted || !ytAutoplayUnlocked) {
                ytPlayerRef.current?.mute?.();
            } else {
                ytPlayerRef.current?.unMute?.();
            }
            if (isPlaying) {
                playYouTubeWithGuard(ytPlayerRef.current, "state-sync-effect");
            } else {
                pauseYouTubeWithGuard(ytPlayerRef.current, "state-sync-effect");
            }
        } catch (_) { }
    }, [currentTrack, isMuted, volume, isPlaying, ytAutoplayUnlocked, isYouTubePlayerAttached, pauseYouTubeWithGuard, playYouTubeWithGuard]);

    useEffect(() => {
        snapshotInitRef.current = false;
        const unsubscribe = globalEventStore.subscribe((event: any) => {
            logStory61("MusicPlayer", "event-received", { type: event.type, seq: event.seq });
            if (event.type === "SFX_TRIGGERED") {
                const sfxUrl = getSupabaseUrl(event.payload.url);
                if (sfxUrl) {
                    const sfx = new Audio(sfxUrl);
                    sfx.volume = isMutedRef.current ? 0 : volumeRef.current;
                    sfx.play().catch(e => console.warn("SFX blocked:", e));
                }
            } else if (event.type === "MUSIC_PLAYBACK_CHANGED") {
                const eventSeq = Number(event.seq || 0);
                if (eventSeq > 0 && lastMusicSeqRef.current > 0 && eventSeq < lastMusicSeqRef.current) {
                    console.log("[MusicPlayer] Ignoring stale MUSIC_PLAYBACK_CHANGED seq");
                    return;
                }
                const eventTs = new Date(event.createdAt || 0).getTime();
                if (
                    Number.isFinite(eventTs) &&
                    eventTs > 0 &&
                    lastMusicEventTsRef.current > 0 &&
                    eventTs < lastMusicEventTsRef.current
                ) {
                    console.log("[MusicPlayer] Ignoring stale MUSIC_PLAYBACK_CHANGED event");
                    return;
                }
                if (eventSeq > 0) {
                    lastMusicSeqRef.current = eventSeq;
                }
                lastMusicEventTsRef.current = eventTs > 0 ? eventTs : Date.now();
                sawLiveMusicEventRef.current = true;

                const { url: rawUrl, playing, loop, isTemporary, restoreUrl, restoreLoop } = event.payload;
                const url = normalizeYouTubeUrl(rawUrl);

                if (isYouTubeUrl(url) && !isPlayableYouTubeUrl(url)) {
                    console.warn("[MusicPlayer] Ignoring non-playable YouTube URL:", url);
                    return;
                }

                if (isPlayableYouTubeUrl(url)) {
                    applyYouTubeRemoteState({
                        url,
                        playing,
                        loop,
                        startedAt: event.payload.startedAt,
                        reason: "delta-event",
                        seq: eventSeq > 0 ? eventSeq : undefined,
                    });
                    isTemporaryRef.current = !!isTemporary;
                    restoreUrlRef.current = restoreUrl || "";
                    restoreLoopRef.current = restoreLoop ?? true;
                    return;
                }

                if (audioRef.current) {
                    try {
                        if (isYouTubePlayerAttached()) {
                            pauseYouTubeWithGuard(ytPlayerRef.current, "delta-switch-to-audio");
                            stopYouTubeWithLog(ytPlayerRef.current, "delta-switch-to-audio");
                        }
                    } catch (_) { }

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
                                const errObj = e as any;
                                const noSupportedSource =
                                    errObj?.name === "NotSupportedError" ||
                                    /no supported source/i.test(String(errObj?.message || ""));
                                if (noSupportedSource || !audioRef.current?.src) {
                                    console.warn("[MusicPlayer] Unsupported source, skipping autoplay retry:", e);
                                    return;
                                }

                                console.warn("Autoplay blocked, scheduling retry on interaction:", e);
                                const unlock = async () => {
                                    if (!audioRef.current?.src) return;
                                    try {
                                        await audioRef.current?.play();
                                        console.log("Autoplay unlocked by interaction");
                                    } catch (err) {
                                        console.warn("Autoplay still blocked after interaction:", err);
                                    }
                                };
                                document.addEventListener('pointerdown', unlock, { once: true });
                                document.addEventListener('keydown', unlock, { once: true });
                                document.addEventListener('click', unlock, { once: true });
                                document.addEventListener('touchstart', unlock, { once: true });
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

            // Se já recebemos estado ao-vivo, nunca sobrepor com snapshot.
            if (sawLiveMusicEventRef.current) return;
            if (currentTrackRef.current) return;

            // Evento delta tem prioridade sobre snapshot (inclui startedAt para sync)
            const lastDeltaMusic = [...bulkEvents]
                .filter((e: any) => e.type === "MUSIC_PLAYBACK_CHANGED" && !e.payload?.isTemporary)
                .pop() as any;

            if (lastDeltaMusic) {
                const eventSeq = Number(lastDeltaMusic.seq || 0);
                if (eventSeq > 0) {
                    lastMusicSeqRef.current = eventSeq;
                }
                const eventTs = new Date(lastDeltaMusic.createdAt || 0).getTime();
                if (Number.isFinite(eventTs) && eventTs > 0) {
                    lastMusicEventTsRef.current = eventTs;
                }

                const payload = lastDeltaMusic.payload || {};
                const url = normalizeYouTubeUrl(payload.url || "");
                const playing = !!payload.playing;
                const loop = payload.loop ?? true;

                if (isYouTubeUrl(url) && !isPlayableYouTubeUrl(url)) {
                    console.warn("[MusicPlayer] Ignoring non-playable YouTube URL from bulk:", url);
                    return;
                }

                if (isPlayableYouTubeUrl(url)) {
                    applyYouTubeRemoteState({
                        url,
                        playing,
                        loop,
                        startedAt: payload.startedAt,
                        reason: "bulk-restore",
                        seq: eventSeq > 0 ? eventSeq : undefined,
                    });
                } else {
                    setCurrentTrack(url);
                    setIsPlaying(playing);
                    setIsLooping(loop);
                    if (audioRef.current) {
                        try {
                            if (isYouTubePlayerAttached()) {
                                pauseYouTubeWithGuard(ytPlayerRef.current, "bulk-switch-to-audio");
                                stopYouTubeWithLog(ytPlayerRef.current, "bulk-switch-to-audio");
                            }
                        } catch (_) { }

                        const fullUrl = getSupabaseUrl(url);
                        if (audioRef.current.src !== fullUrl && url) {
                            audioRef.current.src = fullUrl;
                            audioRef.current.load();
                        }

                        if (playing) {
                            if (payload.startedAt) {
                                const elapsed = (Date.now() - new Date(payload.startedAt).getTime()) / 1000;
                                if (Math.abs(audioRef.current.currentTime - elapsed) > 2) {
                                    audioRef.current.currentTime = elapsed % (audioRef.current.duration || 1);
                                }
                            }
                            audioRef.current.play().catch((e) => console.warn("Autoplay blocked on bulk music restore:", e));
                        } else {
                            audioRef.current.pause();
                        }
                        audioRef.current.loop = loop;
                    }
                }

                isTemporaryRef.current = !!payload.isTemporary;
                restoreUrlRef.current = payload.restoreUrl || "";
                restoreLoopRef.current = payload.restoreLoop ?? true;
                return;
            }

            const snap = globalEventStore.getSnapshotState() as any;
            const snapMusic = snap?.currentMusic;
            if (!snapMusic?.url) return;

            // Snapshot deve prevalecer no primeiro bootstrap da sessão para evitar
            // reaproveitar faixa antiga local (fenômeno de autoplay "fantasma").
            setCurrentTrack(normalizeYouTubeUrl(snapMusic.url));
            setIsPlaying(snapMusic.playing ?? false);
            setIsLooping(snapMusic.loop ?? true);
        }
        );

        return unsubscribe;
    }, [sessionId, userId, userRole, applyYouTubeRemoteState, getSupabaseUrl, isYouTubePlayerAttached, pauseYouTubeWithGuard, stopYouTubeWithLog]);

    const handleTrackChange = (track: string) => {
        const normalized = normalizeYouTubeUrl(track);
        if (isYouTubeUrl(normalized) && !isPlayableYouTubeUrl(normalized)) {
            console.warn("[MusicPlayer] Invalid YouTube URL (videoId ausente):", track);
            return;
        }
        if (isPlayableYouTubeUrl(normalized)) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.removeAttribute("src");
            }
            ytLocalGestureUnlockRef.current = true;
            setYtAutoplayUnlocked(true);
            setYtNeedsManualUnlock(false);
        } else {
            try {
                if (isYouTubePlayerAttached()) {
                    pauseYouTubeWithGuard(ytPlayerRef.current, "gm-track-change");
                    stopYouTubeWithLog(ytPlayerRef.current, "gm-track-change");
                }
            } catch (_) { }
        }
        setCurrentTrack(normalized);
        broadcastUpdate(normalized, true, isLooping);
    };

    const togglePlay = () => {
        const newState = !isPlaying;
        setIsPlaying(newState);
        broadcastUpdate(currentTrack, newState, isLooping);
    };

    /**
     * Remove a faixa atual de vez: limpa selecao, para audio/YouTube e
     * sincroniza com PLAYERs (broadcastUpdate com url=""). Diferente de
     * `togglePlay`, que apenas pausa mantendo a faixa selecionada para
     * retomada posterior.
     */
    const clearTrack = () => {
        try {
            stopYouTubeWithLog(ytPlayerRef.current, "gm-clear-track");
        } catch (_) { }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.removeAttribute("src");
        }
        setIsPlaying(false);
        setCurrentTrack("");
        currentTrackRef.current = "";
        broadcastUpdate("", false, isLooping);
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
        if (isYouTubeUrl(url) && !isPlayableYouTubeUrl(url)) {
            console.warn("[MusicPlayer] Blocking MUSIC_PLAYBACK_CHANGED for invalid YouTube URL:", url);
            return;
        }

        let startedAt: string | undefined = undefined;
        if (playing) {
            const now = Date.now();
            const currentSec = isPlayableYouTubeUrl(url)
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
        if (!isYouTubePlayerAttached()) return;
        const player: any = ytPlayerRef.current;
        if (!player) return;
        try {
            player.unMute?.();
            player.setVolume?.(Math.round((isMutedRef.current ? 0 : volumeRef.current) * 100));
            playYouTubeWithGuard(player, "unlock");
        } catch (_) { }

        setIsMuted(false);
        setYtAutoplayUnlocked(true);
        setYtNeedsManualUnlock(false);
        console.log(`[MusicPlayer] YT_UNLOCK_APPLIED — reason=${reason}`);
    }, [isYouTubePlayerAttached, playYouTubeWithGuard]);

    useEffect(() => {
        if (!isPlayableYouTubeUrl(currentTrack) || ytAutoplayUnlocked) return;
        const unlock = () => forceYouTubeAudioUnlock("first-user-gesture");
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("touchstart", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        return () => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("touchstart", unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, [currentTrack, ytAutoplayUnlocked, forceYouTubeAudioUnlock]);

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
            <div className="control-row">
                <input
                    type="text"
                    placeholder="URL do YouTube..."
                    value={youtubeInputUrl}
                    onChange={(e) => setYoutubeInputUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && isPlayableYouTubeUrl(youtubeInputUrl.trim())) {
                            handleTrackChange(youtubeInputUrl.trim());
                            setYoutubeInputUrl("");
                        }
                    }}
                    className="track-select youtube-url-input"
                />
                <button
                    className="control-btn"
                    onClick={() => {
                        if (isPlayableYouTubeUrl(youtubeInputUrl.trim())) {
                            handleTrackChange(youtubeInputUrl.trim());
                            setYoutubeInputUrl("");
                        }
                    }}
                    disabled={!isPlayableYouTubeUrl(youtubeInputUrl.trim())}
                    title="Tocar Link do YouTube"
                >
                    <Link size={12} />
                </button>
            </div>
            <div className="control-row actions">
                <button className="control-btn" onClick={playPrevious} disabled={currentPlaylistTracks.length === 0} title="Anterior">
                    <SkipBack size={14} />
                </button>
                <button className={`control-btn ${isPlaying ? "active" : ""}`} onClick={togglePlay} disabled={!currentTrack} title={isPlaying ? "Pausar (mantem faixa)" : "Tocar"}>
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="control-btn" onClick={playNext} disabled={currentPlaylistTracks.length === 0} title="Próxima">
                    <SkipForward size={14} />
                </button>
                <button className={`control-btn ${isLooping ? "active" : ""}`} onClick={toggleLoop} title="Loop">
                    <Repeat size={14} />
                </button>
                <button className="control-btn" onClick={clearTrack} disabled={!currentTrack} title="Remover faixa (parar de vez)">
                    <X size={14} />
                </button>
            </div>
        </>
    ) : (
        <div className="now-playing">
            <span className="scrolling-text">
                {isPlaying
                    ? (isPlayableYouTubeUrl(currentTrack)
                        ? "YouTube ▶"
                        : (currentTrack.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '') || "Reproduzindo..."))
                    : "Pausado"}
            </span>
        </div>
    );

    const handleTrackEnded = useCallback(() => {
        if (isLooping) {
            if (!isPlayableYouTubeUrl(currentTrack) && audioRef.current) {
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

    useEffect(() => {
        handleTrackEndedRef.current = handleTrackEnded;
    }, [handleTrackEnded]);

    return (
        <div
            className="music-player-container"
            style={unifiedMode ? { display: 'contents' } : { position: 'relative' }}
        >
            <audio ref={audioRef} onEnded={handleTrackEnded} />

            {isMounted && isPlayableYouTubeUrl(currentTrack) && (userRole !== "GM" || isPlaying) && (() => {
                return createPortal(
                    <div style={{
                        position: 'fixed',
                        left: '0',
                        top: '0',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                        opacity: 0.01,
                        pointerEvents: 'none',
                        zIndex: 1
                    }}>
                        <div id={ytContainerIdRef.current} style={{ width: "200px", height: "112px" }} />
                    </div>,
                    document.body
                );
            })()}

            {!unifiedMode && (
                <button
                    className={`player-toggle ${isPlaying ? "playing" : ""}`}
                    onClick={() => setShowControls(!showControls)}
                    title={isPlayableYouTubeUrl(currentTrack) ? "Reprodutor de Música (YouTube)" : "Reprodutor de Música"}
                >
                    <span style={{ fontSize: '0.8rem' }}>🎵</span>
                    {isPlaying && <span className="pulse-dot" />}
                    {isPlayableYouTubeUrl(currentTrack) && (
                        <Youtube
                            size={10}
                            style={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                color: '#ff0000',
                                background: '#1a1a1a',
                                borderRadius: '50%',
                                padding: '1px',
                            }}
                        />
                    )}
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
                    <div
                        className="unified-ch-label"
                        style={{
                            color: '#c5a059',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <span>MÚSICA</span>
                        {isPlayableYouTubeUrl(currentTrack) && (
                            <Youtube
                                size={11}
                                style={{ color: '#ff0000' }}
                                aria-label="YouTube"
                            />
                        )}
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
                    <div className="control-row">
                        <input
                            type="text"
                            placeholder="URL do YouTube..."
                            value={youtubeInputUrl}
                            onChange={(e) => setYoutubeInputUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && isPlayableYouTubeUrl(youtubeInputUrl.trim())) {
                                    handleTrackChange(youtubeInputUrl.trim());
                                    setYoutubeInputUrl("");
                                }
                            }}
                            className="track-select youtube-url-input"
                        />
                        <button
                            className="control-btn"
                            onClick={() => {
                                if (isPlayableYouTubeUrl(youtubeInputUrl.trim())) {
                                    handleTrackChange(youtubeInputUrl.trim());
                                    setYoutubeInputUrl("");
                                }
                            }}
                            disabled={!isPlayableYouTubeUrl(youtubeInputUrl.trim())}
                            title="Tocar Link do YouTube"
                        >
                            <Link size={12} />
                        </button>
                    </div>
                    <div className="control-row actions">
                        <button className="control-btn" onClick={playPrevious} disabled={currentPlaylistTracks.length === 0}>
                            <SkipBack size={12} />
                        </button>
                        <button className={`control-btn ${isPlaying ? "active" : ""}`} onClick={togglePlay} disabled={!currentTrack} title={isPlaying ? "Pausar (mantem faixa)" : "Tocar"}>
                            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <button className="control-btn" onClick={playNext} disabled={currentPlaylistTracks.length === 0}>
                            <SkipForward size={12} />
                        </button>
                        <button className={`control-btn ${isLooping ? "active" : ""}`} onClick={toggleLoop}>
                            <Repeat size={12} />
                        </button>
                        <button className="control-btn" onClick={clearTrack} disabled={!currentTrack} title="Remover faixa (parar de vez)">
                            <X size={12} />
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

function areMusicPlayerPropsEqual(prev: MusicPlayerProps, next: MusicPlayerProps): boolean {
    return (
        prev.sessionId === next.sessionId &&
        prev.userId === next.userId &&
        prev.userRole === next.userRole &&
        prev.unifiedMode === next.unifiedMode
    );
}

export const MusicPlayer = memo(MusicPlayerComponent, areMusicPlayerPropsEqual);
MusicPlayer.displayName = "MusicPlayer";

