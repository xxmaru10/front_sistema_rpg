
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { Folder, Image as ImageIcon, ArrowLeft, Loader2, X, Upload, Info } from "lucide-react";

interface ImageLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
}

interface FileItem {
    name: string;
    id: string | null; // null if folder
    metadata?: {
        mimetype: string;
    };
}

export function ImageLibraryModal({ isOpen, onClose, onSelect }: ImageLibraryModalProps) {
    const [currentPath, setCurrentPath] = useState<string>("");
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    const BUCKET_NAME = "campaign-uploads";

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchContent();
        }
    }, [isOpen, currentPath]);

    const fetchContent = async () => {
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

            if (error) throw error;

            const mappedItems: FileItem[] = (data || []).map((item: any) => ({
                name: item.name,
                id: item.id,
                metadata: item.metadata
            }));

            // Filter out non-image files (keep folders and images)
            const filteredItems = mappedItems.filter(item =>
                !item.id || // It's a folder
                item.metadata?.mimetype?.startsWith('image/') || // It's an image mime
                item.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) // It has image extension
            );

            setItems(filteredItems);

        } catch (err) {
            console.error("Error fetching library:", err);
        } finally {
            setLoading(false);
        }
    };

    const getPublicUrl = (fileName: string) => {
        const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
        return data.publicUrl;
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert("A imagem deve ter no máximo 10MB.");
            return;
        }

        setLoading(true);
        try {
            const fileName = `${Date.now()}-${file.name}`;
            const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filePath, file);

            if (error) throw error;

            await fetchContent();
        } catch (err) {
            console.error("Upload error:", err);
            alert("Erro ao enviar imagem.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="library-overlay" onClick={onClose}>
            <div
                className="library-modal"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="library-header">
                    <h2 className="library-title">BIBLIOTECA DE IMAGENS</h2>
                    <button onClick={onClose} className="library-close-btn">
                        <X size={24} />
                    </button>
                </div>

                {/* Breadcrumbs / Nav */}
                <div className="library-nav">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                        <button
                            onClick={() => setCurrentPath("")}
                            disabled={!currentPath}
                            className={`nav-btn ${!currentPath ? 'disabled' : ''}`}
                        >
                            <Folder size={16} />
                        </button>
                        {currentPath && <span className="nav-sep">/</span>}
                        {currentPath.split('/').filter(Boolean).map((segment, index, arr) => (
                            <div key={segment} className="nav-segment-wrapper">
                                <span
                                    className="nav-segment"
                                    onClick={() => {
                                        const newPath = arr.slice(0, index + 1).join('/');
                                        setCurrentPath(newPath);
                                    }}
                                >
                                    {segment}
                                </span>
                                {index < arr.length - 1 && <span className="nav-sep">/</span>}
                            </div>
                        ))}
                    </div>

                    <label className="upload-label">
                        <Upload size={16} />
                        <span>Enviar Imagem</span>
                        <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
                    </label>
                </div>

                {/* Recommendations */}
                <div className="library-tips">
                    <Info size={14} style={{ color: '#c5a059' }} />
                    <p>
                        <strong>Tamanhos Recomendados:</strong> Resoluções até <strong>4096px</strong>. 
                        Para grades de 50px, use múltiplos de 50 (ex: 2000px para 40x40). 
                        Mantenha o arquivo abaixo de <strong>10MB</strong> (JPG/WebP preferencial).
                    </p>
                </div>

                {/* Grid */}
                <div className="library-content scrollbar-arcane">
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 size={40} className="spinning-loader" />
                        </div>
                    ) : (
                        <div className="library-grid">
                            {/* Back Button */}
                            {currentPath && (
                                <div
                                    className="library-card back-card"
                                    onClick={() => {
                                        const parts = currentPath.split('/');
                                        parts.pop();
                                        setCurrentPath(parts.join('/'));
                                    }}
                                >
                                    <ArrowLeft size={32} />
                                    <span>Voltar</span>
                                </div>
                            )}

                            {items.map(item => {
                                const isFolder = !item.id;
                                const url = !isFolder ? getPublicUrl(item.name) : null;

                                return (
                                    <div
                                        key={item.name}
                                        className="library-card"
                                        onClick={() => {
                                            if (isFolder) {
                                                setCurrentPath(currentPath ? `${currentPath}/${item.name}` : item.name);
                                            } else {
                                                if (url) {
                                                    onSelect(url);
                                                    onClose();
                                                }
                                            }
                                        }}
                                    >
                                        {isFolder ? (
                                            <div className="folder-content">
                                                <Folder size={48} strokeWidth={1.5} />
                                                <span className="card-label">{item.name}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <img
                                                    src={url!}
                                                    alt={item.name}
                                                    className="card-image"
                                                />
                                                <div className="image-overlay">
                                                    <p>{item.name}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}

                            {items.length === 0 && !loading && (
                                <div className="empty-msg">
                                    Pasta vazia
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .library-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(5px);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: fadeIn 0.2s ease-out;
                }

                .library-modal {
                    background: #111;
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    border-radius: 8px;
                    width: 800px;
                    height: 600px;
                    max-width: 90vw;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 0 40px rgba(0,0,0,0.8);
                    overflow: hidden;
                }

                .library-header {
                    padding: 16px;
                    background: rgba(0,0,0,0.4);
                    border-bottom: 1px solid rgba(197, 160, 89, 0.2);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .library-title {
                    color: #c5a059;
                    font-family: var(--font-header);
                    font-size: 1.2rem;
                    letter-spacing: 0.1em;
                    margin: 0;
                }

                .library-close-btn {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .library-close-btn:hover { color: #fff; }

                .library-nav {
                    padding: 12px;
                    background: rgba(255,255,255,0.02);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    color: #888;
                }

                .nav-btn {
                    background: none;
                    border: none;
                    color: #c5a059;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
                .nav-btn.disabled { opacity: 0.5; cursor: default; }
                
                .nav-segment-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .nav-segment {
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .nav-segment:hover { color: #c5a059; }
                
                .upload-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 12px;
                    background: rgba(197, 160, 89, 0.1);
                    border: 1px solid rgba(197, 160, 89, 0.3);
                    border-radius: 4px;
                    color: #c5a059;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: var(--font-header);
                }
                .upload-label:hover {
                    background: rgba(197, 160, 89, 0.2);
                    border-color: #c5a059;
                    box-shadow: 0 0 10px rgba(197, 160, 89, 0.1);
                }

                .library-tips {
                    padding: 10px 16px;
                    background: rgba(0,0,0,0.3);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .library-tips p {
                    margin: 0;
                    font-size: 0.75rem;
                    color: #888;
                    line-height: 1.5;
                }
                .library-tips strong { color: #c5a059; }

                .library-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: #080808;
                }

                .loading-container {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #c5a059;
                }

                .spinning-loader {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .library-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 16px;
                }

                .library-card {
                    aspect-ratio: 1;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 4px;
                    cursor: pointer;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s;
                }

                .library-card:hover {
                    border-color: #c5a059;
                    background: rgba(197, 160, 89, 0.1);
                    transform: translateY(-2px);
                }

                .folder-content {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    gap: 8px;
                }
                .library-card:hover .folder-content { color: #c5a059; }

                .card-label {
                    font-size: 0.8rem;
                    max-width: 90%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .card-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    opacity: 0.8;
                    transition: opacity 0.2s, transform 0.5s;
                }
                .library-card:hover .card-image {
                    opacity: 1;
                    transform: scale(1.1);
                }

                .image-overlay {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0,0,0,0.8);
                    padding: 4px;
                    transform: translateY(100%);
                    transition: transform 0.2s;
                }
                .library-card:hover .image-overlay { transform: translateY(0); }

                .image-overlay p {
                    margin: 0;
                    font-size: 0.7rem;
                    color: #ccc;
                    text-align: center;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .back-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    gap: 4px;
                    font-size: 0.8rem;
                }
                .back-card:hover { color: #c5a059; }

                .empty-msg {
                    grid-column: 1 / -1;
                    text-align: center;
                    color: #666;
                    margin-top: 40px;
                    font-style: italic;
                }

                .scrollbar-arcane::-webkit-scrollbar {
                    width: 8px;
                }
                .scrollbar-arcane::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                }
                .scrollbar-arcane::-webkit-scrollbar-thumb {
                    background: rgba(197, 160, 89, 0.2);
                    border-radius: 4px;
                }
            `}</style>
        </div>,
        document.body
    );
}
