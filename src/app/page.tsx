"use client";
// Atualização simples para trigger de deploy - 17/02/2026

import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { useState, useEffect } from "react";
import { Plus, Users, ChevronRight, Play, Shield } from "lucide-react";
import { CreateSessionCard } from "@/components/home/CreateSessionCard";
import { JoinSessionCard } from "@/components/home/JoinSessionCard";
import { CharacterSelection } from "@/components/home/CharacterSelection";
import { v4 as uuidv4 } from "uuid";
import { globalEventStore } from "@/lib/eventStore";
import * as apiClient from "@/lib/apiClient";

interface SessionData {
  id: string;
  name: string;
  gmUserId: string;
}

export default function Home() {
  const router = useRouter();

  // Estados de Criação
  const [userName, setUserName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [customGmCode, setCustomGmCode] = useState(""); // Novo estado para código do mestre
  const [customPlayerCode, setCustomPlayerCode] = useState(""); // Novo estado para código de jogador

  // Estados de Entrada
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [joinRole, setJoinRole] = useState<'PLAYER' | 'GM'>('PLAYER'); // Papel escolhido
  const [accessCodeInput, setAccessCodeInput] = useState(""); // Código digitado (GM ou Player)
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Estados de Fluxo
  const [step, setStep] = useState<'HOME' | 'JOIN_CHARACTER'>('HOME');
  const [availableCharacters, setAvailableCharacters] = useState<any[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Buscar sessões ao carregar
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    console.log('[Home] Buscando sessões...');

    try {
      const data = await apiClient.fetchSessions();
      console.log('[Home] Sessões encontradas:', data.length);
      setSessions(data);
    } catch (err: any) {
      console.error('[Home] Erro ao buscar sessões:', err.message || err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCreateSession = async () => {
    if (!userName.trim() || !sessionName.trim()) {
      alert("Por favor, preencha o seu nome e o nome da sessão.");
      return;
    }

    setIsActionLoading(true);

    const sessionId = uuidv4().slice(0, 8); // ID curto
    // Define os códigos: customizados ou padrão
    const finalGmCode = customGmCode.trim() || `${sessionId}-GM`;
    const finalPlayerCode = customPlayerCode.trim() || sessionId;

    try {
      await apiClient.createSession({
        id: sessionId,
        name: sessionName.trim(),
        gmUserId: userName.trim(),
      });
    } catch {
      alert("Erro ao criar sessão no banco.");
      setIsActionLoading(false);
      return;
    }

    await globalEventStore.append({
      id: uuidv4(),
      sessionId: sessionId,
      seq: 0,
      type: "SESSION_CREATED",
      actorUserId: userName.trim(),
      visibility: "PUBLIC",
      createdAt: new Date().toISOString(),
      payload: {
        sessionId,
        name: sessionName.trim(),
        gmCode: finalGmCode, // Salva o código no evento
        playerCode: finalPlayerCode
      }
    });

    router.push(`/session/${sessionId}?u=${encodeURIComponent(userName.trim())}&r=GM`);
  };

  const handleJoinSession = async () => {
    if (!selectedSession || isActionLoading) return;

    setIsActionLoading(true);
    let joinInfo: apiClient.SessionJoinInfo;
    try {
      joinInfo = await apiClient.fetchSessionJoinInfo(selectedSession.id);
    } catch {
      alert("Erro ao verificar dados da sessão.");
      setIsActionLoading(false);
      return;
    }

    const expectedGmCode = String(joinInfo.gmCode).toUpperCase();
    const expectedPlayerCode = String(joinInfo.playerCode).toUpperCase();
    const inputCode = accessCodeInput.trim().toUpperCase();

    if (joinRole === 'GM') {
      if (inputCode !== expectedGmCode) {
        alert("Código de Mestre incorreto.");
        setIsActionLoading(false);
        return;
      }
      router.push(`/session/${selectedSession.id}?u=Mestre&r=GM`);

    } else {
      if (inputCode !== expectedPlayerCode) {
        alert("Código da Mesa incorreto. Peça ao se Mestre o 'Código do Jogador'.");
        setIsActionLoading(false);
        return;
      }

      const playableCharacters = joinInfo.characters;
      if (playableCharacters.length === 0) {
        alert("Esta sala ainda não possui personagens jogáveis disponíveis.");
        setIsActionLoading(false);
        return;
      }

      setAvailableCharacters(playableCharacters);
      setStep('JOIN_CHARACTER');
      setIsActionLoading(false);
    }
  };

  const handleSelectCharacter = (char: any) => {
    if (!selectedSession || isActionLoading) return;
    setIsActionLoading(true);
    router.push(`/session/${selectedSession.id}?u=${encodeURIComponent(char.name)}&r=PLAYER&c=${char.id}`);
  };

  return (
    <div className="home-container">
      {/* Background Decorative Type */}
      <div className="bg-decor mystical-overlay"></div>

      <div className="hero-section">
        <div className="banner-container">
          <NextImage
            src="/banners/header-banner.png"
            alt="Cronos Vtt Banner"
            width={1200}
            height={300}
            className="header-banner"
            priority
          />
        </div>
        <h1 className="main-title glitch-text" data-text="CRONOS VTT">CRONOS VTT</h1>
      </div>

      {step === 'HOME' && (
        <div className="actions-grid">
          <CreateSessionCard
            userName={userName}
            setUserName={setUserName}
            sessionName={sessionName}
            setSessionName={setSessionName}
            customGmCode={customGmCode}
            setCustomGmCode={setCustomGmCode}
            customPlayerCode={customPlayerCode}
            setCustomPlayerCode={setCustomPlayerCode}
            onCreate={handleCreateSession}
            isLoading={isActionLoading}
          />

          <JoinSessionCard
            sessions={sessions}
            loadingSessions={loadingSessions}
            selectedSession={selectedSession}
            setSelectedSession={setSelectedSession}
            joinRole={joinRole}
            setJoinRole={setJoinRole}
            accessCodeInput={accessCodeInput}
            setAccessCodeInput={setAccessCodeInput}
            onJoin={handleJoinSession}
            isJoining={isActionLoading}
          />
        </div>
      )}

      {step === 'JOIN_CHARACTER' && (
        <CharacterSelection
          availableCharacters={availableCharacters}
          onSelectCharacter={handleSelectCharacter}
          onBack={() => setStep('HOME')}
          isLoading={isActionLoading}
        />
      )}

      <style jsx>{`
        .home-container {
          padding-top: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          position: relative;
          min-height: 100vh;
          overflow: hidden;
        }

        .mystic-select {
            width: 100%;
            background: rgba(197, 160, 89, 0.05);
            border: 1px solid rgba(197, 160, 89, 0.2);
            color: var(--accent-color);
            padding: 12px;
            font-family: var(--font-header);
            margin-bottom: 16px;
            outline: none;
            cursor: pointer;
        }
        
        .mystic-select option {
            background: #000;
            color: var(--accent-color);
        }

        .role-selector {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
        }

        .role-option {
            flex: 1;
            cursor: pointer;
        }

        .role-option input { display: none; }

        .role-box {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            border: 1px solid rgba(197, 160, 89, 0.2);
            background: rgba(197, 160, 89, 0.02);
            font-family: var(--font-header);
            font-size: 0.7rem;
            color: var(--text-secondary);
            transition: all 0.3s;
        }

        .role-option input:checked + .role-box {
            border-color: var(--accent-color);
            background: rgba(197, 160, 89, 0.1);
            color: var(--accent-color);
            box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
        }

        .gm-code-area {
            margin-bottom: 16px;
        }

        .animate-fade-in {
            animation: fadeIn 0.4s ease forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .hero-section {
          text-align: center;
          z-index: 2;
          margin-top: -20px;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .banner-container {
            margin-bottom: 20px;
            border: 5px solid var(--accent-color);
            box-shadow: 0 0 25px rgba(197, 160, 89, 0.6), inset 0 0 15px rgba(197, 160, 89, 0.3);
            background: rgba(0,0,0,0.5);
            display: inline-flex;
            max-width: 90vw; /* Garante margem lateral para vermos as bordas */
            box-sizing: border-box;
            position: relative;
        }

        .header-banner {
            max-width: 100%;
            height: auto;
            object-fit: contain;
            display: block; /* Remove espaço em branco inferior de imagens inline */
        }

        .main-title {
          font-family: var(--font-victorian);
          font-size: 4rem;
          color: var(--accent-color);
          text-shadow: 0 0 20px rgba(197, 160, 89, 0.4);
          margin: 0;
          letter-spacing: 0.1em;
          position: relative;
        }

        .subtitle {
          font-family: var(--font-header);
          font-size: 0.8rem;
          letter-spacing: 0.5em;
          color: var(--text-secondary);
          margin-top: 15px;
          opacity: 0.8;
        }

        .loading-text {
            color: var(--text-secondary);
            font-family: var(--font-header);
            font-size: 0.8rem;
            text-align: center;
            padding: 20px;
        }
      `}</style>
    </div>
  );
}
