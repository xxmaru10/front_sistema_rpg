import { Folder, Settings, Plus, Upload, Loader2, Clipboard, X } from "lucide-react";
import { MovingItem } from "@/hooks/useFileSystem";

interface ExplorerHeaderProps {
    currentPath: string;
    setCurrentPath: (path: string) => void;
    isGM: boolean;
    movingItem: MovingItem | null;
    setMovingItem: (item: MovingItem | null) => void;
    handlePaste: () => void;
    setShowSessionTools: (show: boolean) => void;
    showNewFolderInput: boolean;
    setShowNewFolderInput: (show: boolean) => void;
    newFolderName: string;
    setNewFolderName: (name: string) => void;
    handleCreateFolder: () => void;
    handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    uploading: boolean;
}

export function ExplorerHeader({
    currentPath,
    setCurrentPath,
    isGM,
    movingItem,
    setMovingItem,
    handlePaste,
    setShowSessionTools,
    showNewFolderInput,
    setShowNewFolderInput,
    newFolderName,
    setNewFolderName,
    handleCreateFolder,
    handleUpload,
    uploading
}: ExplorerHeaderProps) {
    return (
        <div className="vi-header">
            <div className="breadcrumbs">
                <button className="breadcrumb-segment" onClick={() => setCurrentPath("")}>
                    <Folder size={18} />
                </button>
                {currentPath.split('/').filter(Boolean).map((segment, index, arr) => (
                    <div key={segment} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>/</span>
                        <button className="breadcrumb-segment" onClick={() => setCurrentPath(arr.slice(0, index + 1).join('/'))}>
                            {segment.toUpperCase()}
                        </button>
                    </div>
                ))}
            </div>

            <div className="actions-bar">
                {isGM && movingItem && (
                    <div className="moving-indicator">
                        <span>Movendo: <b>{movingItem.name.toUpperCase()}</b></span>
                        <button className="btn-action" onClick={handlePaste} style={{ borderColor: '#4ade80', color: '#4ade80' }}>
                            <Clipboard size={14} /> COLAR
                        </button>
                        <button className="btn-action" onClick={() => setMovingItem(null)} style={{ borderColor: '#f87171', color: '#f87171' }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {isGM && (
                    <button className="btn-action" onClick={() => setShowSessionTools(true)} title="Configurações da Sessão">
                        <Settings size={14} />
                    </button>
                )}

                {showNewFolderInput ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                            style={{ background: '#000', border: '1px solid var(--accent-color)', color: '#fff', padding: '4px', fontSize: '0.8rem', width: '100px' }}
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Nome"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolderInput(false); }}
                        />
                        <button className="btn-action" onClick={handleCreateFolder}>OK</button>
                    </div>
                ) : (
                    <button className="btn-action" onClick={() => setShowNewFolderInput(true)}>
                        <Plus size={14} /> PASTA
                    </button>
                )}

                <label className="btn-action">
                    {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                    <span>UPLOAD</span>
                    <input type="file" hidden onChange={handleUpload} disabled={uploading} />
                </label>
            </div>
        </div>
    );
}
