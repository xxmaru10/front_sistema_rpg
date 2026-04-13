import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export const BUCKET_NAME = "campaign-uploads";

export interface FileItem {
    name: string;
    id: string; // path or id
    updated_at: string;
    metadata: {
        mimetype: string;
        size: number;
    };
}

export interface MovingItem {
    path: string;
    name: string;
    isFolder: boolean;
}

export function useFileSystem() {
    const [currentPath, setCurrentPath] = useState<string>(""); // Root is empty string
    const [files, setFiles] = useState<FileItem[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [movingItem, setMovingItem] = useState<MovingItem | null>(null);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    const sanitize = (name: string) => {
        return name.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/_{2,}/g, '_');
    };

    const listAllInPath = async (path: string) => {
        let results: string[] = [];
        const { data, error } = await supabase.storage.from(BUCKET_NAME).list(path, { limit: 1000 });
        if (error || !data) return results;

        for (const item of data) {
            const fullPath = path ? `${path}/${item.name}` : item.name;
            if (item.id) { // It's a file
                results.push(fullPath);
            } else { // It's a folder
                const subResults = await listAllInPath(fullPath);
                results = [...results, ...subResults];
            }
        }
        return results;
    };

    const fetchContent = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .storage
                .from(BUCKET_NAME)
                .list(currentPath, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) {
                console.error("Error fetching files:", error);
                return;
            }

            const detectedFolders: string[] = [];
            const detectedFiles: FileItem[] = [];

            data?.forEach((item: any) => {
                if (!item.id) {
                    detectedFolders.push(item.name);
                } else {
                    detectedFiles.push(item);
                }
            });

            setFolders(detectedFolders);
            setFiles(detectedFiles);
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    }, [currentPath]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, onComplete?: () => void) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setUploading(true);
        const file = e.target.files[0];
        const sanitizedName = sanitize(file.name);
        const filePath = currentPath ? `${currentPath}/${sanitizedName}` : sanitizedName;
        try {
            const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (error) throw error;
            fetchContent();
            if (onComplete) onComplete();
        } catch (error: any) {
            alert("Erro ao enviar arquivo: " + error.message);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const sanitizedFolder = sanitize(newFolderName.trim());
        const folderPath = currentPath ? `${currentPath}/${sanitizedFolder}` : sanitizedFolder;
        const dummyPath = `${folderPath}/.emptyFolderPlaceholder`;
        setUploading(true);
        try {
            const blob = new Blob([""], { type: "text/plain" });
            const { error } = await supabase.storage.from(BUCKET_NAME).upload(dummyPath, blob);
            if (error) throw error;
            setNewFolderName("");
            setShowNewFolderInput(false);
            fetchContent();
        } catch (error: any) {
            alert("Erro ao criar pasta: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleFileDelete = async (fileName: string, onComplete?: () => void) => {
        if (!confirm(`Tem certeza que deseja deletar "${fileName}"?`)) return;
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        setLoading(true);
        try {
            const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);
            if (error) throw error;
            fetchContent();
            if (onComplete) onComplete();
        } catch (error: any) {
            alert("Erro ao deletar: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFolderDelete = async (folderName: string, onComplete?: () => void) => {
        if (!confirm(`Tem certeza que deseja deletar a pasta "${folderName}" e TODO o seu conteúdo?`)) return;
        const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        setLoading(true);
        try {
            const allFiles = await listAllInPath(folderPath);
            if (allFiles.length > 0) {
                const { error } = await supabase.storage.from(BUCKET_NAME).remove(allFiles);
                if (error) throw error;
            }
            await supabase.storage.from(BUCKET_NAME).remove([`${folderPath}/.emptyFolderPlaceholder`]);
            fetchContent();
            if (onComplete) onComplete();
        } catch (error: any) {
            alert("Erro ao deletar pasta: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePaste = async (onComplete?: () => void) => {
        if (!movingItem) return;

        if (movingItem.isFolder && (currentPath === movingItem.path || currentPath.startsWith(movingItem.path + "/"))) {
            alert("Não é possível mover uma pasta para dentro dela mesma ou de uma subpasta sua!");
            setMovingItem(null);
            return;
        }

        setLoading(true);
        try {
            const destPath = currentPath ? `${currentPath}/${movingItem.name}` : movingItem.name;
            
            if (destPath === movingItem.path) {
                setMovingItem(null);
                setLoading(false);
                return;
            }

            if (movingItem.isFolder) {
                const allFiles = await listAllInPath(movingItem.path);
                for (const file of allFiles) {
                    const relativePath = file.slice(movingItem.path.length);
                    const targetPath = destPath + relativePath;
                    await supabase.storage.from(BUCKET_NAME).move(file, targetPath);
                }
            } else {
                const { error } = await supabase.storage.from(BUCKET_NAME).move(movingItem.path, destPath);
                if (error) throw error;
            }
            
            setMovingItem(null);
            fetchContent();
            if (onComplete) onComplete();
        } catch (error: any) {
            alert("Erro ao mover: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async (oldName: string, isFolder: boolean, onComplete?: () => void) => {
        const newName = prompt(`Novo nome para "${oldName}":`, oldName);
        if (!newName || newName === oldName) return;
        
        const sanitizedNew = sanitize(newName);
        const oldPath = currentPath ? `${currentPath}/${oldName}` : oldName;
        const newPath = currentPath ? `${currentPath}/${sanitizedNew}` : sanitizedNew;
        
        setLoading(true);
        try {
            if (isFolder) {
                const allFiles = await listAllInPath(oldPath);
                for (const file of allFiles) {
                    const relativePath = file.slice(oldPath.length);
                    const targetPath = newPath + relativePath;
                    await supabase.storage.from(BUCKET_NAME).move(file, targetPath);
                }
            } else {
                const { error } = await supabase.storage.from(BUCKET_NAME).move(oldPath, newPath);
                if (error) throw error;
            }
            fetchContent();
            if (onComplete) onComplete();
        } catch (error: any) {
            alert("Erro ao renomear: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getPublicUrl = (fileName: string) => {
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
        return data.publicUrl;
    };

    return {
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
        fetchContent
    };
}
