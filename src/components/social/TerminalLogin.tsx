"use client";

import React, { useState } from 'react';

import { useBlinkAuth } from '@/hooks/useBlinkAuth';

export const TerminalLogin: React.FC = () => {
  const { login, register, error, loading } = useBlinkAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    
    try {
      if (isRegistering) {
        await register(email, password, { username: email.split('@')[0] });
        setSuccessMsg('CONTA CRIADA COM SUCESSO. REALIZE O LOGIN.');
        setIsRegistering(false);
      } else {
        await login(email, password);
        setSuccessMsg('CONEXÃO ESTABELECIDA. REDIRECIONANDO...');
      }
    } catch (err) {
      console.error('Auth error:', err);
    }
  };

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
        
        <h2 className="terminal-title">
          {isRegistering ? '01010010 01000101 01000111 01001001 01010011 01010100 01010010 01001111' : '01000001 01100011 01100101 01110011 01110011 01101111 01110010 01101001 01100001'}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="terminal-prompt">
            <input 
              type="email" 
              className="terminal-input" 
              placeholder="USUARIO (EMAIL)" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="terminal-prompt">
            <input 
              type="password" 
              className="terminal-input" 
              placeholder="SENHA" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="btn-terminal" disabled={loading}>
            {loading ? 'PROCESSANDO...' : isRegistering ? 'registrar' : 'conectar'}
          </button>
        </form>
        
        {error && <div className="terminal-error">ERRO: {error}</div>}
        {successMsg && <div className="terminal-success">{successMsg}</div>}
        
        <div className="terminal-footer">
          STATUS: {loading ? 'BUSY' : 'READY'}<br />
          LOCAL: 00111111 00111111 00111111<br />
          <br />
          <a href="#" onClick={(e) => { e.preventDefault(); setIsRegistering(!isRegistering); }}>
            {isRegistering ? '[ JÁ POSSUO ACESSO ]' : '[ SOLICITAR NOVO ACESSO ]'}
          </a>
        </div>
      </div>
    </div>
  );
};
