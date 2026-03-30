import { Music, Loader2 } from "lucide-react";
import { THEME_SLOTS } from "@/hooks/useAudioSettings";

interface AudioSettingsAsideProps {
    fetchingAudio: boolean;
    allAudioFiles: string[];
    mergedSoundSettings: Record<string, string>;
    updateSoundSetting: (key: string, value: string) => void;
}

export function AudioSettingsAside({
    fetchingAudio,
    allAudioFiles,
    mergedSoundSettings,
    updateSoundSetting
}: AudioSettingsAsideProps) {
    return (
        <aside className="audio-settings scrollbar-arcane">
            <h3 className="settings-title"><Music size={18} /> SONS TEMÁTICOS</h3>

            {fetchingAudio ? (
                <div style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>
                    <Loader2 className="animate-spin inline mr-2" size={14} />Escaneando...
                </div>
            ) : (
                <>
                    {THEME_SLOTS.map(slot => (
                        <div key={slot.key} className="setting-group">
                            <label className="setting-label" style={{ color: slot.color }}>{slot.label}</label>
                            <select
                                className="audio-select"
                                value={(mergedSoundSettings as any)[slot.key] || ""}
                                onChange={(e) => updateSoundSetting(slot.key, e.target.value)}
                            >
                                <option value="">Nenhum</option>
                                {allAudioFiles.map(path => (
                                    <option key={path} value={path}>
                                        {path.split('/').pop()?.replace(/\.(mp3|wav|ogg|m4a|aac)$/i, '')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </>
            )}
        </aside>
    );
}
