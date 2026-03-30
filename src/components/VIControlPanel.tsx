import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SessionTools } from "./SessionTools";
import { useFileSystem } from "@/hooks/useFileSystem";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { ExplorerHeader } from "./VIControlPanel/ExplorerHeader";
import { FileItemCard } from "./VIControlPanel/FileItemCard";
import { AudioSettingsAside } from "./VIControlPanel/AudioSettingsAside";

interface VIControlPanelProps {
    sessionId: string;
    isGM: boolean;
    onSelect?: (url: string) => void;
    style?: React.CSSProperties;
    soundSettings?: Record<string, string>;
}

export function VIControlPanel({ sessionId, isGM, onSelect, style, soundSettings = {} }: VIControlPanelProps) {
    const {
        currentPath,
        setCurrentPath,
        files,
        folders,
        loading,
        uploading,
        movingItem,
        setMovingItem,
        showNewFolderInput,
        setShowNewFolderInput,
        newFolderName,
        setNewFolderName,
        handleUpload,
        handleCreateFolder,
        handleFileDelete,
        handleFolderDelete,
        handlePaste,
        handleRename,
        getPublicUrl,
    } = useFileSystem();

    const {
        allAudioFiles,
        fetchingAudio,
        mergedSoundSettings,
        updateSoundSetting,
        fetchAllAudioFiles
    } = useAudioSettings({ sessionId, soundSettings });

    // Session Tools Modal State
    const [showSessionTools, setShowSessionTools] = useState(false);

    // Refresh audio list when file system changes if needed
    const onFileSystemChange = () => {
        fetchAllAudioFiles();
    };

    return (
        <div className="vi-layout animate-reveal" style={style}>
            <style jsx>{`
                .vi-layout {
                    height: calc(100vh - 120px);
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(var(--accent-rgb), 0.1);
                    border-radius: 12px;
                    overflow: hidden;
                    display: grid;
                    grid-template-columns: 1fr 300px;
                }

                .file-explorer {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    overflow: hidden;
                    border-right: 1px solid rgba(var(--accent-rgb), 0.1);
                }

                :global(.audio-settings) {
                    padding: 24px;
                    background: rgba(var(--accent-rgb), 0.03);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    overflow-y: auto;
                }

                :global(.settings-title) {
                    font-family: var(--font-header);
                    font-size: 1rem;
                    color: var(--accent-color);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 5px;
                    letter-spacing: 0.1em;
                }

                :global(.setting-group) {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                :global(.setting-label) {
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    opacity: 0.8;
                    letter-spacing: 0.1em;
                }

                :global(.audio-select) {
                    background: #0a0a0a;
                    border: 1px solid rgba(var(--accent-rgb), 0.3);
                    color: var(--text-primary);
                    padding: 8px;
                    font-family: var(--font-main);
                    font-size: 0.75rem;
                    border-radius: 4px;
                    width: 100%;
                }

                :global(.audio-select:focus) {
                    border-color: var(--accent-color);
                    outline: none;
                }

                :global(.vi-header) {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                
                :global(.breadcrumbs) {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: var(--font-header);
                    font-size: 1rem;
                    color: var(--accent-color);
                }

                :global(.breadcrumb-segment) {
                    cursor: pointer;
                    opacity: 0.7;
                    transition: 0.2s;
                    border: none;
                    background: none;
                    color: inherit;
                }
                :global(.breadcrumb-segment:hover) { opacity: 1; }
                
                .content-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                    gap: 12px;
                    overflow-y: auto;
                    flex: 1;
                    align-content: start;
                }
                
                :global(.item-card) {
                    background: rgba(var(--accent-rgb), 0.05);
                    border: 1px solid rgba(var(--accent-rgb), 0.1);
                    border-radius: 8px;
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }
                
                :global(.item-card:hover) {
                    background: rgba(var(--accent-rgb), 0.1);
                    border-color: var(--accent-color);
                    transform: translateY(-2px);
                }
                
                :global(.item-icon) {
                    color: var(--accent-color);
                }
                
                :global(.item-name) {
                    font-family: var(--font-main);
                    font-size: 0.75rem;
                    text-align: center;
                    word-break: break-all;
                    opacity: 0.8;
                }
                
                :global(.preview-image) {
                    width: 100%;
                    height: 80px;
                    object-fit: cover;
                    border-radius: 4px;
                }
                
                :global(.actions-bar) {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }
                
                :global(.btn-action) {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 14px;
                    background: rgba(var(--accent-rgb), 0.1);
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: 0.2s;
                }
                
                :global(.btn-action:hover:not(:disabled)) {
                    background: var(--accent-color);
                    color: #000;
                }

                .empty-folder {
                    grid-column: 1/-1;
                    text-align: center;
                    opacity: 0.4;
                    padding: 40px;
                    font-family: var(--font-header);
                    letter-spacing: 0.1em;
                }

                .settings-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0,0,0,0.8);
                    z-index: 100;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .settings-modal {
                    width: 500px;
                    max-width: 95%;
                    max-height: 90vh;
                    overflow-y: auto;
                    background: #080808;
                    border: 1px solid var(--accent-color);
                    padding: 20px;
                    box-shadow: 0 0 40px rgba(0,0,0,0.8);
                }

                :global(.moving-indicator) {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(var(--accent-rgb), 0.1);
                    padding: 2px 12px;
                    border: 1px dashed var(--accent-color);
                    border-radius: 6px;
                    font-family: var(--font-header);
                    font-size: 0.7rem;
                    color: var(--accent-color);
                    animation: moving-pulse 2s infinite;
                }

                @keyframes moving-pulse {
                    0% { border-color: var(--accent-color); opacity: 0.8; }
                    50% { border-color: #fff; opacity: 1; }
                    100% { border-color: var(--accent-color); opacity: 0.8; }
                }

                :global(.card-actions-overlay) {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    display: flex;
                    gap: 4px;
                    opacity: 0;
                    transition: 0.2s;
                    z-index: 10;
                }

                :global(.item-card:hover .card-actions-overlay) { opacity: 1; }

                :global(.card-mini-btn) {
                    background: rgba(0,0,0,0.8);
                    border: 1px solid rgba(var(--accent-rgb), 0.3);
                    color: var(--accent-color);
                    padding: 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: 0.2s;
                }

                :global(.card-mini-btn:hover) { background: var(--accent-color); color: #000; }
                :global(.card-mini-btn.danger:hover) { background: #ff4444 !important; color: #fff !important; border-color: #ff4444 !important; }
            `}</style>
            
            <style jsx global>{`
                .settings-modal .session-tools-container {
                    padding: 0 !important;
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .settings-modal .tool-section { margin-bottom: 24px; }
            `}</style>

            <div className="file-explorer">
                <ExplorerHeader
                    currentPath={currentPath}
                    setCurrentPath={setCurrentPath}
                    isGM={isGM}
                    movingItem={movingItem}
                    setMovingItem={setMovingItem}
                    handlePaste={() => handlePaste(onFileSystemChange)}
                    setShowSessionTools={setShowSessionTools}
                    showNewFolderInput={showNewFolderInput}
                    setShowNewFolderInput={setShowNewFolderInput}
                    newFolderName={newFolderName}
                    setNewFolderName={setNewFolderName}
                    handleCreateFolder={handleCreateFolder}
                    handleUpload={(e) => handleUpload(e, onFileSystemChange)}
                    uploading={uploading}
                />

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Loader2 className="animate-spin" size={32} color="var(--accent-color)" />
                    </div>
                ) : (
                    <div className="content-grid scrollbar-arcane">
                        {currentPath && (
                            <div className="item-card" onClick={() => { 
                                const p = currentPath.split('/'); 
                                p.pop(); 
                                setCurrentPath(p.join('/')); 
                            }}>
                                <ArrowLeft size={32} className="item-icon" />
                                <span className="item-name">..</span>
                            </div>
                        )}

                        {folders.map(folder => (
                            <FileItemCard
                                key={folder}
                                folder={folder}
                                currentPath={currentPath}
                                isGM={isGM}
                                onNavigate={setCurrentPath}
                                handleRename={(name, isFolder) => handleRename(name, isFolder, onFileSystemChange)}
                                handleDeleteFolder={(name) => handleFolderDelete(name, onFileSystemChange)}
                                handleDeleteFile={(name) => handleFileDelete(name, onFileSystemChange)}
                                onMove={(path, name, isFolder) => setMovingItem({ path, name, isFolder })}
                                getPublicUrl={getPublicUrl}
                            />
                        ))}

                        {files.map(file => (
                            <FileItemCard
                                key={file.id}
                                file={file}
                                currentPath={currentPath}
                                isGM={isGM}
                                onSelect={onSelect}
                                onNavigate={setCurrentPath}
                                handleRename={(name, isFolder) => handleRename(name, isFolder, onFileSystemChange)}
                                handleDeleteFolder={(name) => handleFolderDelete(name, onFileSystemChange)}
                                handleDeleteFile={(name) => handleFileDelete(name, onFileSystemChange)}
                                onMove={(path, name, isFolder) => setMovingItem({ path, name, isFolder })}
                                getPublicUrl={getPublicUrl}
                            />
                        ))}

                        {folders.length === 0 && files.length === 0 && <div className="empty-folder">PASTA VAZIA</div>}
                    </div>
                )}
            </div>

            <AudioSettingsAside
                fetchingAudio={fetchingAudio}
                allAudioFiles={allAudioFiles}
                mergedSoundSettings={mergedSoundSettings}
                updateSoundSetting={updateSoundSetting}
            />

            {showSessionTools && (
                <div className="settings-modal-overlay" onClick={() => setShowSessionTools(false)}>
                    <div className="settings-modal" onClick={e => e.stopPropagation()}>
                        <SessionTools
                            sessionId={sessionId}
                            onImport={() => window.location.reload()} // Simple reload on import
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
