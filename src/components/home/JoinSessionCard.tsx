import { Users, Play, Shield } from "lucide-react";

interface SessionData {
    id: string;
    name: string;
    gmUserId: string;
}

interface JoinSessionCardProps {
    sessions: SessionData[];
    loadingSessions: boolean;
    selectedSession: SessionData | null;
    setSelectedSession: (s: SessionData | null) => void;
    joinRole: "PLAYER" | "GM";
    setJoinRole: (r: "PLAYER" | "GM") => void;
    accessCodeInput: string;
    setAccessCodeInput: (c: string) => void;
    onJoin: () => void;
    isJoining: boolean;
}

export function JoinSessionCard({
    sessions,
    loadingSessions,
    selectedSession,
    setSelectedSession,
    joinRole,
    setJoinRole,
    accessCodeInput,
    setAccessCodeInput,
    onJoin,
    isJoining
}: JoinSessionCardProps) {
    return (
        <div className="tarot-card action-card join-table-card">
            <div className="tarot-inner">
                <div className="tarot-body">
                    <div className="icon-wrapper">
                        <Users size={48} />
                    </div>
                    <h3 className="victorian-title">UNIR-SE À MESA</h3>

                    <div className="selection-area">
                        {loadingSessions ? (
                            <div className="loading-text">Buscando sessões...</div>
                        ) : (
                            <>
                                <select
                                    className="mystic-select"
                                    value={selectedSession?.id || ""}
                                    onChange={(e) => {
                                        const sess = sessions.find(s => s.id === e.target.value);
                                        setSelectedSession(sess || null);
                                        setJoinRole('PLAYER'); // Reset role on change
                                        setAccessCodeInput("");
                                    }}
                                >
                                    <option value="">Selecione uma mesa...</option>
                                    {sessions.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} (Mestre: {s.gmUserId})
                                        </option>
                                    ))}
                                </select>

                                {selectedSession && (
                                    <div className="role-selector animate-fade-in">
                                        <label className="role-option">
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={joinRole === 'PLAYER'}
                                                onChange={() => setJoinRole('PLAYER')}
                                            />
                                            <div className="role-box">
                                                <Play size={16} />
                                                <span>JOGADOR</span>
                                            </div>
                                        </label>

                                        <label className="role-option">
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={joinRole === 'GM'}
                                                onChange={() => setJoinRole('GM')}
                                            />
                                            <div className="role-box">
                                                <Shield size={16} />
                                                <span>MESTRE</span>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {selectedSession && (
                                    <div className="gm-code-area animate-fade-in">
                                        <input
                                            className="mystic-input"
                                            placeholder={joinRole === 'GM' ? "Código de Mestre" : "Código da Mesa"}
                                            value={accessCodeInput}
                                            onChange={(e) => setAccessCodeInput(e.target.value)}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        className="mystic-btn secondary-btn"
                        onClick={onJoin}
                        disabled={!selectedSession || !accessCodeInput || isJoining}
                    >
                        {isJoining ? 'ENTRANDO...' : 'ENTRAR'}
                    </button>
                </div>
            </div>
        </div>
    );
}
