
import { useState, useEffect } from "react";
import { Download, Upload, Trash2, Check, Copy, Edit2, Save, X, Settings, Music, Loader2 } from "lucide-react";
import { globalEventStore } from "@/lib/eventStore";
import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";

interface SessionToolsProps {
    sessionId: string;
    onImport: () => void;
}

export function SessionTools({ sessionId, onImport }: SessionToolsProps) {
    const [copiedGM, setCopiedGM] = useState(false);
    const [copiedPlayer, setCopiedPlayer] = useState(false);
    const [gmCode, setGmCode] = useState("");
    const [playerCode, setPlayerCode] = useState("");

    const [isEditing, setIsEditing] = useState(false);
    const [tempGmCode, setTempGmCode] = useState("");
    const [tempPlayerCode, setTempPlayerCode] = useState("");


    useEffect(() => {
        const updateCodes = () => {
            const events = globalEventStore.getEvents();

            // Check for updates first
            const updates = events
                .filter(e => e.sessionId === sessionId && e.type === "SESSION_CODES_UPDATED")
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            if (updates.length > 0 && updates[0].payload) {
                const p = updates[0].payload as any;
                setGmCode(p.gmCode);
                setPlayerCode(p.playerCode);
                return;
            }

            // Try to find the session created event
            const creationEvent = events.find(e => e.sessionId === sessionId && e.type === "SESSION_CREATED");

            if (creationEvent && creationEvent.payload) {
                // @ts-ignore
                const payload = creationEvent.payload as any;
                setGmCode(payload.gmCode || `${sessionId}-GM`);
                setPlayerCode(payload.playerCode || sessionId);
            } else {
                // Fallback defaults if event not loaded yet
                setGmCode(`${sessionId}-GM`);
                setPlayerCode(sessionId);
            }
        };

        // Initial check
        updateCodes();

        // Subscribe to updates
        const unsubscribe = globalEventStore.subscribe(() => {
            updateCodes();
        });

        return () => {
            unsubscribe();
        };
    }, [sessionId]);

    const startEditing = () => {
        setTempGmCode(gmCode);
        setTempPlayerCode(playerCode);
        setIsEditing(true);
    };

    const saveCodes = () => {
        if (!tempGmCode.trim() || !tempPlayerCode.trim()) return;
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "SESSION_CODES_UPDATED",
            actorUserId: "GM",
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { gmCode: tempGmCode.trim(), playerCode: tempPlayerCode.trim() }
        } as any);
        setIsEditing(false);
    };


    const handleExport = () => {
        const events = globalEventStore.getEvents().filter(e => e.sessionId === sessionId);
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `fate_session_${sessionId}_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedEvents = JSON.parse(event.target?.result as string);
                if (Array.isArray(importedEvents)) {
                    importedEvents.forEach(ev => {
                        const exists = globalEventStore.getEvents().some(existing => existing.id === ev.id);
                        if (!exists) globalEventStore.append(ev);
                    });
                    onImport();
                    alert("Sessão importada com sucesso!");
                }
            } catch (err) {
                alert("Erro ao importar arquivo JSON.");
            }
        };
        reader.readAsText(file);
    };

    const handleCopyGM = () => {
        navigator.clipboard.writeText(gmCode);
        setCopiedGM(true);
        setTimeout(() => setCopiedGM(false), 2000);
    };

    const handleCopyPlayer = () => {
        navigator.clipboard.writeText(playerCode);
        setCopiedPlayer(true);
        setTimeout(() => setCopiedPlayer(false), 2000);
    };

    const handleClear = () => {
        if (confirm("Tem certeza que deseja limpar o log LOCAL desta sessão? Isso não afetará outros usuários.")) {
            globalEventStore.clear();
            window.location.reload();
        }
    };


    return (
        <div className="session-tools tarot-style card animate-reveal">
            <div className="tarot-inner">
                <div className="tools-header">
                    <span className="symbol">🜔</span>
                    <h3>OPÇÕES DA SESSÃO</h3>
                </div>

                <div className="session-id-box">
                    <label>CÓDIGO DO MESTRE</label>
                    <div className="id-display gm-code">
                        {isEditing ? (
                            <input
                                className="code-input"
                                value={tempGmCode}
                                onChange={e => setTempGmCode(e.target.value)}
                            />
                        ) : (
                            <code>{gmCode.toUpperCase()}</code>
                        )}
                        {!isEditing && (
                            <button onClick={handleCopyGM} className="copy-btn">
                                {copiedGM ? <Check size={14} color="var(--accent-color)" /> : <Copy size={14} />}
                            </button>
                        )}
                    </div>
                </div>

                <div className="session-id-box">
                    <label>CÓDIGO DO JOGADOR</label>
                    <div className="id-display">
                        {isEditing ? (
                            <input
                                className="code-input"
                                value={tempPlayerCode}
                                onChange={e => setTempPlayerCode(e.target.value)}
                            />
                        ) : (
                            <code>{playerCode.toString().toUpperCase()}</code>
                        )}
                        {!isEditing && (
                            <button onClick={handleCopyPlayer} className="copy-btn">
                                {copiedPlayer ? <Check size={14} color="var(--accent-color)" /> : <Copy size={14} />}
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {!isEditing ? (
                        <button className="ritual-tool-btn" onClick={startEditing} style={{ justifyContent: 'center', width: '100%' }}>
                            <Edit2 size={16} />
                            <span>ALTERAR CÓDIGOS</span>
                        </button>
                    ) : (
                        <>
                            <button className="ritual-tool-btn" onClick={saveCodes} style={{ flex: 1, justifyContent: 'center', borderColor: '#4f4', color: '#4f4' }}>
                                <Save size={16} />
                                <span>SALVAR</span>
                            </button>
                            <button className="ritual-tool-btn" onClick={() => setIsEditing(false)} style={{ flex: 1, justifyContent: 'center', borderColor: '#f44', color: '#f44' }}>
                                <X size={16} />
                                <span>CANCELAR</span>
                            </button>
                        </>
                    )}
                </div>


                <div className="tools-grid">
                    <button onClick={handleExport} className="ritual-tool-btn">
                        <Download size={16} />
                        <span>SALVAR SESSÃO (BACKUP)</span>
                    </button>

                    <label className="ritual-tool-btn cursor-pointer">
                        <Upload size={16} />
                        <span>CARREGAR SESSÃO</span>
                        <input type="file" accept=".json" onChange={handleImport} hidden />
                    </label>

                    <button onClick={handleClear} className="ritual-tool-btn danger-ritual">
                        <Trash2 size={16} />
                        <span>LIMPAR DADOS LOCAIS</span>
                    </button>
                </div>
            </div>

            <style jsx>{`
                .session-tools { background: #080808; }
                .tarot-inner { padding: 32px; display: flex; flex-direction: column; gap: 32px; border: 1px solid rgba(197, 160, 89, 0.1); }
                
                .tools-header { display: flex; align-items: center; gap: 16px; border-bottom: 1px solid rgba(197, 160, 89, 0.1); padding-bottom: 16px; }
                .tools-header h3 { font-family: var(--font-header); font-size: 0.75rem; letter-spacing: 0.2em; color: var(--accent-color); margin: 0; }
                .symbol { color: var(--accent-color); font-size: 1.2rem; }

                .session-id-box { display: flex; flex-direction: column; gap: 14px; }
                .session-id-box label { font-family: var(--font-header); font-size: 0.6rem; letter-spacing: 0.15em; color: var(--accent-color); opacity: 0.7; }
                
                .id-display { 
                    display: flex; justify-content: space-between; align-items: center; 
                    background: rgba(197, 160, 89, 0.03); padding: 14px 18px; 
                    border: 1px solid rgba(197, 160, 89, 0.1);
                    min-height: 50px;
                }
                .code-input {
                    background: transparent;
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 1rem;
                    padding: 4px 8px;
                    width: 100%;
                    text-transform: uppercase;
                }
                code { font-family: var(--font-header); font-weight: 400; color: var(--accent-color); font-size: 0.9rem; letter-spacing: 0.05em; }
                .copy-btn { background: transparent; border: none; color: var(--accent-color); cursor: pointer; opacity: 0.6; transition: 0.3s; }
                .copy-btn:hover { opacity: 1; transform: scale(1.1); }

                .audio-settings-section {
                    display: flex;
                    flex-direction: column;
                    padding: 24px;
                    background: rgba(197, 160, 89, 0.02);
                    border: 1px solid rgba(197, 160, 89, 0.1);
                }

                .audio-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 16px;
                }

                .audio-slot {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .audio-slot label {
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    letter-spacing: 0.15em;
                }

                .audio-select {
                    background: #000;
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    color: #fff;
                    padding: 8px;
                    font-family: var(--font-main);
                    font-size: 0.8rem;
                    outline: none;
                }

                .audio-select:focus {
                    border-color: var(--accent-color);
                }

                .tools-grid { display: flex; flex-direction: column; gap: 12px; }
                
                .ritual-tool-btn { 
                    display: flex; align-items: center; gap: 14px; 
                    background: transparent; border: 1px solid rgba(197, 160, 89, 0.15); 
                    padding: 16px 20px; color: var(--accent-color); 
                    font-family: var(--font-header); font-size: 0.7rem; 
                    letter-spacing: 0.1em; cursor: pointer; text-align: left;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                }
                .ritual-tool-btn:hover { background: rgba(197, 160, 89, 0.05); border-color: var(--accent-color); box-shadow: 0 0 15px rgba(197, 160, 89, 0.1); }
                
                .danger-ritual:hover { border-color: #800; color: #f2f2f2; background: rgba(128, 0, 0, 0.1); }
                .cursor-pointer { cursor: pointer; }

                .animate-reveal {
                    opacity: 0;
                    animation: revealUp 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
                @keyframes revealUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
