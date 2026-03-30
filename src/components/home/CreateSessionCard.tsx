import { Plus } from "lucide-react";

interface CreateSessionCardProps {
    userName: string;
    setUserName: (v: string) => void;
    sessionName: string;
    setSessionName: (v: string) => void;
    customGmCode: string;
    setCustomGmCode: (v: string) => void;
    customPlayerCode: string;
    setCustomPlayerCode: (v: string) => void;
    onCreate: () => void;
}

export function CreateSessionCard({
    userName,
    setUserName,
    sessionName,
    setSessionName,
    customGmCode,
    setCustomGmCode,
    customPlayerCode,
    setCustomPlayerCode,
    onCreate
}: CreateSessionCardProps) {
    return (
        <div className="tarot-card action-card new-table-card">
            <div className="tarot-inner">
                <div className="tarot-body">
                    <div className="icon-wrapper">
                        <Plus size={48} />
                    </div>
                    <h3 className="victorian-title">NOVA MESA</h3>

                    <div className="input-group">
                        <input
                            className="mystic-input"
                            placeholder="Nome do Mestre"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                        <input
                            className="mystic-input"
                            placeholder="Nome da Sessão"
                            value={sessionName}
                            onChange={(e) => setSessionName(e.target.value)}
                        />
                        <input
                            className="mystic-input"
                            placeholder="Cód. Mestre (Opcional)"
                            value={customGmCode}
                            onChange={(e) => setCustomGmCode(e.target.value)}
                        />
                        <input
                            className="mystic-input"
                            placeholder="Cód. Jogador (Opcional)"
                            value={customPlayerCode}
                            onChange={(e) => setCustomPlayerCode(e.target.value)}
                        />
                    </div>

                    <button className="mystic-btn primary-btn" onClick={onCreate}>
                        CRIAR CAMPANHA
                    </button>
                </div>
            </div>
        </div>
    );
}
