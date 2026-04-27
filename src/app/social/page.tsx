"use client";

import React from 'react';
import { TerminalLogin } from '@/components/social/TerminalLogin';
import { useBlinkAuth } from '@/hooks/useBlinkAuth';

export default function SocialPage() {
  const { isAuthenticated, user, logout, loading } = useBlinkAuth();

  if (loading) {
    return (
      <div className="terminal-container">
        <div className="terminal-box" style={{ textAlign: 'center' }}>
          <div className="terminal-title">INICIALIZANDO...</div>
          <div className="terminal-success">VERIFICANDO CREDENCIAIS</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <TerminalLogin />;
  }

  return (
    <div className="terminal-container">
      <div className="terminal-box">
        <div className="ascii-logo">
{` ██████╗ ██╗     ██╗███╗   ██╗██╗  ██╗███╗   ███╗ ██████╗ ████████╗██╗ ██████╗ ███╗   ██╗
 ██╔══██╗██║     ██║████╗  ██║██║ ██╔╝████╗ ████║██╔═══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
 ██████╔╝██║     ██║██╔██╗ ██║█████╔╝ ██╔████╔██║██║   ██║   ██║   ██║██║   ██║██╔██╗ ██║
 ██╔══██╗██║     ██║██║╚██╗██║██╔═██╗ ██║╚██╔╝██║██║   ██║   ██║   ██║██║   ██║██║╚██╗██║
 ██████╔╝███████╗██║██║ ╚████║██║  ██╗██║ ╚═╝ ██║╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚████║
 ╚══════╝╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝`}
        </div>
        
        <h2 className="terminal-title">ACESSO CONCEDIDO</h2>
        
        <div className="terminal-footer" style={{ opacity: 1, color: '#00ff00', fontSize: '20px' }}>
          BEM-VINDO, {user?.email?.split('@')[0].toUpperCase() || 'USUARIO'}.<br />
          SUA CONEXÃO É SEGURA E MONITORADA.<br />
          <br />
          <div style={{ border: '1px solid #00ff00', padding: '20px', marginTop: '20px' }}>
            [ REDE SOCIAL EM DESENVOLVIMENTO ]<br />
            - FEED DE NOTICIAS: OFFLINE<br />
            - MENSAGENS DIRETAS: OFFLINE<br />
            - ARQUIVOS COMPARTILHADOS: OFFLINE
          </div>
        </div>

        <button className="btn-terminal" onClick={logout} style={{ marginTop: '40px', width: 'auto', padding: '10px 40px' }}>
          desconectar
        </button>
      </div>
    </div>
  );
}
