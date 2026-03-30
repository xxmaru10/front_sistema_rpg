import { Folder, Image as ImageIcon, Music, Edit2, Scissors, Trash2 } from "lucide-react";
import { FileItem } from "@/hooks/useFileSystem";

interface FileItemCardProps {
    file?: FileItem;
    folder?: string;
    currentPath: string;
    isGM: boolean;
    onSelect?: (url: string) => void;
    onNavigate: (path: string) => void;
    handleRename: (name: string, isFolder: boolean) => void;
    handleDeleteFile: (name: string) => void;
    handleDeleteFolder: (name: string) => void;
    onMove: (path: string, name: string, isFolder: boolean) => void;
    getPublicUrl: (name: string) => string;
}

export function FileItemCard({
    file,
    folder,
    currentPath,
    isGM,
    onSelect,
    onNavigate,
    handleRename,
    handleDeleteFile,
    handleDeleteFolder,
    onMove,
    getPublicUrl
}: FileItemCardProps) {
    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <ImageIcon size={24} />;
        if (mimeType.startsWith('audio/')) return <Music size={24} />;
        return <Folder size={24} />;
    };

    if (folder) {
        const folderPath = currentPath ? `${currentPath}/${folder}` : folder;
        return (
            <div className="item-card" onClick={() => onNavigate(folderPath)}>
                <Folder size={40} className="item-icon" />
                <span className="item-name">{folder.toUpperCase()}</span>
                {isGM && (
                    <div className="card-actions-overlay">
                        <button className="card-mini-btn" onClick={(e) => { e.stopPropagation(); handleRename(folder, true); }} title="Renomear">
                            <Edit2 size={12} />
                        </button>
                        <button className="card-mini-btn" onClick={(e) => { e.stopPropagation(); onMove(folderPath, folder, true); }} title="Mover">
                            <Scissors size={12} />
                        </button>
                        <button className="card-mini-btn danger" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} title="Excluir">
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (file) {
        const fileName = file.name;
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        const isImage = file.metadata?.mimetype?.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        return (
            <div className="item-card" onClick={() => {
                const url = getPublicUrl(fileName);
                if (onSelect) onSelect(url);
                else { navigator.clipboard.writeText(url); alert('Link copiado!'); }
            }}>
                {isImage ? (
                    <img src={getPublicUrl(fileName)} className="preview-image" alt="" />
                ) : (
                    <div className="item-icon">{getFileIcon(file.metadata?.mimetype || '')}</div>
                )}
                <span className="item-name">{fileName}</span>
                {isGM && (
                    <div className="card-actions-overlay">
                        <button className="card-mini-btn" onClick={(e) => { e.stopPropagation(); handleRename(fileName, false); }} title="Renomear">
                            <Edit2 size={12} />
                        </button>
                        <button className="card-mini-btn" onClick={(e) => { e.stopPropagation(); onMove(filePath, fileName, false); }} title="Mover">
                            <Scissors size={12} />
                        </button>
                        <button className="card-mini-btn danger" onClick={(e) => { e.stopPropagation(); handleDeleteFile(fileName); }} title="Excluir">
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return null;
}
