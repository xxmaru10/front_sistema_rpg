import { useState, useEffect, useMemo, useCallback } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { listFiles } from "@/lib/storageClient";

export const DEFAULT_SOUND_SETTINGS = {
    victory: "/audio/Effects/vitoria.mp3",
    defeat: "/audio/Effects/derrota.mp3",
    death: "/audio/Effects/morte.mp3",
    battleStart: "/audio/Effects/battle_start.mp3"
};

export const THEME_SLOTS = [
    { key: 'victory', label: 'VITÓRIA', color: '#50a6ff' },
    { key: 'defeat', label: 'DERROTA', color: '#ff4444' },
    { key: 'hit', label: 'GOLPE', color: '#ffa500' },
    { key: 'death', label: 'MORTE', color: '#777' },
    { key: 'defense', label: 'DEFESA', color: '#44ff44' },
    { key: 'dice', label: 'DADOS', color: '#c5a059' },
    { key: 'portrait', label: 'RETRATO', color: '#a855f7' },
    { key: 'battleStart', label: 'INÍCIO COMBATE', color: '#f59e0b' }
];

interface UseAudioSettingsProps {
    sessionId: string;
    soundSettings?: Record<string, string>;
}

export function useAudioSettings({ sessionId, soundSettings = {} }: UseAudioSettingsProps) {
    const [allAudioFiles, setAllAudioFiles] = useState<string[]>([]);
    const [fetchingAudio, setFetchingAudio] = useState(false);

    const mergedSoundSettings = useMemo(() => ({
        ...DEFAULT_SOUND_SETTINGS,
        ...soundSettings
    }), [soundSettings]);

    const fetchAllAudioFiles = useCallback(async () => {
        setFetchingAudio(true);
        try {
            const audioFiles: string[] = [];

            const listAllS3 = async (path: string = '') => {
                const { files, folders } = await listFiles(path);
                for (const file of files) {
                    const fullPath = path ? `${path}/${file.name}` : file.name;
                    if (file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
                        audioFiles.push(fullPath);
                    }
                }
                for (const folder of folders) {
                    const fullPath = path ? `${path}/${folder}` : folder;
                    await listAllS3(fullPath);
                }
            };

            await listAllS3('');

            // Also fetch from local /api/music
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                const res = await fetch(`${apiUrl}/api/music`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.playlists) {
                        data.playlists.forEach((pl: any) => {
                            pl.tracks.forEach((trackPath: string) => {
                                const localUrl = `/audio/${trackPath}`;
                                if (!audioFiles.includes(localUrl)) audioFiles.push(localUrl);
                            });
                        });
                    }
                } else {
                    addDefaultAudios(audioFiles);
                }
            } catch {
                addDefaultAudios(audioFiles);
            }

            setAllAudioFiles(audioFiles.sort((a, b) => a.localeCompare(b)));
        } catch (e) {
            console.error('Error fetching all audio:', e);
        } finally {
            setFetchingAudio(false);
        }
    }, []);


    const addDefaultAudios = (audioFiles: string[]) => {
        const defaults = [
            '/audio/Effects/vitoria.mp3',
            '/audio/Effects/derrota.mp3',
            '/audio/Effects/morte.mp3',
            '/audio/Effects/battle_start.mp3',
            '/audio/Effects/atack.MP3',
            '/audio/Effects/defesa.MP3',
            '/audio/Effects/dados.MP3',
            '/audio/Effects/transicao_retrato.MP3',
        ];
        defaults.forEach(url => { if (!audioFiles.includes(url)) audioFiles.push(url); });
    };

    useEffect(() => {
        fetchAllAudioFiles();
    }, [fetchAllAudioFiles]);

    const updateSoundSetting = (key: string, value: string) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "SESSION_SOUNDS_UPDATED",
            actorUserId: "GM", // Simplified
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { [key]: value }
        } as any);
    };

    return {
        allAudioFiles,
        fetchingAudio,
        mergedSoundSettings,
        updateSoundSetting,
        fetchAllAudioFiles
    };
}
