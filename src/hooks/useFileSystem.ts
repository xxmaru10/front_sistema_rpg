import { useState, useEffect, useCallback } from "react";
import { listFiles, uploadToPath, deleteFile, moveFile, createFolder, getPublicUrl } from "@/lib/storageClient";

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

    const listAllInPath = async (path: string): Promise<string[]> => {
        const { files, folders } = await listFiles(path);
        let results: string[] = files.map((f: any) =>
          path ? `${path}/${f.name}` : f.name
        );
        for (const folder of folders) {
          const fullPath = path ? `${path}/${folder}` : folder;
          const subResults = await listAllInPath(fullPath);
          results = [...results, ...subResults];
        }
        return results;
      };

      const fetchContent = useCallback(async () => {
        setLoading(true);
        try {
          const { files: rawFiles, folders: rawFolders } = await listFiles(currentPath);
          setFolders(rawFolders);
          setFiles(rawFiles);
        } catch (err) {
          console.error('Error fetching files:', err);
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
        try {
          await uploadToPath(file, currentPath);
          fetchContent();
          if (onComplete) onComplete();
        } catch (error: any) {
          alert('Erro ao enviar arquivo: ' + error.message);
        } finally {
          setUploading(false);
          e.target.value = '';
        }
      };

      const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const sanitizedFolder = sanitize(newFolderName.trim());
        const folderPath = currentPath ? `${currentPath}/${sanitizedFolder}` : sanitizedFolder;
        setUploading(true);
        try {
          await createFolder(folderPath);
          setNewFolderName('');
          setShowNewFolderInput(false);
          fetchContent();
        } catch (error: any) {
          alert('Erro ao criar pasta: ' + error.message);
        } finally {
          setUploading(false);
        }
      };

      const handleFileDelete = async (fileName: string, onComplete?: () => void) => {
        if (!confirm(`Tem certeza que deseja deletar "${fileName}"?`)) return;
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        setLoading(true);
        try {
          await deleteFile(filePath);
          fetchContent();
          if (onComplete) onComplete();
        } catch (error: any) {
          alert('Erro ao deletar: ' + error.message);
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
          for (const filePath of allFiles) {
            await deleteFile(filePath);
          }
          fetchContent();
          if (onComplete) onComplete();
        } catch (error: any) {
          alert('Erro ao deletar pasta: ' + error.message);
        } finally {
          setLoading(false);
        }
      };

      const handlePaste = async (onComplete?: () => void) => {
        if (!movingItem) return;
      
        if (movingItem.isFolder && (
          currentPath === movingItem.path ||
          currentPath.startsWith(movingItem.path + '/')
        )) {
          alert('Não é possível mover uma pasta para dentro dela mesma!');
          setMovingItem(null);
          return;
        }
      
        setLoading(true);
        try {
          const destPath = currentPath ? `${currentPath}/${movingItem.name}` : movingItem.name;
          if (destPath === movingItem.path) { setMovingItem(null); return; }
      
          if (movingItem.isFolder) {
            const allFiles = await listAllInPath(movingItem.path);
            for (const filePath of allFiles) {
              const relativePath = filePath.slice(movingItem.path.length);
              await moveFile(filePath, destPath + relativePath);
            }
          } else {
            await moveFile(movingItem.path, destPath);
          }
      
          setMovingItem(null);
          fetchContent();
          if (onComplete) onComplete();
        } catch (error: any) {
          alert('Erro ao mover: ' + error.message);
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
            for (const filePath of allFiles) {
              const relativePath = filePath.slice(oldPath.length);
              await moveFile(filePath, newPath + relativePath);
            }
          } else {
            await moveFile(oldPath, newPath);
          }
          fetchContent();
          if (onComplete) onComplete();
        } catch (error: any) {
          alert('Erro ao renomear: ' + error.message);
        } finally {
          setLoading(false);
        }
      };

      const getPublicUrlForFile = (fileName: string) => {
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        return getPublicUrl(filePath);
      };

      return {
        currentPath, setCurrentPath,
        files, folders,
        loading, uploading,
        movingItem, setMovingItem,
        showNewFolderInput, setShowNewFolderInput,
        newFolderName, setNewFolderName,
        handleUpload, handleCreateFolder,
        handleFileDelete, handleFolderDelete,
        handlePaste, handleRename,
        getPublicUrl: getPublicUrlForFile,
        fetchContent,
      };
}
