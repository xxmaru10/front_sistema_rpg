import { useEffect, useRef, useState } from "react";
import { Users, Play, Shield, ChevronDown } from "lucide-react";

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
    const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
    const sessionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (sessionMenuRef.current && target && !sessionMenuRef.current.contains(target)) {
                setIsSessionMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, []);

    const handleSelectSession = (session: SessionData | null) => {
        setSelectedSession(session);
        setJoinRole("PLAYER");
        setAccessCodeInput("");
        setIsSessionMenuOpen(false);
    };

    return (
        <div className="tarot-card action-card join-table-card">
            <div className="tarot-inner">
                <div className="tarot-body">
                    <div className="icon-wrapper">
                        <Users size={48} />
                    </div>
                    <h3 className="victorian-title">UNIR-SE A MESA</h3>

                    <div className="selection-area">
                        {loadingSessions ? (
                            <div className="loading-text">Buscando sessoes...</div>
                        ) : (
                            <>
                                <div className="session-select-shell" ref={sessionMenuRef}>
                                    <button
                                        type="button"
                                        className={`mystic-select mystic-select-trigger ${isSessionMenuOpen ? "open" : ""}`}
                                        onClick={() => setIsSessionMenuOpen((prev) => !prev)}
                                        aria-expanded={isSessionMenuOpen}
                                        aria-haspopup="listbox"
                                    >
                                        <span>
                                            {selectedSession
                                                ? `${selectedSession.name} (Mestre: ${selectedSession.gmUserId})`
                                                : "Selecione uma mesa..."}
                                        </span>
                                        <ChevronDown size={16} className={`session-select-chevron ${isSessionMenuOpen ? "open" : ""}`} />
                                    </button>

                                    {isSessionMenuOpen && (
                                        <div className="session-select-dropdown global-dropdown scrollbar-arcane" role="listbox">
                                            <button
                                                type="button"
                                                className={`session-select-option ${!selectedSession ? "selected" : ""}`}
                                                onClick={() => handleSelectSession(null)}
                                            >
                                                Selecione uma mesa...
                                            </button>
                                            {sessions.map((session) => (
                                                <button
                                                    key={session.id}
                                                    type="button"
                                                    className={`session-select-option ${selectedSession?.id === session.id ? "selected" : ""}`}
                                                    onClick={() => handleSelectSession(session)}
                                                >
                                                    {session.name} (Mestre: {session.gmUserId})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedSession && (
                                    <div className="role-selector animate-fade-in">
                                        <label className="role-option">
                                            <input
                                                type="radio"
                                                name="role"
                                                checked={joinRole === "PLAYER"}
                                                onChange={() => setJoinRole("PLAYER")}
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
                                                checked={joinRole === "GM"}
                                                onChange={() => setJoinRole("GM")}
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
                                            placeholder={joinRole === "GM" ? "Codigo de Mestre" : "Codigo da Mesa"}
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
                        {isJoining ? "ENTRANDO..." : "ENTRAR"}
                    </button>
                </div>
            </div>
        </div>
    );
}
